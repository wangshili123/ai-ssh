/**
 * 上传功能的 IPC 处理器
 * 处理渲染进程的上传请求
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { UploadConfig } from '../../renderer/services/transferService';
import { sftpManager } from '../services/sftp';
import { CompressionUploadService } from '../services/compressionUploadService';
import { ParallelUploadService } from '../services/parallelUploadService';

// 序列化的文件数据接口
interface SerializableFile {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  content?: Uint8Array; // 小文件才有content
}

// 大文件信息接口
interface LargeFileInfo {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

// 大文件上传任务信息
interface LargeUploadTaskInfo {
  id: string;
  files: LargeFileInfo[];
  config: UploadConfig;
  status: 'uploading' | 'paused' | 'cancelled';
  abortController?: AbortController;
  startTime: Date;
  currentFileIndex?: number;
  uploadedBytes?: number;
  tempFiles: Map<number, string>; // fileIndex -> tempFilePath
}

// 流式上传任务信息
interface StreamUploadTaskInfo {
  id: string;
  config: UploadConfig;
  status: 'uploading' | 'paused' | 'cancelled';
  abortController?: AbortController;
  startTime: Date;
  uploadedBytes?: number;
  lastTransferred?: number;
  lastUpdateTime?: Date;
  speedSamples?: Array<{ time: Date; bytes: number }>;
  currentFile?: {
    index: number;
    name: string;
    size: number;
    uploadedBytes: number;
    writeStream?: any; // SFTP写入流
    remotePath?: string;
    uploadedChunks?: Set<number>; // 已上传的块索引集合（用于并行上传）
    maxUploadedPosition?: number; // 最大已上传位置（用于流式进度）
  };
}

interface UploadTaskInfo {
  id: string;
  files: SerializableFile[];
  config: UploadConfig;
  status: 'uploading' | 'paused' | 'cancelled';
  abortController?: AbortController;
  startTime: Date;
  currentFileIndex?: number;
  uploadedBytes?: number;
}

/**
 * 上传 IPC 处理器类
 */
export class UploadIPCHandler {
  private tasks = new Map<string, UploadTaskInfo>();
  private largeTasks = new Map<string, LargeUploadTaskInfo>();
  private streamTasks = new Map<string, StreamUploadTaskInfo>();

  /**
   * 注册所有上传相关的 IPC 处理器
   */
  registerHandlers(): void {
    // 开始上传
    ipcMain.handle('upload:start', async (event, data: {
      taskId: string;
      files: SerializableFile[];
      config: UploadConfig;
    }) => {
      return await this.startUpload(data.taskId, data.files, data.config);
    });

    // 暂停上传
    ipcMain.handle('upload:pause', async (event, taskId: string) => {
      await this.pauseUpload(taskId);
    });

    // 恢复上传
    ipcMain.handle('upload:resume', async (event, taskId: string) => {
      await this.resumeUpload(taskId);
    });

    // 取消上传
    ipcMain.handle('upload:cancel', async (event, taskId: string) => {
      await this.cancelUpload(taskId);
    });

    // 大文件上传相关处理器
    ipcMain.handle('upload:start-large', async (event, data: {
      taskId: string;
      files: LargeFileInfo[];
      config: UploadConfig;
    }) => {
      return await this.startLargeUpload(data.taskId, data.files, data.config);
    });

    ipcMain.handle('upload:chunk', async (event, data: {
      taskId: string;
      fileIndex: number;
      chunkIndex: number;
      totalChunks: number;
      chunkData: Uint8Array;
      fileName: string;
      start: number;
      end: number;
    }) => {
      return await this.handleChunk(data);
    });

    ipcMain.handle('upload:complete-large', async (event, taskId: string) => {
      return await this.completeLargeUpload(taskId);
    });

    // 流式上传相关处理器（避免磁盘空间问题）
    ipcMain.handle('upload:start-stream', async (event, data: {
      taskId: string;
      fileName: string;
      fileSize: number;
      fileIndex: number;
      config: UploadConfig;
    }) => {
      return await this.startStreamUpload(data);
    });

    ipcMain.handle('upload:stream-chunk', async (event, data: {
      taskId: string;
      fileIndex: number;
      chunkIndex: number;
      totalChunks: number;
      chunkData: Uint8Array;
      fileName: string;
      start: number;
      end: number;
    }) => {
      return await this.handleStreamChunk(data);
    });

    ipcMain.handle('upload:complete-stream', async (event, data: {
      taskId: string;
      fileIndex: number;
      fileName: string;
    }) => {
      return await this.completeStreamUpload(data);
    });

    // 并行上传相关处理器
    ipcMain.handle('upload:start-parallel', async (event, data: {
      taskId: string;
      fileName: string;
      fileSize: number;
      fileIndex: number;
      totalChunks: number;
      maxParallelChunks: number;
      config: UploadConfig;
    }) => {
      return await this.startParallelUpload(data);
    });

    ipcMain.handle('upload:parallel-chunk', async (event, data: {
      taskId: string;
      fileIndex: number;
      chunkIndex: number;
      totalChunks: number;
      chunkData: Uint8Array;
      fileName: string;
      start: number;
      end: number;
    }) => {
      return await this.handleParallelChunk(data);
    });

    // 新的流式并行块处理器
    ipcMain.handle('upload:parallel-chunk-stream', async (event, data: {
      taskId: string;
      fileIndex: number;
      chunkIndex: number;
      totalChunks: number;
      chunkData: Uint8Array;
      fileName: string;
      start: number;
      end: number;
    }) => {
      return await this.handleParallelChunkStream(data);
    });

    ipcMain.handle('upload:complete-parallel', async (event, data: {
      taskId: string;
      fileIndex: number;
      fileName: string;
    }) => {
      return await this.completeParallelUpload(data);
    });
  }

  /**
   * 开始上传
   */
  async startUpload(taskId: string, files: SerializableFile[], config: UploadConfig): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[UploadIPCHandler] 开始上传任务 ${taskId}:`, {
        fileCount: files.length,
        remotePath: config.remotePath,
        useCompression: config.useCompression,
        useParallelTransfer: config.useParallelTransfer
      });

      // 创建任务信息
      const taskInfo: UploadTaskInfo = {
        id: taskId,
        files,
        config,
        status: 'uploading',
        abortController: new AbortController(),
        startTime: new Date(),
        currentFileIndex: 0,
        uploadedBytes: 0
      };

      this.tasks.set(taskId, taskInfo);

      // 开始实际的上传过程
      this.performUpload(taskInfo);

      return { success: true };
    } catch (error) {
      console.error('上传启动失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 暂停上传
   */
  async pauseUpload(taskId: string): Promise<void> {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      taskInfo.abortController?.abort();
      taskInfo.status = 'paused';
      this.notifyRenderer('upload-paused', { taskId });
    }
  }

  /**
   * 恢复上传
   */
  async resumeUpload(taskId: string): Promise<void> {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo && taskInfo.status === 'paused') {
      // 重新创建 AbortController
      taskInfo.abortController = new AbortController();
      taskInfo.status = 'uploading';
      
      // 从断点位置恢复上传
      this.performUpload(taskInfo);
    }
  }

  /**
   * 取消上传
   */
  async cancelUpload(taskId: string): Promise<void> {
    // 检查普通上传任务
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      taskInfo.abortController?.abort();
      taskInfo.status = 'cancelled';
      this.tasks.delete(taskId);
      this.notifyRenderer('upload-cancelled', { taskId });
      console.log(`普通上传任务 ${taskId} 已取消`);
      return;
    }

    // 检查大文件上传任务
    const largeTaskInfo = this.largeTasks.get(taskId);
    if (largeTaskInfo) {
      largeTaskInfo.abortController?.abort();
      largeTaskInfo.status = 'cancelled';
      this.largeTasks.delete(taskId);
      this.notifyRenderer('upload-cancelled', { taskId });
      console.log(`大文件上传任务 ${taskId} 已取消`);
      return;
    }

    // 检查流式上传任务
    const streamTaskInfo = this.streamTasks.get(taskId);
    if (streamTaskInfo) {
      streamTaskInfo.abortController?.abort();
      streamTaskInfo.status = 'cancelled';

      // 关闭写入流
      if (streamTaskInfo.currentFile?.writeStream) {
        try {
          streamTaskInfo.currentFile.writeStream.destroy();
          console.log(`[UploadIPCHandler] 关闭流式上传写入流: ${taskId}`);
        } catch (error) {
          console.warn(`[UploadIPCHandler] 关闭写入流失败: ${error}`);
        }
      }

      this.streamTasks.delete(taskId);
      this.notifyRenderer('upload-cancelled', { taskId });
      console.log(`流式上传任务 ${taskId} 已取消`);
      return;
    }

    console.warn(`未找到要取消的上传任务: ${taskId}`);
  }

  /**
   * 执行实际的上传操作
   */
  private async performUpload(taskInfo: UploadTaskInfo): Promise<void> {
    try {
      const { files, config } = taskInfo;
      
      for (let i = taskInfo.currentFileIndex || 0; i < files.length; i++) {
        // 检查是否被取消或暂停
        if (taskInfo.abortController?.signal.aborted) {
          return;
        }

        const file = files[i];
        taskInfo.currentFileIndex = i;

        // 更新当前文件信息
        this.notifyProgress(taskInfo.id, {
          currentFileIndex: i,
          currentFileName: file.name,
          filesCompleted: i,
          filesTotal: files.length
        });

        // 上传单个文件
        await this.uploadSingleFile(taskInfo, file, i);

        // 更新完成文件数
        this.notifyProgress(taskInfo.id, {
          filesCompleted: i + 1,
          filesTotal: files.length
        });
      }

      // 所有文件上传完成
      this.handleUploadCompleted(taskInfo.id);
    } catch (error) {
      console.error('上传过程中发生错误:', error);
      this.handleUploadError(taskInfo.id, (error as Error).message);
    }
  }

  /**
   * 上传单个文件
   */
  private async uploadSingleFile(taskInfo: UploadTaskInfo, file: SerializableFile, fileIndex: number): Promise<void> {
    const { config } = taskInfo;

    console.log(`[UploadIPCHandler] 开始上传文件: ${file.name}, 大小: ${file.size} bytes`);
    console.log(`[UploadIPCHandler] 上传配置 - 压缩: ${config.useCompression}, 并行: ${config.useParallelTransfer}`);

    // 创建临时文件路径
    const tempDir = path.join(require('os').tmpdir(), 'electerm-upload');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempFilePath = path.join(tempDir, `${Date.now()}_${file.name}`);

    try {
      // 将文件内容写入临时文件
      fs.writeFileSync(tempFilePath, Buffer.from(file.content!));

      // 构建远程文件路径
      const remotePath = path.posix.join(config.remotePath, file.name);
      const connectionId = `sftp-${config.sessionId}`;

      console.log(`[UploadIPCHandler] 选择上传策略 - 压缩: ${config.useCompression}, 并行: ${config.useParallelTransfer}`);

      // 根据配置选择上传策略
      if (config.useCompression && config.useParallelTransfer) {
        // 压缩+并行上传（先压缩，再并行上传压缩文件）
        await this.performCompressedParallelUpload(taskInfo, tempFilePath, remotePath, file, fileIndex);
      } else if (config.useCompression) {
        // 仅压缩上传
        await this.performCompressedUpload(taskInfo, tempFilePath, remotePath, file, fileIndex);
      } else if (config.useParallelTransfer && file.size > 50 * 1024 * 1024) {
        // 仅并行上传（大于50MB的文件）
        await this.performParallelUpload(taskInfo, tempFilePath, remotePath, file, fileIndex);
      } else {
        // 普通上传
        await this.performBasicUpload(taskInfo, tempFilePath, remotePath, file, fileIndex);
      }

      console.log(`[UploadIPCHandler] 文件上传完成: ${file.name}`);
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`[UploadIPCHandler] 清理临时文件: ${tempFilePath}`);
        } catch (error) {
          console.warn(`[UploadIPCHandler] 清理临时文件失败: ${error}`);
        }
      }
    }
  }

  /**
   * 执行压缩+并行上传
   */
  private async performCompressedParallelUpload(
    taskInfo: UploadTaskInfo,
    tempFilePath: string,
    remotePath: string,
    file: SerializableFile,
    fileIndex: number
  ): Promise<void> {
    console.log(`[UploadIPCHandler] 开始压缩+并行上传: ${file.name}`);

    await CompressionUploadService.performCompressedUpload({
      taskId: taskInfo.id,
      localFilePath: tempFilePath,
      remotePath,
      fileName: file.name,
      sessionId: taskInfo.config.sessionId,
      compressionMethod: (taskInfo.config.compressionMethod === 'none' ? 'auto' : taskInfo.config.compressionMethod) || 'auto',
      onProgress: (transferred, total, phase) => {
        this.updateUploadProgress(taskInfo, transferred, total, fileIndex, file.name, phase);
      },
      abortSignal: taskInfo.abortController?.signal
    });
  }

  /**
   * 执行仅压缩上传
   */
  private async performCompressedUpload(
    taskInfo: UploadTaskInfo,
    tempFilePath: string,
    remotePath: string,
    file: SerializableFile,
    fileIndex: number
  ): Promise<void> {
    console.log(`[UploadIPCHandler] 开始压缩上传: ${file.name}`);

    await CompressionUploadService.performCompressedUpload({
      taskId: taskInfo.id,
      localFilePath: tempFilePath,
      remotePath,
      fileName: file.name,
      sessionId: taskInfo.config.sessionId,
      compressionMethod: (taskInfo.config.compressionMethod === 'none' ? 'auto' : taskInfo.config.compressionMethod) || 'auto',
      onProgress: (transferred, total, phase) => {
        this.updateUploadProgress(taskInfo, transferred, total, fileIndex, file.name, phase);
      },
      abortSignal: taskInfo.abortController?.signal
    });
  }

  /**
   * 执行仅并行上传
   */
  private async performParallelUpload(
    taskInfo: UploadTaskInfo,
    tempFilePath: string,
    remotePath: string,
    file: SerializableFile,
    fileIndex: number
  ): Promise<void> {
    console.log(`[UploadIPCHandler] 开始并行上传: ${file.name}`);

    await ParallelUploadService.performParallelUpload({
      taskId: taskInfo.id,
      localFilePath: tempFilePath,
      remotePath,
      fileName: file.name,
      sessionId: taskInfo.config.sessionId,
      maxParallelChunks: taskInfo.config.maxParallelChunks || 4,
      onProgress: (transferred, total) => {
        this.updateUploadProgress(taskInfo, transferred, total, fileIndex, file.name);
      },
      abortSignal: taskInfo.abortController?.signal
    });
  }

  /**
   * 执行普通上传
   */
  private async performBasicUpload(
    taskInfo: UploadTaskInfo,
    tempFilePath: string,
    remotePath: string,
    file: SerializableFile,
    fileIndex: number
  ): Promise<void> {
    console.log(`[UploadIPCHandler] 开始普通上传: ${file.name}`);

    const connectionId = `sftp-${taskInfo.config.sessionId}`;

    await sftpManager.uploadFile(connectionId, tempFilePath, remotePath, {
      onProgress: (transferred, total) => {
        this.updateUploadProgress(taskInfo, transferred, total, fileIndex, file.name);
      },
      abortSignal: taskInfo.abortController?.signal
    });
  }

  /**
   * 更新上传进度
   */
  private updateUploadProgress(
    taskInfo: UploadTaskInfo,
    transferred: number,
    total: number,
    fileIndex: number,
    fileName: string,
    phase?: string
  ): void {
    // 计算总进度（之前文件的大小 + 当前文件已上传的大小）
    let totalUploaded = 0;
    for (let i = 0; i < fileIndex; i++) {
      totalUploaded += taskInfo.files[i].size;
    }
    totalUploaded += transferred;

    taskInfo.uploadedBytes = totalUploaded;

    // 计算整体进度百分比
    const totalSize = this.getTotalSize(taskInfo.files);
    const overallProgress = totalSize > 0 ? (totalUploaded / totalSize) * 100 : 0;

    // 通知进度更新
    this.notifyProgress(taskInfo.id, {
      transferred: totalUploaded,
      total: totalSize,
      percentage: overallProgress,
      speed: this.calculateSpeed(taskInfo),
      remainingTime: this.calculateRemainingTime(taskInfo),
      currentFileIndex: fileIndex,
      currentFileName: fileName,
      filesCompleted: fileIndex,
      filesTotal: taskInfo.files.length,
      compressionPhase: phase || 'uploading'  // 修正字段名
    });
  }

  /**
   * 计算总文件大小
   */
  private getTotalSize(files: SerializableFile[]): number {
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * 计算上传速度
   */
  private calculateSpeed(taskInfo: UploadTaskInfo): number {
    const elapsedTime = (Date.now() - taskInfo.startTime.getTime()) / 1000;
    return elapsedTime > 0 ? (taskInfo.uploadedBytes || 0) / elapsedTime : 0;
  }

  /**
   * 计算剩余时间
   */
  private calculateRemainingTime(taskInfo: UploadTaskInfo): number {
    const speed = this.calculateSpeed(taskInfo);
    const totalSize = this.getTotalSize(taskInfo.files);
    const remainingSize = totalSize - (taskInfo.uploadedBytes || 0);
    return speed > 0 ? remainingSize / speed : 0;
  }

  /**
   * 处理上传完成
   */
  private handleUploadCompleted(taskId: string): void {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      this.tasks.delete(taskId);
      this.notifyRenderer('upload-completed', { taskId, result: 'success' });
    }
  }

  /**
   * 处理上传错误
   */
  private handleUploadError(taskId: string, error: string): void {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      this.tasks.delete(taskId);
      this.notifyRenderer('upload-error', { taskId, error });
    }
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(taskId: string, progress: any): void {
    this.notifyRenderer('upload-progress', { taskId, progress });
  }

  /**
   * 开始大文件上传
   */
  async startLargeUpload(taskId: string, files: LargeFileInfo[], config: UploadConfig): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[UploadIPCHandler] 开始大文件上传任务 ${taskId}:`, {
        fileCount: files.length,
        remotePath: config.remotePath
      });

      // 创建大文件任务信息
      const taskInfo: LargeUploadTaskInfo = {
        id: taskId,
        files,
        config,
        status: 'uploading',
        abortController: new AbortController(),
        startTime: new Date(),
        currentFileIndex: 0,
        uploadedBytes: 0,
        tempFiles: new Map()
      };

      this.largeTasks.set(taskId, taskInfo);
      return { success: true };
    } catch (error) {
      console.error('大文件上传启动失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 处理文件块
   */
  async handleChunk(data: {
    taskId: string;
    fileIndex: number;
    chunkIndex: number;
    totalChunks: number;
    chunkData: Uint8Array;
    fileName: string;
    start: number;
    end: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const taskInfo = this.largeTasks.get(data.taskId);
      if (!taskInfo) {
        return { success: false, error: '任务不存在' };
      }

      // 创建临时文件路径
      const tempDir = path.join(require('os').tmpdir(), 'electerm-upload-large');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      let tempFilePath = taskInfo.tempFiles.get(data.fileIndex);
      if (!tempFilePath) {
        tempFilePath = path.join(tempDir, `${data.taskId}_${data.fileIndex}_${data.fileName}`);
        taskInfo.tempFiles.set(data.fileIndex, tempFilePath);
      }

      // 将块数据追加到临时文件
      fs.appendFileSync(tempFilePath, Buffer.from(data.chunkData));

      console.log(`[UploadIPCHandler] 文件块已写入: ${data.fileName} 块 ${data.chunkIndex + 1}/${data.totalChunks}`);

      // 如果是最后一个块，开始上传文件
      if (data.chunkIndex === data.totalChunks - 1) {
        await this.uploadLargeFile(taskInfo, data.fileIndex, tempFilePath);
      }

      return { success: true };
    } catch (error) {
      console.error('处理文件块失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 上传大文件
   */
  private async uploadLargeFile(taskInfo: LargeUploadTaskInfo, fileIndex: number, tempFilePath: string): Promise<void> {
    const file = taskInfo.files[fileIndex];
    const remotePath = path.posix.join(taskInfo.config.remotePath, file.name);
    const connectionId = `sftp-${taskInfo.config.sessionId}`;

    console.log(`[UploadIPCHandler] 开始上传大文件: ${tempFilePath} -> ${remotePath}`);

    try {
      await sftpManager.uploadFile(connectionId, tempFilePath, remotePath, {
        onProgress: (transferred, total) => {
          // 计算总进度
          let totalUploaded = 0;
          for (let i = 0; i < fileIndex; i++) {
            totalUploaded += taskInfo.files[i].size;
          }
          totalUploaded += transferred;

          taskInfo.uploadedBytes = totalUploaded;

          // 通知进度更新
          this.notifyProgress(taskInfo.id, {
            transferred: totalUploaded,
            total: this.getTotalSizeLarge(taskInfo.files),
            percentage: (totalUploaded / this.getTotalSizeLarge(taskInfo.files)) * 100,
            currentFileIndex: fileIndex,
            currentFileName: file.name,
            filesCompleted: fileIndex,
            filesTotal: taskInfo.files.length
          });
        },
        abortSignal: taskInfo.abortController?.signal
      });

      console.log(`[UploadIPCHandler] 大文件上传完成: ${file.name}`);
    } finally {
      // 清理临时文件
      if (fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`[UploadIPCHandler] 清理临时文件: ${tempFilePath}`);
        } catch (error) {
          console.warn(`[UploadIPCHandler] 清理临时文件失败: ${error}`);
        }
      }
      taskInfo.tempFiles.delete(fileIndex);
    }
  }

  /**
   * 完成大文件上传
   */
  async completeLargeUpload(taskId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const taskInfo = this.largeTasks.get(taskId);
      if (!taskInfo) {
        return { success: false, error: '任务不存在' };
      }

      this.largeTasks.delete(taskId);
      this.notifyRenderer('upload-completed', { taskId, result: 'success' });

      console.log(`[UploadIPCHandler] 大文件上传任务完成: ${taskId}`);
      return { success: true };
    } catch (error) {
      console.error('完成大文件上传失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 计算大文件总大小
   */
  private getTotalSizeLarge(files: LargeFileInfo[]): number {
    return files.reduce((total, file) => total + file.size, 0);
  }

  /**
   * 开始流式上传
   */
  async startStreamUpload(data: {
    taskId: string;
    fileName: string;
    fileSize: number;
    fileIndex: number;
    config: UploadConfig;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[UploadIPCHandler] 开始流式上传: ${data.fileName}`);

      let taskInfo = this.streamTasks.get(data.taskId);
      if (!taskInfo) {
        taskInfo = {
          id: data.taskId,
          config: data.config,
          status: 'uploading',
          abortController: new AbortController(),
          startTime: new Date(),
          uploadedBytes: 0
        };
        this.streamTasks.set(data.taskId, taskInfo);
      }

      // 设置当前文件信息
      const remotePath = path.posix.join(data.config.remotePath, data.fileName);
      taskInfo.currentFile = {
        index: data.fileIndex,
        name: data.fileName,
        size: data.fileSize,
        uploadedBytes: 0,
        remotePath
      };

      return { success: true };
    } catch (error) {
      console.error('开始流式上传失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 处理流式上传块
   */
  async handleStreamChunk(data: {
    taskId: string;
    fileIndex: number;
    chunkIndex: number;
    totalChunks: number;
    chunkData: Uint8Array;
    fileName: string;
    start: number;
    end: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const taskInfo = this.streamTasks.get(data.taskId);
      if (!taskInfo || !taskInfo.currentFile) {
        return { success: false, error: '任务不存在' };
      }

      // 检查任务是否被取消
      if (taskInfo.status === 'cancelled' || taskInfo.abortController?.signal.aborted) {
        console.log(`[UploadIPCHandler] 流式上传已取消: ${data.taskId}`);
        return { success: false, error: '上传已取消' };
      }

      const connectionId = `sftp-${taskInfo.config.sessionId}`;
      const remotePath = taskInfo.currentFile.remotePath!;

      // 如果是第一个块，创建写入流
      if (data.chunkIndex === 0) {
        console.log(`[UploadIPCHandler] 创建SFTP写入流: ${remotePath}`);
        const client = (sftpManager as any).getClient(connectionId);
        if (!client) {
          return { success: false, error: 'SFTP连接不存在' };
        }
        taskInfo.currentFile.writeStream = client.sftp.createWriteStream(remotePath);
      }

      // 写入块数据
      const writeStream = taskInfo.currentFile.writeStream;
      if (!writeStream) {
        return { success: false, error: '写入流不存在' };
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.write(Buffer.from(data.chunkData), (err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // 更新进度
      taskInfo.currentFile.uploadedBytes = data.end;
      taskInfo.uploadedBytes = (taskInfo.uploadedBytes || 0) + data.chunkData.length;

      // 更新速度采样
      this.updateSpeedSamples(taskInfo, data.end);

      // 发送进度通知
      const progress = (data.end / taskInfo.currentFile.size) * 100;
      this.notifyProgress(data.taskId, {
        transferred: data.end,
        total: taskInfo.currentFile.size,
        percentage: progress,
        speed: this.calculateStreamSpeed(taskInfo),
        remainingTime: this.calculateStreamRemainingTime(taskInfo),
        currentFileIndex: data.fileIndex,
        currentFileName: data.fileName,
        filesCompleted: data.fileIndex,
        filesTotal: 1, // 流式上传一次处理一个文件
        compressionPhase: 'uploading'  // 修正字段名
      });

      console.log(`[UploadIPCHandler] 流式块 ${data.chunkIndex + 1}/${data.totalChunks} 写入完成，进度: ${progress.toFixed(1)}%`);

      return { success: true };
    } catch (error) {
      console.error('处理流式上传块失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 完成流式上传
   */
  async completeStreamUpload(data: {
    taskId: string;
    fileIndex: number;
    fileName: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const taskInfo = this.streamTasks.get(data.taskId);
      if (!taskInfo || !taskInfo.currentFile) {
        return { success: false, error: '任务不存在' };
      }

      // 关闭写入流
      if (taskInfo.currentFile.writeStream) {
        await new Promise<void>((resolve, reject) => {
          taskInfo.currentFile!.writeStream.end((err: any) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }

      console.log(`[UploadIPCHandler] 流式上传完成: ${data.fileName}`);

      // 清理当前文件信息
      taskInfo.currentFile = undefined;

      return { success: true };
    } catch (error) {
      console.error('完成流式上传失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 更新速度采样
   */
  private updateSpeedSamples(taskInfo: StreamUploadTaskInfo, uploadedBytes: number): void {
    const now = new Date();

    if (!taskInfo.speedSamples) {
      taskInfo.speedSamples = [];
    }

    // 添加新的采样点
    taskInfo.speedSamples.push({
      time: now,
      bytes: uploadedBytes
    });

    // 只保留最近10秒的采样
    const tenSecondsAgo = new Date(now.getTime() - 10000);
    taskInfo.speedSamples = taskInfo.speedSamples.filter(sample => sample.time >= tenSecondsAgo);
  }

  /**
   * 计算流式上传速度（使用滑动窗口）
   */
  private calculateStreamSpeed(taskInfo: StreamUploadTaskInfo): number {
    if (!taskInfo.speedSamples || taskInfo.speedSamples.length < 2) {
      return 0;
    }

    // 使用最近的采样计算速度
    const samples = taskInfo.speedSamples;
    const latest = samples[samples.length - 1];
    const earliest = samples[0];

    const timeDiff = (latest.time.getTime() - earliest.time.getTime()) / 1000;
    const bytesDiff = latest.bytes - earliest.bytes;

    if (timeDiff <= 0) {
      return 0;
    }

    return bytesDiff / timeDiff;
  }

  /**
   * 计算流式上传剩余时间
   */
  private calculateStreamRemainingTime(taskInfo: StreamUploadTaskInfo): number {
    if (!taskInfo.currentFile) {
      return 0;
    }

    const speed = this.calculateStreamSpeed(taskInfo);
    if (speed <= 0) {
      return 0;
    }

    const remainingBytes = taskInfo.currentFile.size - taskInfo.currentFile.uploadedBytes;
    return Math.max(0, remainingBytes / speed);
  }



  /**
   * 开始并行上传
   */
  async startParallelUpload(data: {
    taskId: string;
    fileName: string;
    fileSize: number;
    fileIndex: number;
    totalChunks: number;
    maxParallelChunks: number;
    config: UploadConfig;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[UploadIPCHandler] 开始并行上传: ${data.fileName}, 文件大小: ${data.fileSize}, 并行数: ${data.maxParallelChunks}`);

      let taskInfo = this.streamTasks.get(data.taskId);
      if (!taskInfo) {
        taskInfo = {
          id: data.taskId,
          config: data.config,
          status: 'uploading',
          abortController: new AbortController(),
          startTime: new Date(),
          uploadedBytes: 0
        };
        this.streamTasks.set(data.taskId, taskInfo);
      }

      // 设置当前文件信息
      const remotePath = path.posix.join(data.config.remotePath, data.fileName);
      taskInfo.currentFile = {
        index: data.fileIndex,
        name: data.fileName,
        size: data.fileSize,
        uploadedBytes: 0,
        remotePath
      };

      // 异步创建远程文件，不等待完成就返回，加快启动速度
      const connectionId = `sftp-${data.config.sessionId}`;

      // 异步创建文件，不阻塞返回
      this.createEmptyRemoteFile(connectionId, remotePath)
        .then(() => {
          console.log(`[UploadIPCHandler] 远程文件已创建: ${remotePath}`);
        })
        .catch(error => {
          console.error(`[UploadIPCHandler] 创建远程文件失败: ${error}`);
        });

      console.log(`[UploadIPCHandler] 文件创建已启动，准备接收并行块`);

      return { success: true };
    } catch (error) {
      console.error('开始并行上传失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 处理并行上传块（写入文件的指定偏移位置）
   */
  async handleParallelChunk(data: {
    taskId: string;
    fileIndex: number;
    chunkIndex: number;
    totalChunks: number;
    chunkData: Uint8Array;
    fileName: string;
    start: number;
    end: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const taskInfo = this.streamTasks.get(data.taskId);
      if (!taskInfo || !taskInfo.currentFile) {
        return { success: false, error: '任务不存在' };
      }

      // 检查任务是否被取消
      if (taskInfo.status === 'cancelled' || taskInfo.abortController?.signal.aborted) {
        console.log(`[UploadIPCHandler] 并行上传已取消: ${data.taskId}`);
        return { success: false, error: '上传已取消' };
      }

      const connectionId = `sftp-${taskInfo.config.sessionId}`;
      const remotePath = taskInfo.currentFile.remotePath!;

      // 直接写入远程文件的指定偏移位置（使用优化的并行写入）
      await this.writeChunkToRemoteFileOptimized(connectionId, remotePath, Buffer.from(data.chunkData), data.start);

      // 更新进度 - 使用实际字节位置而不是块数量
      if (!taskInfo.currentFile.uploadedChunks) {
        taskInfo.currentFile.uploadedChunks = new Set();
      }

      // 记录已完成的块
      taskInfo.currentFile.uploadedChunks.add(data.chunkIndex);

      // 计算实际已上传的字节数 - 使用最大的end位置
      if (!taskInfo.currentFile.maxUploadedPosition) {
        taskInfo.currentFile.maxUploadedPosition = 0;
      }
      taskInfo.currentFile.maxUploadedPosition = Math.max(taskInfo.currentFile.maxUploadedPosition, data.end);
      taskInfo.currentFile.uploadedBytes = Math.min(taskInfo.currentFile.maxUploadedPosition, taskInfo.currentFile.size);

      this.updateSpeedSamples(taskInfo, taskInfo.currentFile.uploadedBytes);

      // 发送进度通知 - 检查任务是否已取消
      if (taskInfo.status === 'uploading' && !taskInfo.abortController?.signal.aborted) {
        const progress = (taskInfo.currentFile.uploadedBytes / taskInfo.currentFile.size) * 100;
        this.notifyProgress(data.taskId, {
          transferred: taskInfo.currentFile.uploadedBytes,
          total: taskInfo.currentFile.size,
          percentage: progress,
          speed: this.calculateStreamSpeed(taskInfo),
          remainingTime: this.calculateStreamRemainingTime(taskInfo),
          currentFileIndex: data.fileIndex,
          currentFileName: data.fileName,
          filesCompleted: data.fileIndex,
          filesTotal: 1,
          compressionPhase: 'uploading'  // 修正字段名
        });
      }

      console.log(`[UploadIPCHandler] 并行块 ${data.chunkIndex + 1}/${data.totalChunks} 写入完成，位置: ${data.start}-${data.end}`);

      return { success: true };
    } catch (error) {
      console.error('处理并行上传块失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 处理流式并行上传块 - 在写入过程中提供流式进度反馈
   */
  async handleParallelChunkStream(data: {
    taskId: string;
    fileIndex: number;
    chunkIndex: number;
    totalChunks: number;
    chunkData: Uint8Array;
    fileName: string;
    start: number;
    end: number;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const taskInfo = this.streamTasks.get(data.taskId);
      if (!taskInfo || !taskInfo.currentFile) {
        return { success: false, error: '任务不存在' };
      }

      // 检查任务是否被取消
      if (taskInfo.status === 'cancelled' || taskInfo.abortController?.signal.aborted) {
        console.log(`[UploadIPCHandler] 流式并行上传已取消: ${data.taskId}`);
        return { success: false, error: '上传已取消' };
      }

      const connectionId = `sftp-${taskInfo.config.sessionId}`;
      const remotePath = taskInfo.currentFile.remotePath!;

      // 使用流式写入，在写入过程中提供进度反馈
      await this.writeChunkStreamWithProgress(connectionId, remotePath, Buffer.from(data.chunkData), data.start, data.end, taskInfo, data);

      console.log(`[UploadIPCHandler] 流式并行块 ${data.chunkIndex + 1}/${data.totalChunks} 写入完成，位置: ${data.start}-${data.end}`);

      return { success: true };
    } catch (error) {
      console.error('处理流式并行上传块失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 完成并行上传
   */
  async completeParallelUpload(data: {
    taskId: string;
    fileIndex: number;
    fileName: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      const taskInfo = this.streamTasks.get(data.taskId);
      if (!taskInfo || !taskInfo.currentFile) {
        return { success: false, error: '任务不存在' };
      }

      // 流写入模式不需要合并，文件已经完整写入
      console.log(`[UploadIPCHandler] 并行上传完成: ${data.fileName}`);

      // 清理当前文件信息
      taskInfo.currentFile = undefined;

      return { success: true };
    } catch (error) {
      console.error('完成并行上传失败:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * 创建空的远程文件 - 快速版本
   */
  private async createEmptyRemoteFile(connectionId: string, remotePath: string): Promise<void> {
    try {
      const client = (sftpManager as any).getClient(connectionId);
      if (!client) {
        throw new Error('SFTP连接不存在');
      }

      // 快速创建空文件，不预分配大小
      const writeStream = client.sftp.createWriteStream(remotePath);

      return new Promise((resolve, reject) => {
        writeStream.on('error', reject);
        writeStream.on('finish', resolve);

        // 创建空文件
        writeStream.end();
      });
    } catch (error) {
      throw new Error(`创建远程文件失败: ${error}`);
    }
  }



  /**
   * 优化的并行写入方法 - 使用连接池和文件句柄复用
   */
  private async writeChunkToRemoteFileOptimized(connectionId: string, remotePath: string, chunkData: Buffer, offset: number): Promise<void> {
    try {
      // 对于并行上传，直接使用SFTP方式，但优化文件句柄管理
      // 这样可以避免dd命令的复杂性，同时保持良好的性能
      const client = (sftpManager as any).getClient(connectionId);
      if (!client) {
        throw new Error('SFTP连接不存在');
      }

      // 使用SFTP的write方法直接写入到指定偏移位置
      await new Promise<void>((resolve, reject) => {
        // 先打开文件句柄
        client.sftp.open(remotePath, 'r+', (err: any, handle: any) => {
          if (err) {
            reject(err);
            return;
          }

          // 写入数据到指定偏移位置
          client.sftp.write(handle, chunkData, 0, chunkData.length, offset, (writeErr: any) => {
            // 关闭文件句柄
            client.sftp.close(handle, (closeErr: any) => {
              if (writeErr) {
                reject(writeErr);
              } else if (closeErr) {
                reject(closeErr);
              } else {
                resolve();
              }
            });
          });
        });
      });

      console.log(`[UploadIPCHandler] 优化块写入完成: 偏移 ${offset}, 大小: ${chunkData.length}`);

    } catch (error) {
      throw new Error(`优化写入远程文件块失败: ${error}`);
    }
  }

  /**
   * 流式写入方法 - 简化版本，一次性写入但提供进度反馈
   */
  private async writeChunkStreamWithProgress(
    connectionId: string,
    remotePath: string,
    chunkData: Buffer,
    start: number,
    end: number,
    taskInfo: StreamUploadTaskInfo,
    data: any
  ): Promise<void> {
    const writeStartTime = Date.now();

    try {
      const client = (sftpManager as any).getClient(connectionId);
      if (!client) {
        throw new Error('SFTP连接不存在');
      }

      // 一次性写入整个块，但立即更新进度
      await new Promise<void>((resolve, reject) => {
        // 先打开文件句柄
        client.sftp.open(remotePath, 'r+', (err: any, handle: any) => {
          if (err) {
            reject(err);
            return;
          }

          // 写入整个块
          client.sftp.write(handle, chunkData, 0, chunkData.length, start, (writeErr: any) => {
            // 关闭文件句柄
            client.sftp.close(handle, (closeErr: any) => {
              if (writeErr) {
                reject(writeErr);
              } else if (closeErr) {
                reject(closeErr);
              } else {
                // 写入完成后立即更新进度
                if (!taskInfo.currentFile!.maxUploadedPosition) {
                  taskInfo.currentFile!.maxUploadedPosition = 0;
                }
                taskInfo.currentFile!.maxUploadedPosition = Math.max(taskInfo.currentFile!.maxUploadedPosition, end);
                taskInfo.currentFile!.uploadedBytes = Math.min(taskInfo.currentFile!.maxUploadedPosition, taskInfo.currentFile!.size);

                this.updateSpeedSamples(taskInfo, taskInfo.currentFile!.uploadedBytes);

                // 发送进度通知 - 检查任务是否已取消
                if (taskInfo.status === 'uploading' && !taskInfo.abortController?.signal.aborted) {
                  const progress = (taskInfo.currentFile!.uploadedBytes / taskInfo.currentFile!.size) * 100;
                  this.notifyProgress(data.taskId, {
                    transferred: taskInfo.currentFile!.uploadedBytes,
                    total: taskInfo.currentFile!.size,
                    percentage: progress,
                    speed: this.calculateStreamSpeed(taskInfo),
                    remainingTime: this.calculateStreamRemainingTime(taskInfo),
                    currentFileIndex: data.fileIndex,
                    currentFileName: data.fileName,
                    filesCompleted: data.fileIndex,
                    filesTotal: 1,
                    compressionPhase: 'uploading'  // 修正字段名
                  });
                }

                resolve();
              }
            });
          });
        });
      });

      // 计算写入性能统计
      const writeTime = Date.now() - writeStartTime;
      const throughputMBps = (chunkData.length / 1024 / 1024) / (writeTime / 1000); // MB/s
      const progress = (end / taskInfo.currentFile!.size * 100).toFixed(1);

      console.log(`[UploadIPCHandler] 流式块写入完成: 偏移 ${start}, 大小: ${(chunkData.length/1024/1024).toFixed(2)}MB, 进度: ${progress}%, 写入速度: ${throughputMBps.toFixed(2)}MB/s, 耗时: ${writeTime}ms`);

    } catch (error) {
      throw new Error(`流式写入远程文件块失败: ${error}`);
    }
  }

  /**
   * 向渲染进程发送通知
   */
  private notifyRenderer(channel: string, data: any): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach(window => {
      if (!window.isDestroyed()) {
        window.webContents.send(channel, data);
      }
    });
  }
}

// 创建并导出单例实例
export const uploadIPCHandler = new UploadIPCHandler();
