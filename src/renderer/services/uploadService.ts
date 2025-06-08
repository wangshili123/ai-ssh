/**
 * 文件上传服务
 * 继承统一传输服务，实现上传特有功能
 */

import { message } from 'antd';
import { 
  TransferService, 
  UploadTask, 
  UploadConfig, 
  TransferProgress,
  TransferStatus
} from './transferService';
import { v4 as uuidv4 } from 'uuid';

const { ipcRenderer } = window.require('electron');

/**
 * 上传服务类
 * 管理所有文件上传任务
 */
export class UploadService extends TransferService {
  private static instance: UploadService;

  constructor() {
    super();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): UploadService {
    if (!UploadService.instance) {
      UploadService.instance = new UploadService();
    }
    return UploadService.instance;
  }

  /**
   * 设置IPC监听器
   */
  protected setupIPCListeners(): void {
    // 监听上传进度更新
    ipcRenderer.on('upload-progress', (_event: any, data: { taskId: string; progress: TransferProgress }) => {
      this.updateTaskProgress(data.taskId, data.progress);
    });

    // 监听上传完成
    ipcRenderer.on('upload-completed', (_event: any, data: { taskId: string; result?: any }) => {
      this.handleUploadCompleted(data.taskId, data.result);
    });

    // 监听上传错误
    ipcRenderer.on('upload-error', (_event: any, data: { taskId: string; error: string }) => {
      this.handleUploadError(data.taskId, data.error);
    });

    // 监听上传取消
    ipcRenderer.on('upload-cancelled', (_event: any, data: { taskId: string }) => {
      this.handleUploadCancelled(data.taskId);
    });
  }

  /**
   * 开始上传文件
   */
  async startUpload(files: File[], config: UploadConfig): Promise<string> {
    const taskId = uuidv4();

    // 分析优化策略
    const optimizationUsed: string[] = [];
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    if (config.useCompression) {
      optimizationUsed.push(`压缩传输(${config.compressionMethod || 'auto'})`);
    }

    if (config.useParallelTransfer && totalSize > 10 * 1024 * 1024) {
      optimizationUsed.push(`并行上传(${config.maxParallelChunks || 4}块)`);
    }

    // 创建上传任务
    const task: UploadTask = {
      id: taskId,
      type: 'upload',
      localFiles: files,
      config,
      status: 'pending',
      progress: this.createInitialProgress(files),
      startTime: new Date(),
      retryCount: 0,
      maxRetries: 3,
      
      // 上传特有字段
      totalFiles: files.length,
      completedFiles: 0,
      currentFile: files[0],
      remotePath: config.remotePath,
      
      // 优化相关字段
      compressionEnabled: config.useCompression,
      compressionMethod: config.compressionMethod === 'auto' ? 'gzip' : config.compressionMethod,
      originalFileSize: totalSize,
      compressedFileSize: config.useCompression ? Math.round(totalSize * 0.7) : totalSize,
      compressionRatio: config.useCompression ? 0.7 : 1.0,
      optimizationUsed,
      
      // 并行传输相关字段
      parallelEnabled: config.useParallelTransfer && totalSize > 10 * 1024 * 1024,
      maxParallelChunks: config.maxParallelChunks || 4,
      transferChunks: []
    };

    this.tasks.set(taskId, task);

    // 记录优化策略使用情况
    if (optimizationUsed.length > 0) {
      console.log(`[UploadService] 任务 ${taskId} 启用优化策略:`, optimizationUsed);
    }

    // 添加到上传队列
    this.addToQueue(taskId);

    return taskId;
  }

  /**
   * 实现基类的抽象方法
   */
  async startTransfer(config: { files: File[]; config: UploadConfig }): Promise<string> {
    return this.startUpload(config.files, config.config);
  }

  /**
   * 实际开始上传
   */
  protected async startActualTransfer(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId) as UploadTask;
    if (!task) return;

    this.activeTransfers.add(taskId);

    try {
      console.log(`[UploadService] 发送上传请求到主进程:`, {
        taskId,
        files: task.localFiles.map(f => f.name),
        config: task.config
      });

      const result = await ipcRenderer.invoke('upload:start', {
        taskId,
        files: task.localFiles,
        config: task.config
      });

      if (result.success) {
        // 更新任务状态
        task.status = 'uploading';
        this.tasks.set(taskId, task);

        // 显示开始上传通知
        this.showStartNotification(task);

        // 触发事件
        this.emit('upload-started', task);
      } else {
        throw new Error(result.error || '上传启动失败');
      }
    } catch (error) {
      // 上传启动失败
      this.handleUploadStartError(taskId, error as Error);
    }
  }

  /**
   * 发送IPC命令
   */
  protected async sendIPCCommand(command: string, taskId: string, data?: any): Promise<any> {
    return await ipcRenderer.invoke(`upload:${command}`, taskId, data);
  }

  /**
   * 获取活动状态
   */
  protected getActiveStatus(): TransferStatus {
    return 'uploading';
  }

  /**
   * 创建初始进度信息
   */
  private createInitialProgress(files: File[]): TransferProgress {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    return {
      transferred: 0,
      total: totalSize,
      percentage: 0,
      speed: 0,
      remainingTime: 0,
      
      // 上传特有进度
      filesCompleted: 0,
      filesTotal: files.length,
      currentFileIndex: 0,
      currentFileName: files[0]?.name
    };
  }

  /**
   * 处理上传启动错误
   */
  private handleUploadStartError(taskId: string, error: Error): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.activeTransfers.delete(taskId);

    // 检查是否可以重试
    if (task.retryCount! < task.maxRetries!) {
      task.retryCount = (task.retryCount || 0) + 1;
      task.status = 'pending';
      this.tasks.set(taskId, task);

      // 延迟重试
      setTimeout(() => {
        this.addToQueue(taskId);
      }, 2000 * task.retryCount!);

      console.log(`上传任务 ${taskId} 将在 ${2 * task.retryCount!} 秒后重试 (${task.retryCount}/${task.maxRetries})`);
    } else {
      // 重试次数已用完，标记为失败
      task.status = 'error';
      task.error = error.message;
      task.endTime = new Date();
      this.tasks.set(taskId, task);

      message.error(`上传失败: ${error.message}`);
      this.emit('upload-error', task);
    }

    this.processQueue();
  }

  /**
   * 处理上传完成
   */
  private handleUploadCompleted(taskId: string, result?: any): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    this.handleTransferCompleted(taskId, result);

    // 显示完成通知
    this.showCompletedNotification(task as UploadTask);
  }

  /**
   * 处理上传错误
   */
  private handleUploadError(taskId: string, error: string): void {
    this.handleTransferError(taskId, error);
    
    const task = this.tasks.get(taskId);
    if (task && task.status === 'error') {
      // 显示错误通知
      this.showErrorNotification(task as UploadTask);
    }
  }

  /**
   * 处理上传取消
   */
  private handleUploadCancelled(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'cancelled';
    task.endTime = new Date();
    this.tasks.set(taskId, task);

    this.activeTransfers.delete(taskId);
    this.emit('upload-cancelled', task);
    this.processQueue();
  }

  /**
   * 显示开始上传通知
   */
  private showStartNotification(task: UploadTask): void {
    const fileCount = task.localFiles.length;
    const fileText = fileCount === 1 ? task.localFiles[0].name : `${fileCount}个文件`;
    
    message.info(`开始上传 ${fileText}`);
  }

  /**
   * 显示完成通知
   */
  private showCompletedNotification(task: UploadTask): void {
    const fileCount = task.localFiles.length;
    const fileText = fileCount === 1 ? task.localFiles[0].name : `${fileCount}个文件`;
    
    message.success(`上传完成: ${fileText}`);
  }

  /**
   * 显示错误通知
   */
  private showErrorNotification(task: UploadTask): void {
    const fileCount = task.localFiles.length;
    const fileText = fileCount === 1 ? task.localFiles[0].name : `${fileCount}个文件`;

    message.error(`上传失败: ${fileText} - ${task.error}`);
  }

  /**
   * 获取所有上传任务
   */
  getAllTasks(): UploadTask[] {
    return Array.from(this.tasks.values()).filter(task => task.type === 'upload') as UploadTask[];
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

    console.log(`[UploadService] 清除了 ${completedTasks.length} 个已完成的任务`);
  }
}

// 导出单例实例
export const uploadService = UploadService.getInstance();
