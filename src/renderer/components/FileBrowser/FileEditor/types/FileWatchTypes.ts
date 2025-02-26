/**
 * 文件监控相关类型定义
 */

/**
 * 文件监控事件类型
 */
export enum FileWatchEventType {
  UPDATE = 'update',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * 文件监控事件数据接口
 */
export interface FileWatchEventData {
  /**
   * 事件类型
   */
  type: string;
  
  /**
   * 事件时间戳
   */
  timestamp: number;
  
  /**
   * 文件路径
   */
  filePath?: string;
  
  /**
   * 新增内容（仅在update类型时有效）
   */
  content?: string[];
  
  /**
   * 错误信息（仅在error类型时有效）
   */
  error?: Error;
  
  /**
   * 警告信息（仅在warning类型时有效）
   */
  warning?: string;
  
  /**
   * 信息（仅在info类型时有效）
   */
  info?: string;
}

/**
 * 文件监控配置接口
 */
export interface FileWatchConfig {
  /**
   * 轮询间隔（毫秒）
   */
  pollInterval?: number;
  
  /**
   * 最大重试次数
   */
  maxRetries?: number;
  
  /**
   * 重试延迟（毫秒）
   */
  retryDelay?: number;
  
  /**
   * 缓冲区大小
   */
  bufferSize?: number;
  
  /**
   * 是否启用智能轮询
   * 根据文件变化频率自动调整轮询间隔
   */
  smartPolling?: boolean;
}

/**
 * 文件监控状态接口
 */
export interface FileWatchState {
  /**
   * 是否正在监控
   */
  isWatching: boolean;
  
  /**
   * 上次更新时间
   */
  lastUpdateTime: number;
  
  /**
   * 当前轮询间隔
   */
  currentPollInterval: number;
  
  /**
   * 已尝试的重试次数
   */
  retryCount: number;
  
  /**
   * 文件大小
   */
  fileSize: number;
  
  /**
   * 文件修改时间
   */
  modifyTime: number;
} 