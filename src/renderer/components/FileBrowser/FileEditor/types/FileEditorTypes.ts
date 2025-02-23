/**
 * 文件编辑器类型定义
 */

import { makeAutoObservable } from 'mobx';
import { createContext, useContext } from 'react';

// 编辑器事件类型
export enum EditorEvents {
  // 文件相关事件
  CONTENT_CHANGED = 'content-changed',
  FILE_LOADED = 'file-loaded',
  FILE_CHANGED = 'file-changed',
  SAVE_REQUESTED = 'save-requested',
  
  // 过滤相关事件
  FILTER_APPLIED = 'filter-applied',
  FILTER_CLEARED = 'filter-cleared',
  
  // 监控相关事件
  WATCH_STARTED = 'watch-started',
  WATCH_STOPPED = 'watch-stopped',
  
  // 搜索相关事件
  SEARCH_STARTED = 'search-started',
  SEARCH_PROGRESS = 'search-progress',
  SEARCH_COMPLETED = 'search-completed',
  SEARCH_STOPPED = 'search-stopped',
  SEARCH_ERROR = 'search-error',
  SEARCH_MATCH_CHANGED = 'search-match-changed',
  SEARCH_PARTIAL_RESULTS = 'search-partial-results',
  SEARCH_REQUESTED = 'search-requested',
  
  // 错误事件
  ERROR_OCCURRED = 'error-occurred'
}

// 错误类型
export enum EditorErrorType {
  // 文件错误
  FILE_NOT_FOUND = '文件不存在',
  FILE_PERMISSION_DENIED = '文件访问权限不足',
  FILE_TOO_LARGE = '文件过大',
  FILE_CORRUPTED = '文件已损坏',
  
  // 操作错误
  OPERATION_FAILED = '操作失败',
  OPERATION_TIMEOUT = '操作超时',
  OPERATION_CANCELLED = '操作已取消',
  
  // 内存错误
  MEMORY_LIMIT_EXCEEDED = '内存使用超出限制',
  
  // 编码错误
  ENCODING_ERROR = '文件编码错误',
  
  // 过滤错误
  FILTER_ERROR = '过滤表达式无效',
  
  // 监控错误
  WATCH_ERROR = '文件监控错误',
  
  // 搜索错误
  SEARCH_ERROR = '搜索表达式无效',
  
  // 其他错误
  UNKNOWN_ERROR = '未知错误'
}

// 编辑器状态
export interface EditorState {
  isLoading: boolean;
  currentFile: string;
  filterActive: boolean;
  filterStats: FilterStats;
  error: Error | null;
  isWatching: boolean;
  isAutoScrollEnabled: boolean;
}

// 过滤统计
export interface FilterStats {
  matchedLines: number;
  totalLines: number;
  processedSize: number;
}

// 编辑器配置
export interface EditorConfig {
  chunkSize: number;
  maxMemoryUsage: number;
  defaultEncoding: string;
  watchDebounceInterval: number;
  searchDebounceInterval: number;
  searchChunkSize: number;
}

// 搜索配置
export interface SearchConfig {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

// 搜索结果
export interface SearchResult {
  lineNumber: number;
  matchStart: number;
  matchEnd: number;
  previewText: string;
}

// 搜索统计
export interface SearchStats {
  totalMatches: number;
  currentMatch: number;
  searchedBytes: number;
  totalBytes: number;
  isSearching: boolean;
}

// Store 接口
export interface IFileEditorStore {
  // 文件状态
  currentFile: string | null;
  isLoading: boolean;
  error: Error | null;

  // 编辑状态
  isSaving: boolean;
  isRefreshing: boolean;
  isDirty: boolean;

  // 实时模式状态
  isRealtime: boolean;
  isAutoScroll: boolean;

  // 过滤状态
  filterActive: boolean;
  filterStats: FilterStats;

  // 方法
  setCurrentFile(file: string | null): void;
  setLoading(loading: boolean): void;
  setError(error: Error | null): void;
  setSaving(saving: boolean): void;
  setRefreshing(refreshing: boolean): void;
  setDirty(dirty: boolean): void;
  toggleRealtime(): void;
  toggleAutoScroll(): void;
  setFilterActive(active: boolean): void;
  updateFilterStats(stats: FilterStats): void;
  reset(): void;
}

// 创建 Context
export const EditorStoreContext = createContext<IFileEditorStore | null>(null);

// 创建 Hook
export const useEditorStore = () => {
  const store = useContext(EditorStoreContext);
  if (!store) {
    throw new Error('useEditorStore must be used within an EditorStoreProvider');
  }
  return store;
}; 