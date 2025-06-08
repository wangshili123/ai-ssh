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

      // 检查是否有大文件需要特殊处理
      const hasLargeFiles = task.localFiles.some(file => file.size > 100 * 1024 * 1024);

      if (hasLargeFiles) {
        // 对于包含大文件的上传，根据配置选择上传方式
        if (task.config.useParallelTransfer) {
          console.log(`[UploadService] 检测到大文件，使用并行上传模式`);
          await this.handleParallelUpload(taskId, task.localFiles, task.config);
        } else {
          console.log(`[UploadService] 检测到大文件，使用流式上传模式`);
          await this.handleLargeFileUpload(taskId, task.localFiles, task.config);
        }
      } else {
        // 小文件使用原有的内存加载方式
        const serializableFiles = await Promise.all(
          task.localFiles.map(async (file) => ({
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            content: new Uint8Array(await file.arrayBuffer())
          }))
        );

        const result = await ipcRenderer.invoke('upload:start', {
          taskId,
          files: serializableFiles,
          config: task.config
        });

        if (!result.success) {
          throw new Error(result.error || '上传启动失败');
        }
      }

      // 更新任务状态
      task.status = 'uploading';
      this.tasks.set(taskId, task);

      // 显示开始上传通知
      this.showStartNotification(task);

      // 触发事件
      this.emit('upload-started', task);
    } catch (error) {
      // 检查是否是取消相关的错误
      const errorMessage = (error as Error).message;
      const isCancelledError = errorMessage.includes('取消') ||
                             errorMessage.includes('cancelled') ||
                             errorMessage.includes('abort') ||
                             errorMessage.includes('已取消');

      if (isCancelledError) {
        console.log(`[UploadService] 上传被取消，不作为错误处理: ${errorMessage}`);
        this.handleUploadCancelled(taskId);
      } else {
        // 上传启动失败
        this.handleUploadStartError(taskId, error as Error);
      }
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

    // 如果任务已被取消，不重试
    if (task.status === 'cancelled') {
      console.log(`上传任务 ${taskId} 已取消，不重试启动错误`);
      return;
    }

    // 检查是否可以重试
    if (task.retryCount! < task.maxRetries!) {
      task.retryCount = (task.retryCount || 0) + 1;
      task.status = 'pending';
      this.tasks.set(taskId, task);

      // 延迟重试
      setTimeout(() => {
        // 重试前再次检查是否被取消
        const currentTask = this.tasks.get(taskId);
        if (currentTask && currentTask.status !== 'cancelled') {
          this.addToQueue(taskId);
        } else {
          console.log(`上传任务 ${taskId} 在重试前被取消`);
        }
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
    // 检查是否是取消相关的错误，如果是则不重试
    const isCancelledError = error.includes('取消') ||
                           error.includes('cancelled') ||
                           error.includes('abort') ||
                           error.includes('已取消');

    if (isCancelledError) {
      // 取消相关错误，直接标记为取消状态，不重试
      console.log(`[UploadService] 检测到取消错误，不重试: ${error}`);
      this.handleUploadCancelled(taskId);
      return;
    }

    // 其他错误正常处理（可能重试）
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
   * 处理并行上传（对于大文件，使用流式+并行的混合方式）
   */
  private async handleParallelUpload(taskId: string, files: File[], config: UploadConfig): Promise<void> {
    console.log(`[UploadService] 开始并行上传，任务ID: ${taskId}`);

    // 获取任务并更新状态
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'uploading';
      this.tasks.set(taskId, task);

      // 显示开始上传通知
      this.showStartNotification(task as UploadTask);

      // 触发事件
      this.emit('upload-started', task);
    }

    // 对于大文件的并行上传，使用专门的并行流式上传
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      console.log(`[UploadService] 开始并行流式上传文件 ${fileIndex + 1}/${files.length}: ${file.name}`);

      // 检查任务是否被取消
      const currentTask = this.tasks.get(taskId) as UploadTask;
      if (!currentTask || currentTask.status === 'cancelled') {
        console.log(`[UploadService] 并行上传已取消: ${taskId}`);
        return;
      }

      // 使用并行流式上传（避免内存问题）
      try {
        await this.uploadFileInParallelStreams(taskId, file, fileIndex, config);
      } catch (error) {
        console.error(`[UploadService] 并行上传文件失败: ${file.name}`, error);
        throw error;
      }
    }

    // 标记任务完成
    const task2 = this.tasks.get(taskId) as UploadTask;
    if (task2 && task2.status !== 'cancelled') {
      task2.status = 'completed';
      task2.progress.percentage = 100;
      this.tasks.set(taskId, task2);

      // 显示完成通知
      this.showCompletedNotification(task2);

      // 触发事件
      this.emit('upload-completed', task2);
    }
  }

  /**
   * 处理大文件上传（流式方式，避免磁盘空间问题）
   */
  private async handleLargeFileUpload(taskId: string, files: File[], config: UploadConfig): Promise<void> {
    console.log(`[UploadService] 开始大文件流式上传，任务ID: ${taskId}`);

    // 获取任务并更新状态
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'uploading';
      this.tasks.set(taskId, task);

      // 显示开始上传通知
      this.showStartNotification(task as UploadTask);

      // 触发事件
      this.emit('upload-started', task);
    }

    // 对于大文件，直接使用普通上传但分批处理
    // 避免将整个文件加载到内存或分割到磁盘
    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
      const file = files[fileIndex];
      console.log(`[UploadService] 开始流式上传文件 ${fileIndex + 1}/${files.length}: ${file.name}`);

      // 使用较小的块大小进行流式上传
      await this.uploadFileInStreams(taskId, file, fileIndex, config);
    }
  }

  /**
   * 流式上传单个文件（避免内存和磁盘空间问题）
   */
  private async uploadFileInStreams(taskId: string, file: File, fileIndex: number, config: UploadConfig): Promise<void> {
    const chunkSize = 5 * 1024 * 1024; // 5MB per chunk，减小块大小
    const totalChunks = Math.ceil(file.size / chunkSize);

    console.log(`[UploadService] 文件 ${file.name} 将分为 ${totalChunks} 个流式块上传`);

    // 通知主进程开始流式上传
    const startResult = await ipcRenderer.invoke('upload:start-stream', {
      taskId,
      fileName: file.name,
      fileSize: file.size,
      fileIndex,
      config
    });

    if (!startResult.success) {
      throw new Error(`开始流式上传失败: ${startResult.error}`);
    }

    // 逐块读取并上传，不在本地存储
    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      // 检查任务是否被取消
      const currentTask = this.tasks.get(taskId) as UploadTask;
      if (!currentTask || currentTask.status === 'cancelled') {
        console.log(`[UploadService] 流式上传已取消: ${taskId}`);
        return; // 直接返回，不抛出错误
      }

      const start = chunkIndex * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      // 读取块内容
      const chunkData = new Uint8Array(await chunk.arrayBuffer());

      // 直接发送块到主进程进行上传
      const result = await ipcRenderer.invoke('upload:stream-chunk', {
        taskId,
        fileIndex,
        chunkIndex,
        totalChunks,
        chunkData,
        fileName: file.name,
        start,
        end
      });

      if (!result.success) {
        // 如果是取消导致的失败，不抛出错误
        if (result.error?.includes('取消') || result.error?.includes('cancelled')) {
          console.log(`[UploadService] 流式上传被取消: ${taskId}`);
          return;
        }
        throw new Error(`上传文件块失败: ${result.error}`);
      }

      console.log(`[UploadService] 文件 ${file.name} 流式块 ${chunkIndex + 1}/${totalChunks} 上传完成`);
    }

    // 通知主进程文件上传完成
    await ipcRenderer.invoke('upload:complete-stream', {
      taskId,
      fileIndex,
      fileName: file.name
    });

    // 如果是最后一个文件，标记任务完成
    const task = this.tasks.get(taskId) as UploadTask;
    if (task && task.status !== 'cancelled' && fileIndex === task.localFiles.length - 1) {
      task.status = 'completed';
      task.progress.percentage = 100;
      this.tasks.set(taskId, task);

      // 显示完成通知
      this.showCompletedNotification(task);

      // 触发事件
      this.emit('upload-completed', task);
    }
  }

  /**
   * 并行流式上传单个文件（真正的并行上传）
   */
  private async uploadFileInParallelStreams(taskId: string, file: File, fileIndex: number, config: UploadConfig): Promise<void> {
    // 使用较小的块大小以获得更频繁的进度更新，同时保持并行性
    let chunkSize = 5 * 1024 * 1024; // 默认5MB，更频繁的进度更新
    if (file.size > 1024 * 1024 * 1024) { // 大于1GB的文件
      chunkSize = 10 * 1024 * 1024; // 10MB per chunk
    } else if (file.size > 100 * 1024 * 1024) { // 大于100MB的文件
      chunkSize = 8 * 1024 * 1024; // 8MB per chunk
    }

    const maxParallelChunks = config.maxParallelChunks || 8;
    const totalChunks = Math.ceil(file.size / chunkSize);

    console.log(`[UploadService] 文件 ${file.name} 将分为 ${totalChunks} 个块并行上传，最大并行数: ${maxParallelChunks}`);

    // 通知主进程开始并行上传
    const startResult = await ipcRenderer.invoke('upload:start-parallel', {
      taskId,
      fileName: file.name,
      fileSize: file.size,
      fileIndex,
      totalChunks,
      maxParallelChunks,
      config
    });

    if (!startResult.success) {
      throw new Error(`开始并行上传失败: ${startResult.error}`);
    }

    // 真正的并行上传 - 使用滑动窗口并行处理
    console.log(`[UploadService] 开始真正的并行上传，最大并行数: ${maxParallelChunks}`);

    let activeUploads = 0;
    let completedChunks = 0;
    let currentIndex = 0;

    await new Promise<void>((resolve, reject) => {
      const startNextUpload = () => {
        // 检查是否被取消
        const currentTask = this.tasks.get(taskId) as UploadTask;
        if (!currentTask || currentTask.status === 'cancelled') {
          console.log(`[UploadService] 并行上传已取消: ${taskId}`);
          resolve();
          return;
        }

        // 启动新的上传任务，直到达到最大并行数或没有更多块
        while (activeUploads < maxParallelChunks && currentIndex < totalChunks) {
          const chunkIndex = currentIndex++;
          activeUploads++;

          console.log(`[UploadService] 启动并行块 ${chunkIndex + 1}/${totalChunks}，当前活跃: ${activeUploads}`);

          this.uploadSingleChunk(taskId, file, fileIndex, chunkIndex, chunkSize, totalChunks)
            .then(() => {
              completedChunks++;
              activeUploads--;
              console.log(`[UploadService] 并行块 ${chunkIndex + 1}/${totalChunks} 完成，剩余活跃: ${activeUploads}, 已完成: ${completedChunks}`);

              // 检查是否全部完成
              if (completedChunks === totalChunks) {
                console.log(`[UploadService] 所有 ${totalChunks} 个块并行上传完成`);
                resolve();
              } else {
                // 启动下一个上传任务
                startNextUpload();
              }
            })
            .catch((error) => {
              activeUploads--;
              console.error(`[UploadService] 并行块 ${chunkIndex + 1}/${totalChunks} 失败:`, error);
              reject(error);
            });
        }
      };

      // 开始并行上传
      startNextUpload();
    });

    console.log(`[UploadService] 所有 ${totalChunks} 个块并行上传完成`);

    // 通知主进程合并文件
    await ipcRenderer.invoke('upload:complete-parallel', {
      taskId,
      fileIndex,
      fileName: file.name
    });
  }

  /**
   * 上传单个块 - 真正的并行上传，带流式进度反馈
   */
  private async uploadSingleChunk(
    taskId: string,
    file: File,
    fileIndex: number,
    chunkIndex: number,
    chunkSize: number,
    totalChunks: number
  ): Promise<void> {
    const start = chunkIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const chunk = file.slice(start, end);

    // 读取整个块内容（保持并行性）
    const chunkData = new Uint8Array(await chunk.arrayBuffer());

    // 发送整个块到主进程，使用流式写入和进度反馈
    const result = await ipcRenderer.invoke('upload:parallel-chunk-stream', {
      taskId,
      fileIndex,
      chunkIndex,
      totalChunks,
      chunkData,
      fileName: file.name,
      start,
      end
    });

    if (!result.success) {
      // 如果是取消导致的失败，不抛出错误
      if (result.error?.includes('取消') || result.error?.includes('cancelled')) {
        console.log(`[UploadService] 并行上传块被取消: ${taskId}`);
        return;
      }
      throw new Error(`上传文件块失败: ${result.error}`);
    }

    console.log(`[UploadService] 文件 ${file.name} 并行块 ${chunkIndex + 1}/${totalChunks} 上传完成`);
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
