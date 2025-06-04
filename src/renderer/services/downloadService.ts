/**
 * 文件下载服务
 */

import { EventEmitter } from 'events';
import { message } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import type { FileEntry } from '../../main/types/file';
import type { DownloadConfig } from '../components/Download/DownloadDialog';

const { ipcRenderer } = window.require('electron');

export interface DownloadProgress {
  transferred: number;
  total: number;
  percentage: number;
  speed: number;
  remainingTime: number;
  eta?: Date;
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
}

export class DownloadService extends EventEmitter {
  private tasks = new Map<string, DownloadTask>();
  private static instance: DownloadService;

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
        remainingTime: 0
      },
      startTime: new Date()
    };

    this.tasks.set(taskId, task);

    try {
      // 调用主进程开始下载
      const result = await ipcRenderer.invoke('download:start', {
        taskId,
        file,
        config
      });

      if (result.success) {
        // 更新任务状态
        task.status = 'downloading';
        this.tasks.set(taskId, task);

        // 显示开始下载通知
        this.showStartNotification(task);

        // 触发事件
        this.emit('download-started', task);

        return taskId;
      } else {
        throw new Error(result.error || '下载启动失败');
      }
    } catch (error) {
      // 下载启动失败
      task.status = 'error';
      task.error = (error as Error).message;
      this.tasks.set(taskId, task);

      message.error(`下载失败: ${(error as Error).message}`);
      this.emit('download-error', task);

      throw error;
    }
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
      this.tasks.set(taskId, task);
      this.emit('download-paused', task);
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

    try {
      await ipcRenderer.invoke('download:resume', taskId);
      task.status = 'downloading';
      this.tasks.set(taskId, task);
      this.emit('download-resumed', task);
    } catch (error) {
      console.error('恢复下载失败:', error);
      message.error('恢复下载失败');
    }
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
      await ipcRenderer.invoke('download:cancel', taskId);
      task.status = 'cancelled';
      task.endTime = new Date();
      this.tasks.set(taskId, task);
      this.emit('download-cancelled', task);
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
  }

  /**
   * 处理下载错误
   */
  private handleDownloadError(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'error';
    task.error = error;
    task.endTime = new Date();
    this.tasks.set(taskId, task);

    // 显示错误通知
    this.showErrorNotification(task);

    this.emit('download-error', task);
  }

  /**
   * 处理下载取消
   */
  private handleDownloadCancelled(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'cancelled';
    task.endTime = new Date();
    this.tasks.set(taskId, task);

    this.emit('download-cancelled', task);
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
