/**
 * 文件编辑器类型定义
 */

import { makeAutoObservable } from 'mobx';
import { createContext, useContext } from 'react';

// 编辑器事件类型
export enum EditorEvents {
  // 文件相关事件
  CONTENT_CHANGED = 'contentChanged',
  FILE_LOADED = 'fileLoaded',
  FILE_CHANGED = 'file-changed',
  SAVE_REQUESTED = 'save-requested',
  
  // 过滤相关事件
  FILTER_STARTED = 'filter-started',
  FILTER_PROGRESS = 'filter-progress',
  FILTER_COMPLETED = 'filter-completed',
  FILTER_ERROR = 'filter-error',
  FILTER_CLEARED = 'filter-cleared',
  FILTER_PARTIAL_RESULTS = 'filter-partial-results',
  
  // 监控相关事件
  WATCH_STARTED = 'watch-started',
  WATCH_STOPPED = 'watch-stopped',
  
  // 搜索相关事件
  SEARCH_STARTED = 'search-started',
  SEARCH_PROGRESS = 'search-progress',
  SEARCH_COMPLETED = 'search-completed',
  SEARCH_STOPPED = 'search-stopped',
  SEARCH_ERROR = 'search-error',
  SEARCH_MATCH_CHANGED = 'searchMatchChanged',
  SEARCH_PARTIAL_RESULTS = 'search-partial-results',
  SEARCH_REQUESTED = 'search-requested',
  
  // 错误事件
  ERROR_OCCURRED = 'errorOccurred',
  
  // 新增事件
  PARTIAL_LOAD = 'partialLoad',
  LOADING_START = 'loadingStart',
  LOADING_END = 'loadingEnd',
  FILE_SAVED = 'fileSaved',
  
  // SFTP 相关事件
  CONNECTION_LOST = 'connectionLost',
  CONNECTION_RESTORED = 'connection-restored',
  ENCODING_CHANGED = 'encodingChanged',
  FILE_LOCKED = 'file-locked',
  FILE_UNLOCKED = 'file-unlocked'
}

// 错误类型
export enum EditorErrorType {
  // 文件错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED = 'FILE_PERMISSION_DENIED',
  FILE_TOO_LARGE = '文件过大',
  FILE_CORRUPTED = '文件已损坏',
  FILE_LOCKED = 'FILE_LOCKED',
  
  // 操作错误
  OPERATION_FAILED = 'OPERATION_FAILED',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  OPERATION_CANCELLED = '操作已取消',
  
  // 内存错误
  MEMORY_LIMIT_EXCEEDED = '内存使用超出限制',
  SYSTEM_MEMORY_LOW = 'SYSTEM_MEMORY_LOW',
  
  // 编码错误
  ENCODING_ERROR = '文件编码错误',
  
  // 过滤错误
  FILTER_ERROR = '过滤表达式无效',
  
  // 监控错误
  WATCH_ERROR = 'WATCH_ERROR',
  
  // 搜索错误
  SEARCH_ERROR = '搜索表达式无效',
  
  // 连接错误
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  SSH_ERROR = 'SSH_ERROR',
  SFTP_ERROR = 'SFTP_ERROR',
  
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

// 过滤配置
export interface FilterConfig {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
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

// 新增 SFTP 相关接口
export interface RemoteFileInfo {
  size: number;
  modifyTime: number;
  isDirectory: boolean;
  permissions: number;
  encoding: string;
  isPartiallyLoaded: boolean;
}

export interface RemoteSessionInfo {
  sessionId: string;
  connectionId: string;
  isConnected: boolean;
  lastError: Error | null;
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

  // 新增远程会话状态
  sessionInfo: RemoteSessionInfo | null;
  fileInfo: RemoteFileInfo | null;
  encoding: string;
  isConnected: boolean;

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

  // 新增远程操作方法
  setSessionInfo(info: RemoteSessionInfo): void;
  setFileInfo(info: RemoteFileInfo): void;
  setEncoding(encoding: string): void;
  reconnect(): Promise<void>;
  checkConnection(): Promise<boolean>;
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

export type EncodingType = 'UTF-8' | 'UTF-16LE' | 'UTF-16BE' | 'GB18030' | 'GBK' | 'GB2312' | 'BIG5' | 'EUC-JP' | 'SHIFT-JIS' | 'EUC-KR' | 'ASCII' | 'ISO-8859-1'; 