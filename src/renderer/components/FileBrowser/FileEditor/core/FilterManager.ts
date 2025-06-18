/**
 * 过滤管理器
 * 负责处理文件内容的过滤功能
 */

import { EventEmitter } from 'events';
import * as monaco from 'monaco-editor';
import { EditorEvents, FilterConfig } from '../types/FileEditorTypes';

export interface FilterOptions {
  text: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
}

export class FilterManager extends EventEmitter {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private originalModel: monaco.editor.ITextModel | null = null;
  private filteredModel: monaco.editor.ITextModel | null = null;
  private isFiltering: boolean = false;
  private sessionId: string = '';
  private filePath: string = '';
  private currentFilterConfig: FilterConfig | null = null;

  constructor(editor: monaco.editor.IStandaloneCodeEditor) {
    super();
    this.editor = editor;
    this.originalModel = editor.getModel();
  }

  initialize(sessionId: string, filePath: string) {
    this.sessionId = sessionId;
    this.filePath = filePath;
  }

  /**
   * 兼容新接口的过滤方法
   * @param config 过滤配置
   */
  async applyFilter(config: FilterConfig): Promise<string[]> {
    return this.filter({
      text: config.pattern,
      isRegex: config.isRegex,
      isCaseSensitive: config.caseSensitive
    });
  }

  /**
   * 原有的过滤方法
   * @param options 过滤选项
   * @returns 过滤结果
   */
  async filter(options: FilterOptions): Promise<string[]> {
    if (!this.editor || !this.originalModel) return [];

    try {
      this.isFiltering = true;
      this.emit(EditorEvents.FILTER_STARTED);
      this.currentFilterConfig = {
        pattern: options.text,
        isRegex: options.isRegex,
        caseSensitive: options.isCaseSensitive
      };

      const content = this.originalModel.getValue();
      const lines = content.split('\n');
      
      let regex: RegExp;
      if (options.isRegex) {
        regex = new RegExp(options.text, options.isCaseSensitive ? 'g' : 'gi');
      } else {
        const escaped = options.text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        regex = new RegExp(escaped, options.isCaseSensitive ? 'g' : 'gi');
      }

      // 过滤行
      const filteredLines = lines.filter(line => regex.test(line));
      
      // 创建过滤后的内容
      const filteredContent = filteredLines.join('\n');
      
      // 创建或更新过滤模型
      if (this.filteredModel) {
        this.filteredModel.setValue(filteredContent);
      } else {
        this.filteredModel = monaco.editor.createModel(
          filteredContent,
          this.originalModel.getLanguageId(),
          monaco.Uri.parse(`${this.originalModel.uri.toString()}.filtered`)
        );
      }
      
      // 切换到过滤模型
      this.editor.setModel(this.filteredModel);
      
      this.isFiltering = false;
      this.emit(EditorEvents.FILTER_COMPLETED, {
        matchedLines: filteredLines.length,
        pattern: options.text
      });
      
      return filteredLines;
    } catch (error: any) {
      this.isFiltering = false;
      this.emit(EditorEvents.FILTER_ERROR, error);
      console.error('过滤失败:', error);
      return [];
    }
  }

  /**
   * 清除过滤
   */
  clearFilter() {
    if (!this.editor || !this.originalModel) return;
    
    // 切换回原始模型
    this.editor.setModel(this.originalModel);
    
    // 处理过滤模型
    if (this.filteredModel) {
      this.filteredModel.dispose();
      this.filteredModel = null;
    }
    
    this.currentFilterConfig = null;
    this.emit(EditorEvents.FILTER_CLEARED);
  }

  /**
   * 检查是否处于过滤状态
   * @returns 是否处于过滤状态
   */
  isActive(): boolean {
    return this.filteredModel !== null;
  }

  /**
   * 获取当前过滤配置
   * @returns 当前过滤配置
   */
  getCurrentFilterConfig(): FilterConfig | null {
    return this.currentFilterConfig;
  }

  /**
   * 获取当前过滤统计信息
   * @returns 过滤统计信息
   */
  getCurrentFilterStats(): { totalLines: number; matchedLines: number } | null {
    if (!this.isActive() || !this.originalModel || !this.filteredModel) {
      return null;
    }

    const totalLines = this.originalModel.getLineCount();
    const matchedLines = this.filteredModel.getLineCount();

    return {
      totalLines,
      matchedLines
    };
  }

  /**
   * 销毁过滤管理器
   */
  destroy() {
    if (this.filteredModel) {
      this.filteredModel.dispose();
    }
    this.removeAllListeners();
  }
} 