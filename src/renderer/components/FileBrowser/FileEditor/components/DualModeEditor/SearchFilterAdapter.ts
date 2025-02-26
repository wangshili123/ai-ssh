/**
 * 搜索和过滤功能适配器
 * 根据当前模式使用不同的搜索和过滤实现
 */

import { EventEmitter } from 'events';
import { EditorMode, SearchConfig, FilterConfig } from '../../types/FileEditorTypes';
import { SearchManager } from '../../core/SearchManager';
import { FilterManager } from '../../core/FilterManager';
import { FileEditorManager } from '../../core/FileEditorManager';

/**
 * 自定义接口，兼容旧的搜索选项
 */
interface SearchOptions {
  text: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
  isWholeWord: boolean;
}

/**
 * 自定义接口，兼容旧的过滤选项
 */
interface FilterOptions {
  text: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
}

/**
 * 搜索适配器
 * 根据当前模式使用不同的搜索实现
 */
export class SearchAdapter extends EventEmitter {
  private editorManager: FileEditorManager;
  private searchManager: SearchManager | null = null;
  private currentMode: EditorMode;

  constructor(editorManager: FileEditorManager, searchManager: SearchManager | null = null) {
    super();
    this.editorManager = editorManager;
    this.searchManager = searchManager;
    this.currentMode = editorManager.getCurrentMode();

    // 监听模式切换事件
    this.editorManager.on('mode-switching-completed', (data: any) => {
      this.currentMode = data.mode;
    });
  }

  /**
   * 执行搜索
   * @param options 搜索选项
   */
  search(options: SearchOptions): void {
    if (this.currentMode === EditorMode.EDIT && this.searchManager) {
      // 编辑模式：使用Monaco编辑器的搜索功能
      this.searchManager.search({
        pattern: options.text,
        isRegex: options.isRegex,
        caseSensitive: options.isCaseSensitive,
        wholeWord: options.isWholeWord
      });
    } else {
      // 浏览模式：使用FileEditorManager的搜索功能
      const searchConfig: SearchConfig = {
        pattern: options.text,
        isRegex: options.isRegex,
        caseSensitive: options.isCaseSensitive,
        wholeWord: options.isWholeWord
      };
      
      this.editorManager.search(searchConfig);
    }
  }

  /**
   * 清除搜索结果
   */
  clearSearch(): void {
    if (this.currentMode === EditorMode.EDIT && this.searchManager) {
      // 使用新的stopSearch方法代替旧的clearDecorations方法
      this.searchManager.stopSearch();
    }
    // 浏览模式下不需要特别清除，因为每次搜索都会覆盖上一次结果
  }

  /**
   * 销毁适配器
   */
  destroy(): void {
    this.removeAllListeners();
    if (this.searchManager) {
      // 使用removeAllListeners代替destroy
      this.searchManager.removeAllListeners();
    }
  }
}

/**
 * 过滤适配器
 * 根据当前模式使用不同的过滤实现
 */
export class FilterAdapter extends EventEmitter {
  private editorManager: FileEditorManager;
  private filterManager: FilterManager | null = null;
  private currentMode: EditorMode;

  constructor(editorManager: FileEditorManager, filterManager: FilterManager | null = null) {
    super();
    this.editorManager = editorManager;
    this.filterManager = filterManager;
    this.currentMode = editorManager.getCurrentMode();

    // 监听模式切换事件
    this.editorManager.on('mode-switching-completed', (data: any) => {
      this.currentMode = data.mode;
    });
  }

  /**
   * 执行过滤
   * @param options 过滤选项
   */
  filter(options: FilterOptions): void {
    if (this.currentMode === EditorMode.EDIT && this.filterManager) {
      // 编辑模式：使用Monaco编辑器的过滤功能
      this.filterManager.filter(options);
    } else {
      // 浏览模式：使用FileEditorManager的过滤功能
      const filterConfig: FilterConfig = {
        pattern: options.text,
        isRegex: options.isRegex,
        caseSensitive: options.isCaseSensitive
      };
      
      this.editorManager.applyFilter(filterConfig);
    }
  }

  /**
   * 清除过滤
   */
  clearFilter(): void {
    if (this.currentMode === EditorMode.EDIT && this.filterManager) {
      this.filterManager.clearFilter();
    } else {
      // 浏览模式：使用空字符串作为模式来清除过滤
      const emptyFilterConfig: FilterConfig = {
        pattern: '',
        isRegex: false,
        caseSensitive: false
      };
      
      this.editorManager.applyFilter(emptyFilterConfig);
    }
  }

  /**
   * 检查过滤是否激活
   */
  isActive(): boolean {
    if (this.currentMode === EditorMode.EDIT && this.filterManager) {
      return this.filterManager.isActive();
    }
    
    // 浏览模式下，需要从BrowseMode状态中获取
    const browseMode = this.editorManager.getBrowseMode();
    if (browseMode) {
      const state = browseMode.getState();
      return state.isFiltered;
    }
    
    return false;
  }

  /**
   * 销毁适配器
   */
  destroy(): void {
    this.removeAllListeners();
    if (this.filterManager) {
      // 使用removeAllListeners代替destroy
      this.filterManager.removeAllListeners();
    }
  }
} 