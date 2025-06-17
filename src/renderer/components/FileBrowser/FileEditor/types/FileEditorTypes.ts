/**
 * 文件编辑器类型定义
 */

import { makeAutoObservable } from 'mobx';
import { createContext, useContext } from 'react';

// 编辑器事件类型
export enum EditorEvents {
  // 加载事件
  LOADING_STARTED = 'loading:started',
  LOADING_COMPLETED = 'loading:completed',
  CONTENT_LOADED = 'content:loaded',
  CONTENT_CHANGED = 'content:changed',
  
  // 保存事件
  SAVING_STARTED = 'saving:started',
  SAVING_COMPLETED = 'saving:completed',
  
  // 错误事件
  ERROR = 'error',
  
  // 光标和选择事件
  CURSOR_POSITION_CHANGED = 'cursor:position:changed',
  SELECTION_CHANGED = 'selection:changed',
  
  // 大文件相关事件
  LARGE_FILE_DETECTED = 'large:file:detected',
  VERY_LARGE_FILE_DETECTED = 'very:large:file:detected',
  LARGE_FILE_LOADED = 'large:file:loaded',
  LOAD_MORE_COMPLETED = 'load:more:completed',
  
  // 模式切换事件
  MODE_CHANGED = 'mode:changed',
  
  // 编辑器状态事件
  EDITOR_READY = 'editor:ready',
  EDITOR_DISPOSED = 'editor:disposed',
  
  // 搜索和过滤事件
  SEARCH_RESULTS_UPDATED = 'search:results:updated',
  FILTER_RESULTS_UPDATED = 'filter:results:updated',
  
  // 文件相关事件
  FILE_LOADED = 'fileLoaded',
  FILE_CHANGED = 'file-changed',
  SAVE_REQUESTED = 'save-requested',
  ENCODING_CHANGED = 'encoding-changed',
  
  // 过滤相关事件
  FILTER_STARTED = 'filter-started',
  FILTER_PROGRESS = 'filter-progress',
  FILTER_COMPLETED = 'filter-completed',
  FILTER_ERROR = 'filter-error',
  FILTER_CLEARED = 'filter-cleared',
  FILTER_PARTIAL_RESULTS = 'filter-partial-results',
  FILTER_STATE_CHANGED = 'filter-state-changed',
  
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
  LOADING_END = 'loadingEnd',
  FILE_SAVED = 'fileSaved',
  
  // SFTP 相关事件
  CONNECTION_LOST = 'connectionLost',
  CONNECTION_RESTORED = 'connection-restored',
  
  // 模式切换相关事件
  MODE_SWITCHING_STARTED = 'mode-switching-started',
  MODE_SWITCHING_COMPLETED = 'mode-switching-completed',
  MODE_SWITCHING_FAILED = 'mode-switching-failed',
  MODE_SWITCHING_CANCELLED = 'mode-switching-cancelled',
  
  // 文件事件
  FILE_CLOSED = 'file-closed',
  
  // 内容事件
  CURSOR_MOVED = 'cursor-moved',
  
  // 错误事件
  ERRORS_CLEARED = 'errors-cleared',
  
  // 自动滚动事件
  AUTO_SCROLL_CHANGED = 'auto-scroll-changed',
  
  // 大文件处理事件
  CHUNK_LOADED = 'chunk-loaded',
  LOAD_MORE_REQUESTED = 'load-more-requested',
}

// 编辑器错误类型
export enum EditorErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ENCODING_ERROR = 'ENCODING_ERROR',
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  MODE_SWITCH_ERROR = 'MODE_SWITCH_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 编辑器模式
export enum EditorMode {
  BROWSE = 'browse',  // 浏览模式（默认）
  EDIT = 'edit'       // 编辑模式
}

// 远程文件信息
export interface RemoteFileInfo {
  path: string;
  size: number;
  modifyTime: number;
  isDirectory: boolean;
  permissions: string;
  owner: string;
  group: string;
  encoding?: string;
  isPartiallyLoaded?: boolean;
}

// 远程会话信息
export interface RemoteSessionInfo {
  sessionId: string;
  connectionId: string;
  isConnected: boolean;
  lastError: Error | null;
}

// 编码类型
export enum EncodingType {
  UTF8 = 'utf8',
  UTF16LE = 'utf16le',
  ASCII = 'ascii',
  LATIN1 = 'latin1',
  BASE64 = 'base64',
  HEX = 'hex',
  BINARY = 'binary',
  AUTO = 'auto'
}

/**
 * 编辑器配置
 */
export interface EditorConfig {
  // 主题
  theme?: string;
  // 字体大小
  fontSize?: number;
  // 行高
  lineHeight?: number;
  // 制表符大小
  tabSize?: number;
  // 是否使用空格代替制表符
  insertSpaces?: boolean;
  // 自动换行
  wordWrap?: 'off' | 'on' | 'wordWrapColumn' | 'bounded';
  // 自动缩进
  autoIndent?: boolean;
  // 输入时格式化
  formatOnType?: boolean;
  // 粘贴时格式化
  formatOnPaste?: boolean;
  // 自动保存
  autoSave?: boolean;
  // 自动保存间隔（毫秒）
  autoSaveInterval?: number;
  // 大文件大小阈值（字节）
  largeFileSize?: number;
  // 最大文件大小（字节）
  maxFileSize?: number;
}

// 编辑器位置
export interface EditorPosition {
  line: number;
  column: number;
}

// 编辑器选择区域
export interface EditorSelection {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// 文件块信息
export interface FileChunk {
  content: string[];
  startLine: number;
  endLine: number;
  lastAccessed: number;
}

// 过滤配置
export interface FilterConfig {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
  contextLines?: number;  // 上下文行数
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
  line: number;
  column: number;
  length: number;
  text: string;
}

// 浏览模式状态
export interface BrowseModeState {
  visibleRange: [number, number];  // 可见行范围
  loadedChunks: {                  // 已加载块
    [key: string]: FileChunk;
  };
  totalLines?: number;             // 总行数(可能未知)
  isFiltered: boolean;             // 是否已过滤
  filterPattern?: string;          // 过滤模式
  isRealtime: boolean;             // 是否实时模式
  isAutoScroll: boolean;           // 是否自动滚动
}

/**
 * 编辑模式状态
 */
export interface EditModeState {
  // 文件是否已加载
  isLoaded: boolean;
  // 是否正在保存
  isSaving: boolean;
  // 当前选择区域
  selection: EditorSelection | null;
  // 当前光标位置
  cursorPosition: EditorPosition;
  // 撤销栈
  undoStack: string[];
  // 重做栈
  redoStack: string[];
}

// 标签数据结构
export interface EditorTab {
  id: string;                      // 唯一标识
  filePath: string;                // 文件路径
  sessionId: string;               // 会话ID
  title: string;                   // 显示标题
  mode: EditorMode;                // 当前模式
  isActive: boolean;               // 是否激活
  isModified: boolean;             // 是否已修改
  viewState: {                     // 视图状态
    scrollPosition: number;        // 滚动位置
    filterText?: string;           // 过滤文本
    searchText?: string;           // 搜索文本
    isRealtime: boolean;           // 是否实时模式
  };
  fileState: {                     // 文件状态
    size: number;                  // 文件大小
    lastModified: number;          // 最后修改时间
    encoding: string;              // 文件编码
    totalLines?: number;           // 总行数(可能未知)
  };
  browseState?: BrowseModeState;   // 浏览模式状态
  editState?: EditModeState;       // 编辑模式状态
}

/**
 * 模式切换选项
 */
export interface ModeSwitchOptions {
  // 切换时是否保存文件
  saveOnSwitch?: boolean;
  // 切换超时时间（毫秒）
  timeout?: number;
  // 自定义切换参数
  params?: Record<string, any>;
}

/**
 * 模式切换结果
 */
export interface ModeSwitchResult {
  // 切换是否成功
  success: boolean;
  // 当前模式
  mode?: EditorMode;
  // 错误信息
  error?: string;
  // 切换耗时（毫秒）
  timeTaken?: number;
}

// 标签管理器接口
export interface ITabManager {
  // 标签基本操作
  addTab(options: Partial<EditorTab>): string;
  closeTab(tabId: string): Promise<boolean>;
  activateTab(tabId: string): void;
  
  // 标签状态管理
  getTabState(tabId: string): EditorTab | undefined;
  updateTabState(tabId: string, updates: Partial<EditorTab>): void;
  
  // 模式切换
  switchTabMode(tabId: string, mode: EditorMode, options?: ModeSwitchOptions): Promise<ModeSwitchResult>;
  
  // 标签内容操作
  saveTabContent(tabId: string): Promise<boolean>;
  reloadTabContent(tabId: string): Promise<boolean>;
}

// 创建上下文
export const EditorContext = createContext<any>(null);

// 使用上下文的钩子
export function useEditor() {
  return useContext(EditorContext);
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
  sessionInfo: RemoteSessionInfo | null;
}

// 过滤统计
export interface FilterStats {
  matchedLines: number;
  totalLines: number;
  processedSize: number;
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

// 文件监控配置
export interface FileWatchConfig {
  // 轮询间隔范围（毫秒）
  minInterval: number;
  maxInterval: number;
  // 初始轮询间隔
  initialInterval: number;
  // 退避系数
  backoffFactor: number;
  // 最大重试次数
  maxRetries: number;
  // 缓冲区大小限制（字节）
  bufferSizeLimit: number;
  // 增量获取大小（字节）
  incrementalSize: number;
  // 批量更新大小
  batchSize: number;
  // 更新节流时间（毫秒）
  throttleInterval: number;
}

/**
 * 文件监控状态
 */
export interface FileWatchState {
  isWatching: boolean;
  currentInterval: number;
  lastCheckTime: number;
  lastSize: number;
  lastReadPosition: number;
  retryCount: number;
  isPaused: boolean;
  bufferUsage: number;
  sessionId: string;
  filePath: string;
  lastModified: number;
  stats: {
    totalUpdates: number;
    failedUpdates: number;
    lastUpdateTime: number;
    averageUpdateSize: number;
    newLines: number;
    totalLines: number;
    updateSize: number;
  };
}

/**
 * 文件监控事件数据
 */
export interface FileWatchEventData {
  type: 'update' | 'error' | 'warning' | 'info';
  filePath: string;
  sessionId: string;
  timestamp: number;
  content?: string[];
  fullContent?: string;
  error?: Error;
  warning?: string;
  info?: string;
  stats: {
    totalUpdates: number;
    failedUpdates: number;
    lastUpdateTime: number;
    averageUpdateSize: number;
    newLines: number;
    totalLines: number;
    updateSize: number;
  };
}

/**
 * 标签页信息
 */
export interface TabInfo {
  id: string;
  filePath: string;
  sessionId: string;
  title: string;
  isActive: boolean;
  mode?: EditorMode;
}

/**
 * 大文件信息接口
 */
export interface LargeFileInfo {
  loadedSize: number;
  totalSize: number;
  hasMore: boolean;
  isComplete: boolean;
}

/**
 * 分块加载结果接口
 */
export interface ChunkLoadResult {
  content: string;
  startPosition: number;
  endPosition: number;
  totalSize: number;
  bytesRead: number;
  hasMore: boolean;
} 