/**
 * 文件下载服务
 */

import { EventEmitter } from 'events';
import { message } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import type { FileEntry } from '../../main/types/file';
import type { DownloadConfig } from '../components/Download/DownloadDialog';
import { CompressionStrategySelector } from './compressionStrategy';

const { ipcRenderer } = window.require('electron');

export interface DownloadProgress {
  transferred: number;
  total: number;
  percentage: number;
  speed: number;
  remainingTime: number;
  eta?: Date;
  // 新增：压缩相关进度信息
  compressionPhase?: 'compressing' | 'downloading' | 'extracting' | 'completed';
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
}

export interface DownloadTask {
  id: string;
  file: FileEntry;
  config: DownloadConfig;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: DownloadProgress;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  // 断点续传相关字段
  resumeSupported?: boolean;
  resumePosition?: number;
  tempFilePath?: string;
  retryCount?: number;
  maxRetries?: number;
  // 新增：压缩优化相关字段
  compressionEnabled?: boolean;
  compressionMethod?: 'gzip' | 'bzip2' | 'xz' | 'none';
  originalFileSize?: number;
  compressedFileSize?: number;
  compressionRatio?: number;
  optimizationUsed?: string[]; // 记录使用了哪些优化策略
}

export class DownloadService extends EventEmitter {
  private tasks = new Map<string, DownloadTask>();
  private static instance: DownloadService;
  private maxConcurrentDownloads = 3; // 最大并发下载数
  private downloadQueue: string[] = []; // 下载队列
  private activeDownloads = new Set<string>(); // 活动下载任务

  constructor() {
    super();
    this.setupIPCListeners();
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
  private setupIPCListeners(): void {
    // 监听下载进度更新
    ipcRenderer.on('download-progress', (_event: any, data: { taskId: string; progress: DownloadProgress }) => {
      this.updateTaskProgress(data.taskId, data.progress);
    });

    // 监听下载完成
    ipcRenderer.on('download-completed', (_event: any, data: { taskId: string; filePath: string }) => {
      this.handleDownloadCompleted(data.taskId, data.filePath);
    });

    // 监听下载错误
    ipcRenderer.on('download-error', (_event: any, data: { taskId: string; error: string }) => {
      this.handleDownloadError(data.taskId, data.error);
    });

    // 监听下载取消
    ipcRenderer.on('download-cancelled', (_event: any, data: { taskId: string }) => {
      this.handleDownloadCancelled(data.taskId);
    });
  }



  /**
   * 开始下载文件
   */
  async startDownload(file: FileEntry, config: DownloadConfig): Promise<string> {
    const taskId = uuidv4();

    // 分析压缩策略
    const compressionStrategy = CompressionStrategySelector.selectStrategy(file, config);
    const optimizationUsed: string[] = [];

    if (config.useCompression && compressionStrategy.enabled) {
      optimizationUsed.push(`压缩传输(${compressionStrategy.method})`);
    }

    if (config.useParallelDownload && file.size > 10 * 1024 * 1024) {
      optimizationUsed.push(`并行下载(${config.maxParallelChunks || 4}块)`);
    }

    // 创建下载任务
    const task: DownloadTask = {
      id: taskId,
      file,
      config,
      status: 'pending',
      progress: {
        transferred: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        remainingTime: 0,
        // 压缩相关进度信息
        compressionPhase: config.useCompression && compressionStrategy.enabled ? 'compressing' : undefined,
        originalSize: file.size,
        compressedSize: config.useCompression && compressionStrategy.enabled ?
          Math.round(file.size * compressionStrategy.estimatedRatio) : file.size
      },
      startTime: new Date(),
      // 断点续传相关初始化
      resumeSupported: true,
      resumePosition: 0,
      retryCount: 0,
      maxRetries: 3,
      // 压缩优化相关字段
      compressionEnabled: config.useCompression && compressionStrategy.enabled,
      compressionMethod: compressionStrategy.enabled ? compressionStrategy.method : 'none',
      originalFileSize: file.size,
      compressedFileSize: compressionStrategy.enabled ?
        Math.round(file.size * compressionStrategy.estimatedRatio) : file.size,
      compressionRatio: compressionStrategy.estimatedRatio,
      optimizationUsed
    };

    this.tasks.set(taskId, task);

    // 记录优化策略使用情况
    if (optimizationUsed.length > 0) {
      console.log(`[DownloadService] 任务 ${taskId} 启用优化策略:`, optimizationUsed);
    }

    // 添加到下载队列
    this.addToQueue(taskId);

    return taskId;
  }

  /**
   * 暂停下载
   */
  async pauseDownload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'downloading') {
      return;
    }

    try {
      await ipcRenderer.invoke('download:pause', taskId);
      task.status = 'paused';
      // 保存当前下载位置用于断点续传
      task.resumePosition = task.progress.transferred;
      this.tasks.set(taskId, task);

      // 从活动下载中移除
      this.activeDownloads.delete(taskId);

      this.emit('download-paused', task);

      // 处理队列中的下一个任务
      this.processQueue();
    } catch (error) {
      console.error('暂停下载失败:', error);
      message.error('暂停下载失败');
    }
  }

  /**
   * 恢复下载
   */
  async resumeDownload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') {
      return;
    }

    // 重置状态为pending，然后添加到队列
    task.status = 'pending';
    this.tasks.set(taskId, task);

    // 添加到下载队列进行断点续传
    this.addToQueue(taskId);

    this.emit('download-resumed', task);
  }

  /**
   * 取消下载
   */
  async cancelDownload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'completed' || task.status === 'cancelled') {
      return;
    }

    try {
      // 从队列中移除（如果还在队列中）
      const queueIndex = this.downloadQueue.indexOf(taskId);
      if (queueIndex > -1) {
        this.downloadQueue.splice(queueIndex, 1);
      }

      // 从活动下载中移除
      this.activeDownloads.delete(taskId);

      await ipcRenderer.invoke('download:cancel', taskId);
      task.status = 'cancelled';
      task.endTime = new Date();
      this.tasks.set(taskId, task);
      this.emit('download-cancelled', task);

      // 处理队列中的下一个任务
      this.processQueue();
    } catch (error) {
      console.error('取消下载失败:', error);
      message.error('取消下载失败');
    }
  }

  /**
   * 获取下载任务
   */
  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有下载任务
   */
  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取活动的下载任务
   */
  getActiveTasks(): DownloadTask[] {
    return this.getAllTasks().filter(task =>
      task.status === 'downloading' || task.status === 'pending'
    );
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueLength: number;
    activeDownloads: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.downloadQueue.length,
      activeDownloads: this.activeDownloads.size,
      maxConcurrent: this.maxConcurrentDownloads
    };
  }

  /**
   * 设置最大并发下载数
   */
  setMaxConcurrentDownloads(max: number): void {
    this.maxConcurrentDownloads = Math.max(1, Math.min(10, max));
    // 如果增加了并发数，尝试处理队列
    this.processQueue();
  }

  /**
   * 暂停所有下载
   */
  async pauseAllDownloads(): Promise<void> {
    const downloadingTasks = this.getAllTasks().filter(task => task.status === 'downloading');
    for (const task of downloadingTasks) {
      await this.pauseDownload(task.id);
    }
  }

  /**
   * 恢复所有暂停的下载
   */
  async resumeAllDownloads(): Promise<void> {
    const pausedTasks = this.getAllTasks().filter(task => task.status === 'paused');
    for (const task of pausedTasks) {
      await this.resumeDownload(task.id);
    }
  }

  /**
   * 清除已完成和已取消的任务
   */
  clearCompletedTasks(): void {
    const tasksToRemove: string[] = [];
    this.tasks.forEach((task, taskId) => {
      if (task.status === 'completed' || task.status === 'cancelled') {
        tasksToRemove.push(taskId);
      }
    });

    tasksToRemove.forEach(taskId => {
      this.tasks.delete(taskId);
    });

    this.emit('tasks-cleared', tasksToRemove);
  }

  /**
   * 添加任务到下载队列
   */
  private addToQueue(taskId: string): void {
    this.downloadQueue.push(taskId);
    this.processQueue();
  }

  /**
   * 处理下载队列
   */
  private processQueue(): void {
    // 如果当前活动下载数已达到最大值，则等待
    if (this.activeDownloads.size >= this.maxConcurrentDownloads) {
      return;
    }

    // 从队列中取出下一个任务
    const taskId = this.downloadQueue.shift();
    if (!taskId) {
      return;
    }

    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') {
      // 继续处理下一个任务
      this.processQueue();
      return;
    }

    // 开始下载
    this.startActualDownload(taskId);
  }

  /**
   * 实际开始下载
   */
  private async startActualDownload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.activeDownloads.add(taskId);

    try {
      // 调用主进程开始下载
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
        // 更新任务状态
        task.status = 'downloading';
        this.tasks.set(taskId, task);

        // 显示开始下载通知
        this.showStartNotification(task);

        // 触发事件
        this.emit('download-started', task);
      } else {
        throw new Error(result.error || '下载启动失败');
      }
    } catch (error) {
      // 下载启动失败
      this.handleDownloadStartError(taskId, error as Error);
    }
  }

  /**
   * 处理下载启动错误
   */
  private handleDownloadStartError(taskId: string, error: Error): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.activeDownloads.delete(taskId);

    // 检查是否可以重试
    if (task.retryCount! < task.maxRetries!) {
      task.retryCount = (task.retryCount || 0) + 1;
      task.status = 'pending';
      this.tasks.set(taskId, task);

      // 延迟重试
      setTimeout(() => {
        this.addToQueue(taskId);
      }, 2000 * task.retryCount!);

      console.log(`下载任务 ${taskId} 将在 ${2 * task.retryCount!} 秒后重试 (${task.retryCount}/${task.maxRetries})`);
    } else {
      // 重试次数已用完，标记为失败
      task.status = 'error';
      task.error = error.message;
      task.endTime = new Date();
      this.tasks.set(taskId, task);

      message.error(`下载失败: ${error.message}`);
      this.emit('download-error', task);
    }

    // 继续处理队列中的下一个任务
    this.processQueue();
  }

  /**
   * 更新任务进度
   */
  private updateTaskProgress(taskId: string, progress: DownloadProgress): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.progress = progress;
    this.tasks.set(taskId, task);
    this.emit('download-progress', task);
  }

  /**
   * 处理下载完成
   */
  private handleDownloadCompleted(taskId: string, filePath: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // 从活动下载中移除
    this.activeDownloads.delete(taskId);

    task.status = 'completed';
    task.endTime = new Date();
    task.progress.percentage = 100;
    this.tasks.set(taskId, task);

    // 显示完成通知
    this.showCompletedNotification(task, filePath);

    // 如果设置了打开文件夹，则打开
    if (task.config.openFolder) {
      this.openFileFolder(filePath);
    }

    this.emit('download-completed', task);

    // 处理队列中的下一个任务
    this.processQueue();
  }

  /**
   * 处理下载错误
   */
  private handleDownloadError(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // 从活动下载中移除
    this.activeDownloads.delete(taskId);

    // 检查是否可以重试
    if (task.retryCount! < task.maxRetries!) {
      task.retryCount = (task.retryCount || 0) + 1;
      task.status = 'pending';
      this.tasks.set(taskId, task);

      // 延迟重试
      setTimeout(() => {
        this.addToQueue(taskId);
      }, 2000 * task.retryCount!);

      console.log(`下载任务 ${taskId} 将在 ${2 * task.retryCount!} 秒后重试 (${task.retryCount}/${task.maxRetries})`);
    } else {
      // 重试次数已用完，标记为失败
      task.status = 'error';
      task.error = error;
      task.endTime = new Date();
      this.tasks.set(taskId, task);

      // 显示错误通知
      this.showErrorNotification(task);

      this.emit('download-error', task);
    }

    // 处理队列中的下一个任务
    this.processQueue();
  }

  /**
   * 处理下载取消
   */
  private handleDownloadCancelled(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // 从活动下载中移除
    this.activeDownloads.delete(taskId);

    task.status = 'cancelled';
    task.endTime = new Date();
    this.tasks.set(taskId, task);

    this.emit('download-cancelled', task);

    // 处理队列中的下一个任务
    this.processQueue();
  }

  /**
   * 显示开始下载通知
   */
  private showStartNotification(task: DownloadTask): void {
    // 不再使用antd的notification，改为使用我们的通知管理器
    console.log('下载开始:', task.file.name);
  }

  /**
   * 显示下载完成通知
   */
  private showCompletedNotification(task: DownloadTask, filePath: string): void {
    // 使用简单的成功消息，详细的通知由通知管理器处理
    message.success(`下载完成: ${task.file.name}`);

    // 如果设置了打开文件夹，则打开
    if (task.config.openFolder) {
      this.openFileFolder(filePath);
    }
  }

  /**
   * 显示下载错误通知
   */
  private showErrorNotification(task: DownloadTask): void {
    // 使用简单的错误消息，详细的通知由通知管理器处理
    message.error(`下载失败: ${task.file.name}${task.error ? ' - ' + task.error : ''}`);
  }

  /**
   * 打开文件所在文件夹
   */
  private async openFileFolder(filePath: string): Promise<void> {
    try {
      await ipcRenderer.invoke('shell:show-item-in-folder', filePath);
    } catch (error) {
      console.error('打开文件夹失败:', error);
      message.error('打开文件夹失败');
    }
  }
}

// 导出单例
export const downloadService = DownloadService.getInstance();
