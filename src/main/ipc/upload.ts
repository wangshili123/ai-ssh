/**
 * 上传功能的 IPC 处理器
 * 处理渲染进程的上传请求
 */

import { ipcMain, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { UploadConfig } from '../../renderer/services/transferService';

interface UploadTaskInfo {
  id: string;
  files: File[];
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

  /**
   * 注册所有上传相关的 IPC 处理器
   */
  registerHandlers(): void {
    // 开始上传
    ipcMain.handle('upload:start', async (event, data: {
      taskId: string;
      files: File[];
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
  }

  /**
   * 开始上传
   */
  async startUpload(taskId: string, files: File[], config: UploadConfig): Promise<{ success: boolean; error?: string }> {
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
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      taskInfo.abortController?.abort();
      taskInfo.status = 'cancelled';
      this.tasks.delete(taskId);
      this.notifyRenderer('upload-cancelled', { taskId });
    }
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
  private async uploadSingleFile(taskInfo: UploadTaskInfo, file: File, fileIndex: number): Promise<void> {
    const { config } = taskInfo;
    
    // 模拟文件上传过程
    // 在实际实现中，这里会调用 SFTP 或其他文件传输协议
    
    const totalSize = file.size;
    let uploadedSize = 0;
    const chunkSize = 64 * 1024; // 64KB chunks

    while (uploadedSize < totalSize) {
      // 检查是否被取消或暂停
      if (taskInfo.abortController?.signal.aborted) {
        throw new Error('上传被取消');
      }

      // 模拟上传一个数据块
      const remainingSize = totalSize - uploadedSize;
      const currentChunkSize = Math.min(chunkSize, remainingSize);
      
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 10));
      
      uploadedSize += currentChunkSize;
      taskInfo.uploadedBytes = (taskInfo.uploadedBytes || 0) + currentChunkSize;

      // 计算进度
      const fileProgress = (uploadedSize / totalSize) * 100;
      const overallProgress = ((fileIndex + (uploadedSize / totalSize)) / taskInfo.files.length) * 100;

      // 通知进度更新
      this.notifyProgress(taskInfo.id, {
        transferred: taskInfo.uploadedBytes,
        total: this.getTotalSize(taskInfo.files),
        percentage: overallProgress,
        speed: this.calculateSpeed(taskInfo),
        remainingTime: this.calculateRemainingTime(taskInfo),
        currentFileIndex: fileIndex,
        currentFileName: file.name,
        filesCompleted: fileIndex,
        filesTotal: taskInfo.files.length
      });
    }

    console.log(`文件 ${file.name} 上传完成`);
  }

  /**
   * 计算总文件大小
   */
  private getTotalSize(files: File[]): number {
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
