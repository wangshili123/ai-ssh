/**
 * 搜索管理器
 * 提供文件内容搜索功能
 */

import { EventEmitter } from 'events';
import * as monaco from 'monaco-editor';
import { EditorEvents, SearchConfig, SearchResult } from '../types/FileEditorTypes';

/**
 * 搜索管理器
 * 负责在编辑器中执行搜索和导航功能
 */
export class SearchManager extends EventEmitter {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private findController: any;
  private currentResults: SearchResult[] = [];
  private currentMatchIndex: number = -1;
  private searchConfig: SearchConfig = {
    pattern: '',
    isRegex: false,
    caseSensitive: false,
    wholeWord: false
  };

  /**
   * 构造函数
   * @param editor Monaco编辑器实例
   */
  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    super();
    this.editor = editor;
    
    // 获取Monaco编辑器的查找控制器
    this.findController = this.editor.getContribution('editor.contrib.findController');
    
    // 监听搜索状态变更
    this.setupEventListeners();
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners(): void {
    // 监听编辑器内容变化，可能需要重新搜索
    this.editor.onDidChangeModelContent(() => {
      if (this.searchConfig.pattern) {
        this.search(this.searchConfig);
      }
    });
  }

  /**
   * 执行搜索
   * @param config 搜索配置
   * @returns 搜索结果
   */
  public async search(config: SearchConfig): Promise<SearchResult[]> {
    this.searchConfig = config;
    
    if (!config.pattern) {
      this.emit(EditorEvents.SEARCH_STOPPED);
      this.currentResults = [];
      this.currentMatchIndex = -1;
      return [];
    }
    
    this.emit(EditorEvents.SEARCH_STARTED);
    
    try {
      // 使用Monaco编辑器的查找功能
      if (this.findController) {
        try {
          const state = this.findController.getState();

          // 安全地设置查找选项，检查方法是否存在
          if (typeof state.changeMatchCase === 'function') {
            state.changeMatchCase(config.caseSensitive);
          }
          if (typeof state.changeWholeWord === 'function') {
            state.changeWholeWord(config.wholeWord);
          }
          if (typeof state.changeRegex === 'function') {
            state.changeRegex(config.isRegex);
          }

          // 开始查找
          this.findController.start({
            forceRevealReplace: false,
            seedSearchStringFromSelection: false,
            shouldFocus: 0,
            shouldAnimate: true,
            updateSearchScope: false
          });

          // 设置查找文本
          if (typeof state.change === 'function') {
            state.change(config.pattern, state.replaceString || '');
          }
        } catch (findError) {
          console.warn('[SearchManager] Monaco查找控制器操作失败，使用备用搜索:', findError);
          // 如果Monaco查找失败，继续使用我们自己的搜索实现
        }
      }
      
      // 获取搜索结果
      this.currentResults = this.collectSearchResults(config);
      this.currentMatchIndex = this.currentResults.length > 0 ? 0 : -1;
      
      // 发出搜索完成事件
      this.emit(EditorEvents.SEARCH_COMPLETED, {
        results: this.currentResults,
        matchIndex: this.currentMatchIndex
      });
      
      return this.currentResults;
    } catch (error) {
      this.emit(EditorEvents.SEARCH_ERROR, error);
      console.error('搜索失败:', error);
      return [];
    }
  }

  /**
   * 收集搜索结果
   * @param config 搜索配置
   * @returns 搜索结果列表
   */
  private collectSearchResults(config: SearchConfig): SearchResult[] {
    const model = this.editor.getModel();
    if (!model) return [];
    
    const results: SearchResult[] = [];
    const text = model.getValue();
    const lines = text.split('\n');
    
    // 创建正则表达式
    let regex: RegExp;
    try {
      if (config.isRegex) {
        regex = new RegExp(config.pattern, config.caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = config.pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const word = config.wholeWord ? `\\b${escaped}\\b` : escaped;
        regex = new RegExp(word, config.caseSensitive ? 'g' : 'gi');
      }
    } catch (e) {
      console.error('创建正则表达式失败:', e);
      return [];
    }
    
    // 查找匹配项
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      
      // 重置正则表达式的lastIndex
      regex.lastIndex = 0;
      
      while ((match = regex.exec(line)) !== null) {
        results.push({
          line: i + 1,
          column: match.index + 1,
          length: match[0].length,
          text: line
        });
      }
    }
    
    return results;
  }

  /**
   * 导航到下一个匹配项
   * @param wrap 是否循环
   */
  public navigateToNextMatch(wrap: boolean = true): void {
    if (this.currentResults.length === 0) return;
    
    // 计算下一个索引
    let nextIndex = this.currentMatchIndex + 1;
    if (nextIndex >= this.currentResults.length) {
      if (wrap) {
        nextIndex = 0; // 循环到第一个
      } else {
        return; // 不循环，已经是最后一个
      }
    }
    
    this.goToMatch(nextIndex);
  }

  /**
   * 导航到上一个匹配项
   * @param wrap 是否循环
   */
  public navigateToPreviousMatch(wrap: boolean = true): void {
    if (this.currentResults.length === 0) return;
    
    // 计算上一个索引
    let prevIndex = this.currentMatchIndex - 1;
    if (prevIndex < 0) {
      if (wrap) {
        prevIndex = this.currentResults.length - 1; // 循环到最后一个
      } else {
        return; // 不循环，已经是第一个
      }
    }
    
    this.goToMatch(prevIndex);
  }

  /**
   * 跳转到特定匹配项
   * @param index 索引
   */
  private goToMatch(index: number): void {
    if (index < 0 || index >= this.currentResults.length) return;
    
    const match = this.currentResults[index];
    this.currentMatchIndex = index;
    
    // 创建选择范围
    const selection = new monaco.Selection(
      match.line,
      match.column,
      match.line,
      match.column + match.length
    );
    
    // 设置编辑器选择和滚动到可见区域
    this.editor.setSelection(selection);
    this.editor.revealRangeInCenter(selection);
    
    // 发出导航事件
    this.emit(EditorEvents.SEARCH_MATCH_CHANGED, {
      match,
      index,
      total: this.currentResults.length
    });
  }

  /**
   * 停止搜索
   */
  public stopSearch(): void {
    // 清除搜索结果
    if (this.findController) {
      this.findController.getState().change('', '');
    }
    
    this.currentResults = [];
    this.currentMatchIndex = -1;
    this.searchConfig.pattern = '';
    
    this.emit(EditorEvents.SEARCH_STOPPED);
  }

  /**
   * 获取当前搜索结果
   * @returns 搜索结果
   */
  public getResults(): SearchResult[] {
    return this.currentResults;
  }

  /**
   * 获取当前匹配索引
   * @returns 当前匹配索引
   */
  public getCurrentMatchIndex(): number {
    return this.currentMatchIndex;
  }

  /**
   * 获取搜索结果数量
   * @returns 搜索结果数量
   */
  public getResultCount(): number {
    return this.currentResults.length;
  }
}
