/**
 * 统一传输服务基类
 * 为上传和下载功能提供统一的架构和接口
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import type { FileEntry } from '../../main/types/file';

const { ipcRenderer } = window.require('electron');

// 统一的传输状态
export type TransferStatus = 'pending' | 'downloading' | 'uploading' | 'paused' | 'completed' | 'error' | 'cancelled';

// 统一的传输进度接口
export interface TransferProgress {
  transferred: number;
  total: number;
  percentage: number;
  speed: number;
  remainingTime: number;
  eta?: Date;
  
  // 压缩相关进度信息
  compressionPhase?: 'compressing' | 'transferring' | 'extracting' | 'completed';
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  
  // 并行传输相关进度信息
  transferChunks?: TransferChunk[];
  parallelEnabled?: boolean;
  activeChunks?: number;
  
  // 上传特有进度
  currentFileIndex?: number;
  currentFileName?: string;
  filesCompleted?: number;
  filesTotal?: number;
}

// 传输分块接口
export interface TransferChunk {
  id: number;
  start: number;
  end: number;
  size: number;
  transferred: number;
  status: 'pending' | 'transferring' | 'completed' | 'error';
  error?: string;
  retryCount: number;
}

// 基础传输配置接口
export interface BaseTransferConfig {
  sessionId: string;
  overwrite: boolean;
  // 优化选项
  useCompression?: boolean;
  compressionMethod?: 'auto' | 'gzip' | 'bzip2' | 'xz' | 'none';
  useParallelTransfer?: boolean;
  maxParallelChunks?: number;
}

// 下载配置接口（保持兼容）
export interface DownloadConfig extends BaseTransferConfig {
  savePath: string;
  fileName: string;
  openFolder: boolean;
}

// 上传配置接口
export interface UploadConfig extends BaseTransferConfig {
  remotePath: string;
  preservePermissions: boolean;
  createDirectories?: boolean;
  conflictResolution?: 'overwrite' | 'skip' | 'rename';
}

// 统一传输配置类型
export type TransferConfig = DownloadConfig | UploadConfig;

// 基础传输任务接口
export interface BaseTransferTask {
  id: string;
  type: 'download' | 'upload';
  status: TransferStatus;
  progress: TransferProgress;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  
  // 断点续传相关字段
  resumeSupported?: boolean;
  resumePosition?: number;
  tempFilePath?: string;
  retryCount?: number;
  maxRetries?: number;
  
  // 优化相关字段
  compressionEnabled?: boolean;
  compressionMethod?: 'gzip' | 'bzip2' | 'xz' | 'none';
  originalFileSize?: number;
  compressedFileSize?: number;
  compressionRatio?: number;
  optimizationUsed?: string[];
  
  // 并行传输相关字段
  parallelEnabled?: boolean;
  maxParallelChunks?: number;
  transferChunks?: TransferChunk[];
}

// 下载任务接口（向后兼容）
export interface DownloadTask extends BaseTransferTask {
  type: 'download';
  file: FileEntry;
  config: DownloadConfig;
}

// 上传任务接口
export interface UploadTask extends BaseTransferTask {
  type: 'upload';
  localFiles: File[];
  config: UploadConfig;
  // 上传特有字段
  totalFiles: number;
  completedFiles: number;
  currentFile?: File;
  remotePath: string;
}

// 统一传输任务类型
export type TransferTask = DownloadTask | UploadTask;

/**
 * 统一传输服务基类
 * 提供传输任务的通用管理功能
 */
export abstract class TransferService extends EventEmitter {
  protected tasks = new Map<string, TransferTask>();
  protected maxConcurrentTransfers = 3;
  protected transferQueue: string[] = [];
  protected activeTransfers = new Set<string>();

  constructor() {
    super();
    this.setupIPCListeners();
  }

  /**
   * 设置IPC监听器 - 子类需要实现具体的监听逻辑
   */
  protected abstract setupIPCListeners(): void;

  /**
   * 开始传输 - 子类需要实现具体的传输逻辑
   */
  abstract startTransfer(config: any): Promise<string>;

  /**
   * 暂停传输
   */
  async pauseTransfer(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !this.canPause(task.status)) {
      return;
    }

    try {
      await this.sendIPCCommand('pause', taskId);
      task.status = 'paused';
      task.resumePosition = task.progress.transferred;
      this.tasks.set(taskId, task);

      this.activeTransfers.delete(taskId);
      this.emit(`${task.type}-paused`, task);
      this.processQueue();
    } catch (error) {
      console.error('暂停传输失败:', error);
      throw error;
    }
  }

  /**
   * 恢复传输
   */
  async resumeTransfer(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') {
      return;
    }

    try {
      // 发送恢复命令到主进程，主进程会处理断点续传
      await this.sendIPCCommand('resume', taskId);

      // 更新任务状态，但不重新加入队列
      // 主进程会直接从断点继续下载并发送进度更新
      task.status = this.getActiveStatus();
      this.tasks.set(taskId, task);
      this.activeTransfers.add(taskId);

      this.emit(`${task.type}-resumed`, task);
    } catch (error) {
      console.error('恢复传输失败:', error);
      throw error;
    }
  }

  /**
   * 取消传输
   */
  async cancelTransfer(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return;
    }

    try {
      await this.sendIPCCommand('cancel', taskId);
      task.status = 'cancelled';
      task.endTime = new Date();
      this.tasks.set(taskId, task);

      this.activeTransfers.delete(taskId);
      this.emit(`${task.type}-cancelled`, task);
      this.processQueue();
    } catch (error) {
      console.error('取消传输失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): TransferTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 按类型获取任务
   */
  getTasksByType(type: 'download' | 'upload'): TransferTask[] {
    return this.getAllTasks().filter(task => task.type === type);
  }

  /**
   * 获取指定任务
   */
  getTask(taskId: string): TransferTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 清除已完成的任务
   */
  clearCompletedTasks(): void {
    const completedTasks = Array.from(this.tasks.entries())
      .filter(([_, task]) => task.status === 'completed' || task.status === 'cancelled');
    
    completedTasks.forEach(([taskId, task]) => {
      this.tasks.delete(taskId);
      this.emit(`${task.type}-removed`, task);
    });

    this.emit('tasks-cleared');
  }

  /**
   * 添加任务到队列
   */
  protected addToQueue(taskId: string): void {
    if (!this.transferQueue.includes(taskId)) {
      this.transferQueue.push(taskId);
      this.processQueue();
    }
  }

  /**
   * 处理传输队列
   */
  protected processQueue(): void {
    if (this.activeTransfers.size >= this.maxConcurrentTransfers) {
      return;
    }

    const taskId = this.transferQueue.shift();
    if (!taskId) {
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task || (task.status !== 'pending' && task.status !== this.getActiveStatus())) {
      this.processQueue();
      return;
    }

    this.startActualTransfer(taskId);
  }

  /**
   * 实际开始传输 - 子类需要实现
   */
  protected abstract startActualTransfer(taskId: string): Promise<void>;

  /**
   * 发送IPC命令 - 子类需要实现
   */
  protected abstract sendIPCCommand(command: string, taskId: string, data?: any): Promise<any>;

  /**
   * 获取活动状态 - 子类需要实现
   */
  protected abstract getActiveStatus(): TransferStatus;

  /**
   * 检查是否可以暂停 - 子类可以重写
   */
  protected canPause(status: TransferStatus): boolean {
    return status === 'downloading' || status === 'uploading';
  }

  /**
   * 更新任务进度
   */
  protected updateTaskProgress(taskId: string, progress: TransferProgress): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.progress = { ...task.progress, ...progress };
    this.tasks.set(taskId, task);

    this.emit(`${task.type}-progress`, task);
  }

  /**
   * 处理传输完成
   */
  protected handleTransferCompleted(taskId: string, result?: any): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.activeTransfers.delete(taskId);
    task.status = 'completed';
    task.endTime = new Date();
    task.progress.percentage = 100;
    this.tasks.set(taskId, task);

    this.emit(`${task.type}-completed`, task);
    this.processQueue();
  }

  /**
   * 处理传输错误
   */
  protected handleTransferError(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.activeTransfers.delete(taskId);

    // 如果任务已经被标记为取消，不进行重试
    if (task.status === 'cancelled') {
      console.log(`传输任务 ${taskId} 已取消，不重试`);
      return;
    }

    // 检查是否可以重试
    if (task.retryCount! < task.maxRetries!) {
      task.retryCount = (task.retryCount || 0) + 1;
      task.status = 'pending';
      this.tasks.set(taskId, task);

      // 延迟重试
      setTimeout(() => {
        // 重试前再次检查任务是否被取消
        const currentTask = this.tasks.get(taskId);
        if (currentTask && currentTask.status !== 'cancelled') {
          this.addToQueue(taskId);
        } else {
          console.log(`传输任务 ${taskId} 在重试前被取消`);
        }
      }, 2000 * task.retryCount!);

      console.log(`传输任务 ${taskId} 将在 ${2 * task.retryCount!} 秒后重试 (${task.retryCount}/${task.maxRetries})`);
    } else {
      // 重试次数已用完，标记为失败
      task.status = 'error';
      task.error = error;
      task.endTime = new Date();
      this.tasks.set(taskId, task);

      this.emit(`${task.type}-error`, task);
    }

    this.processQueue();
  }
}
