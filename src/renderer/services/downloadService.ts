/**
 * 文件下载服务
 * 重构为继承统一传输服务，保持向后兼容
 */

import { message } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import type { FileEntry } from '../../main/types/file';
import {
  TransferService,
  DownloadTask,
  DownloadConfig,
  TransferProgress,
  TransferStatus
} from './transferService';
import { CompressionStrategySelector } from './compressionStrategy';

const { ipcRenderer } = window.require('electron');

// 重新导出类型以保持向后兼容
export type { DownloadTask, DownloadConfig, TransferProgress as DownloadProgress, TransferChunk as DownloadChunk } from './transferService';

export class DownloadService extends TransferService {
  private static instance: DownloadService;

  constructor() {
    super();
  }

  static getInstance(): DownloadService {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  /**
   * 设置IPC监听器
   */
  protected setupIPCListeners(): void {
    // 监听下载进度更新
    ipcRenderer.on('download-progress', (_event: any, data: { taskId: string; progress: TransferProgress }) => {
      this.updateTaskProgress(data.taskId, data.progress);
    });

    // 监听下载完成
    ipcRenderer.on('download-completed', (_event: any, data: { taskId: string; filePath: string }) => {
      this.handleTransferCompleted(data.taskId, data.filePath);
    });

    // 监听下载错误
    ipcRenderer.on('download-error', (_event: any, data: { taskId: string; error: string }) => {
      this.handleTransferError(data.taskId, data.error);
    });

    // 监听下载取消
    ipcRenderer.on('download-cancelled', (_event: any, data: { taskId: string }) => {
      const task = this.tasks.get(data.taskId);
      if (task) {
        task.status = 'cancelled';
        task.endTime = new Date();
        this.tasks.set(data.taskId, task);
        this.emit('download-cancelled', task);
      }
    });

    // 监听下载暂停
    ipcRenderer.on('download-paused', (_event: any, data: { taskId: string }) => {
      const task = this.tasks.get(data.taskId);
      if (task) {
        task.status = 'paused';
        this.tasks.set(data.taskId, task);
        this.emit('download-paused', task);
      }
    });

    // 监听下载恢复
    ipcRenderer.on('download-resumed', (_event: any, data: { taskId: string }) => {
      const task = this.tasks.get(data.taskId);
      if (task) {
        task.status = 'downloading';
        this.tasks.set(data.taskId, task);
        this.emit('download-resumed', task);
      }
    });
  }

  /**
   * 实现基类的抽象方法 - 发送IPC命令
   */
  protected async sendIPCCommand(command: string, taskId: string, data?: any): Promise<any> {
    return await ipcRenderer.invoke(`download:${command}`, taskId, data);
  }

  /**
   * 实现基类的抽象方法 - 获取活动状态
   */
  protected getActiveStatus(): TransferStatus {
    return 'downloading';
  }

  /**
   * 实现基类的抽象方法 - 实际开始传输
   */
  protected async startActualTransfer(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId) as DownloadTask;
    if (!task) return;

    this.activeTransfers.add(taskId);

    try {
      console.log(`[DownloadService] 发送下载请求到主进程:`, {
        taskId,
        file: task.file.name,
        config: task.config
      });

      const result = await ipcRenderer.invoke('download:start', {
        taskId,
        file: task.file,
        config: task.config
      });

      if (result.success) {
        task.status = 'downloading';
        this.tasks.set(taskId, task);
        this.showStartNotification(task);
        this.emit('download-started', task);
      } else {
        // 检查是否是不可重试的错误
        const errorMessage = result.error || '下载启动失败';
        const nonRetryableErrors = [
          '文件已存在',
          '无法创建下载目录',
          '权限不足',
          '磁盘空间不足'
        ];

        const isNonRetryable = nonRetryableErrors.some(err => errorMessage.includes(err));

        if (isNonRetryable) {
          // 直接标记为失败，不重试
          this.activeTransfers.delete(taskId);
          task.status = 'error';
          task.error = errorMessage;
          task.endTime = new Date();
          this.tasks.set(taskId, task);
          this.emit('download-error', task);
        } else {
          throw new Error(errorMessage);
        }
      }
    } catch (error) {
      this.handleTransferError(taskId, (error as Error).message);
    }
  }

  /**
   * 显示开始下载通知
   */
  private showStartNotification(task: DownloadTask): void {
    message.info(`开始下载: ${task.file.name}`);
  }

  /**
   * 开始下载文件 - 保持向后兼容的API
   */
  async startDownload(file: FileEntry, config: DownloadConfig): Promise<string> {
    return this.startTransfer({ file, config });
  }

  /**
   * 实现基类的抽象方法
   */
  async startTransfer(data: { file: FileEntry; config: DownloadConfig }): Promise<string> {
    const { file, config } = data;
    const taskId = uuidv4();

    // 分析压缩策略
    const compressionStrategy = CompressionStrategySelector.selectStrategy(file, config);
    const optimizationUsed: string[] = [];

    if (config.useCompression && compressionStrategy.enabled) {
      optimizationUsed.push(`压缩传输(${compressionStrategy.method})`);
    }

    if (config.useParallelTransfer && file.size > 10 * 1024 * 1024) {
      optimizationUsed.push(`并行下载(${config.maxParallelChunks || 4}块)`);
    }

    // 创建下载任务
    const task: DownloadTask = {
      id: taskId,
      type: 'download',
      file,
      config,
      status: 'pending',
      progress: {
        transferred: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        remainingTime: 0,
        compressionPhase: config.useCompression && compressionStrategy.enabled ? 'compressing' : undefined,
        originalSize: file.size,
        compressedSize: config.useCompression && compressionStrategy.enabled ?
          Math.round(file.size * compressionStrategy.estimatedRatio) : file.size
      },
      startTime: new Date(),
      resumeSupported: true,
      resumePosition: 0,
      retryCount: 0,
      maxRetries: 3,
      compressionEnabled: config.useCompression && compressionStrategy.enabled,
      compressionMethod: compressionStrategy.enabled ? compressionStrategy.method : 'none',
      originalFileSize: file.size,
      compressedFileSize: compressionStrategy.enabled ?
        Math.round(file.size * compressionStrategy.estimatedRatio) : file.size,
      compressionRatio: compressionStrategy.estimatedRatio,
      optimizationUsed,
      parallelEnabled: config.useParallelTransfer && file.size > 10 * 1024 * 1024,
      maxParallelChunks: config.maxParallelChunks || 4,
      transferChunks: []
    };

    this.tasks.set(taskId, task);

    // 记录优化策略使用情况
    if (optimizationUsed.length > 0) {
      console.log(`[DownloadService] 任务 ${taskId} 启用优化策略:`, optimizationUsed);
    }

    // 添加到传输队列
    this.addToQueue(taskId);

    return taskId;
  }

  /**
   * 暂停下载 - 保持向后兼容的API
   */
  async pauseDownload(taskId: string): Promise<void> {
    return this.pauseTransfer(taskId);
  }

  /**
   * 恢复下载 - 保持向后兼容的API
   */
  async resumeDownload(taskId: string): Promise<void> {
    return this.resumeTransfer(taskId);
  }

  /**
   * 取消下载 - 保持向后兼容的API
   */
  async cancelDownload(taskId: string): Promise<void> {
    return this.cancelTransfer(taskId);
  }

  /**
   * 获取所有下载任务 - 重写以返回正确类型
   */
  getAllDownloadTasks(): DownloadTask[] {
    return Array.from(this.tasks.values()).filter(task => task.type === 'download') as DownloadTask[];
  }

  /**
   * 获取下载任务 - 重写以返回正确类型
   */
  getDownloadTask(taskId: string): DownloadTask | undefined {
    const task = this.getTask(taskId);
    return task && task.type === 'download' ? task as DownloadTask : undefined;
  }

  /**
   * 获取所有任务 - 保持向后兼容
   */
  getAllTasks(): DownloadTask[] {
    return this.getAllDownloadTasks();
  }

  /**
   * 清除已完成的任务
   */
  clearCompletedTasks(): void {
    const completedTasks = Array.from(this.tasks.values()).filter(task => 
      task.status === 'completed' || task.status === 'error' || task.status === 'cancelled'
    );
    
    completedTasks.forEach(task => {
      this.tasks.delete(task.id);
    });
    
    console.log(`[DownloadService] 清除了 ${completedTasks.length} 个已完成的任务`);
  }
}

// 导出单例实例
export const downloadService = DownloadService.getInstance();
