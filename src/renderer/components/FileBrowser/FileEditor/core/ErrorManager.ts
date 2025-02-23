/**
 * 错误处理管理器
 * 用于统一处理和恢复错误
 */

import { EventEmitter } from 'events';

// 错误类型
export enum ErrorType {
  // 文件错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED = 'FILE_PERMISSION_DENIED',
  FILE_LOCKED = 'FILE_LOCKED',
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  FILE_ENCODING_ERROR = 'FILE_ENCODING_ERROR',
  
  // 操作错误
  OPERATION_TIMEOUT = 'OPERATION_TIMEOUT',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  OPERATION_FAILED = 'OPERATION_FAILED',
  
  // 系统错误
  SYSTEM_MEMORY_LOW = 'SYSTEM_MEMORY_LOW',
  SYSTEM_DISK_FULL = 'SYSTEM_DISK_FULL',
  
  // 其他错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误信息
export interface ErrorInfo {
  type: ErrorType;
  message: string;
  details?: any;
  timestamp: number;
  recoverable: boolean;
  retryCount: number;
}

// 错误处理配置
export interface ErrorConfig {
  // 最大重试次数
  maxRetries: number;
  // 重试延迟（毫秒）
  retryDelay: number;
  // 是否自动重试
  autoRetry: boolean;
  // 错误日志级别
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export class ErrorManager extends EventEmitter {
  private config: ErrorConfig;
  private currentError: ErrorInfo | null = null;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<ErrorConfig> = {}) {
    super();
    
    // 默认配置
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      autoRetry: true,
      logLevel: 'error',
      ...config
    };
  }

  /**
   * 处理错误
   */
  public handleError(error: Error | string, type: ErrorType = ErrorType.UNKNOWN_ERROR): void {
    // 清除之前的重试定时器
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    // 创建错误信息
    const errorInfo: ErrorInfo = {
      type,
      message: typeof error === 'string' ? error : error.message,
      details: typeof error === 'string' ? undefined : error,
      timestamp: Date.now(),
      recoverable: this.isErrorRecoverable(type),
      retryCount: 0
    };

    this.currentError = errorInfo;

    // 记录错误日志
    this.logError(errorInfo);

    // 发出错误事件
    this.emit('error', errorInfo);

    // 如果错误可恢复且配置为自动重试，则开始重试
    if (errorInfo.recoverable && this.config.autoRetry) {
      this.retry();
    }
  }

  /**
   * 重试操作
   */
  public retry(): void {
    if (!this.currentError || !this.currentError.recoverable) {
      return;
    }

    if (this.currentError.retryCount >= this.config.maxRetries) {
      this.emit('retryFailed', this.currentError);
      return;
    }

    this.currentError.retryCount++;
    this.emit('retrying', this.currentError);

    // 设置重试定时器
    this.retryTimer = setTimeout(() => {
      this.emit('retry', this.currentError);
    }, this.config.retryDelay);
  }

  /**
   * 取消重试
   */
  public cancelRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.emit('retryCancelled', this.currentError);
  }

  /**
   * 清除当前错误
   */
  public clearError(): void {
    this.currentError = null;
    this.cancelRetry();
    this.emit('errorCleared');
  }

  /**
   * 获取当前错误
   */
  public getCurrentError(): ErrorInfo | null {
    return this.currentError;
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<ErrorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 判断错误是否可恢复
   */
  private isErrorRecoverable(type: ErrorType): boolean {
    switch (type) {
      case ErrorType.FILE_NOT_FOUND:
      case ErrorType.FILE_PERMISSION_DENIED:
      case ErrorType.FILE_LOCKED:
      case ErrorType.OPERATION_TIMEOUT:
      case ErrorType.OPERATION_FAILED:
      case ErrorType.SYSTEM_MEMORY_LOW:
        return true;
      default:
        return false;
    }
  }

  /**
   * 记录错误日志
   */
  private logError(error: ErrorInfo): void {
    const logMessage = `[${error.type}] ${error.message}`;
    
    switch (this.config.logLevel) {
      case 'debug':
        console.debug(logMessage, error.details);
        break;
      case 'info':
        console.info(logMessage, error.details);
        break;
      case 'warn':
        console.warn(logMessage, error.details);
        break;
      case 'error':
        console.error(logMessage, error.details);
        break;
    }
  }
} 