/**
 * 错误管理器
 * 负责处理编辑器中的各种错误，提供统一的错误处理机制
 */

import { EventEmitter } from 'events';
import { EditorEvents, EditorErrorType } from '../types/FileEditorTypes';

/**
 * 错误信息接口
 */
export interface ErrorInfo {
  type: EditorErrorType;
  message: string;
  timestamp: number;
  details?: any;
}

/**
 * 错误管理器类
 * 处理和分发编辑器中的各种错误
 */
export class ErrorManager extends EventEmitter {
  private errors: ErrorInfo[] = [];
  private maxErrorsToKeep: number = 50;

  /**
   * 构造函数
   */
  constructor() {
    super();
  }

  /**
   * 处理错误
   * @param type 错误类型
   * @param message 错误消息
   * @param details 错误详情（可选）
   */
  public handleError(type: EditorErrorType, message: string, details?: any): void {
    const errorInfo: ErrorInfo = {
      type,
      message,
      timestamp: Date.now(),
      details
    };

    // 添加到错误列表
    this.errors.unshift(errorInfo);

    // 限制错误列表大小
    if (this.errors.length > this.maxErrorsToKeep) {
      this.errors = this.errors.slice(0, this.maxErrorsToKeep);
    }

    // 触发错误事件
    this.emit(EditorEvents.ERROR_OCCURRED, errorInfo);

    // 根据错误类型执行特定操作
    switch (type) {
      case EditorErrorType.FILE_NOT_FOUND:
        console.error(`文件未找到: ${message}`);
        break;
      case EditorErrorType.PERMISSION_DENIED:
        console.error(`权限被拒绝: ${message}`);
        break;
      case EditorErrorType.FILE_TOO_LARGE:
        console.warn(`文件过大: ${message}`);
        break;
      case EditorErrorType.OPERATION_TIMEOUT:
        console.warn(`操作超时: ${message}`);
        break;
      case EditorErrorType.MODE_SWITCH_ERROR:
        console.error(`模式切换错误: ${message}`);
        break;
      default:
        console.error(`未知错误: ${message}`);
    }
  }

  /**
   * 获取最近的错误
   * @param count 要获取的错误数量
   * @returns 错误信息数组
   */
  public getRecentErrors(count: number = 10): ErrorInfo[] {
    return this.errors.slice(0, count);
  }

  /**
   * 获取特定类型的错误
   * @param type 错误类型
   * @param count 要获取的错误数量
   * @returns 错误信息数组
   */
  public getErrorsByType(type: EditorErrorType, count: number = 10): ErrorInfo[] {
    return this.errors
      .filter(error => error.type === type)
      .slice(0, count);
  }

  /**
   * 清除所有错误
   */
  public clearErrors(): void {
    this.errors = [];
    this.emit(EditorEvents.ERRORS_CLEARED);
  }

  /**
   * 设置要保留的最大错误数
   * @param count 错误数量
   */
  public setMaxErrorsToKeep(count: number): void {
    this.maxErrorsToKeep = count;
    
    // 如果当前错误数超过新的限制，裁剪列表
    if (this.errors.length > count) {
      this.errors = this.errors.slice(0, count);
    }
  }
} 