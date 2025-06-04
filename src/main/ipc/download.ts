/**
 * 文件下载IPC处理器
 */

import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { sftpManager } from '../services/sftp';
import type { FileEntry } from '../types/file';

export interface DownloadConfig {
  savePath: string;
  fileName: string;
  overwrite: boolean;
  openFolder: boolean;
  sessionId: string;
}

export interface DownloadProgress {
  transferred: number;
  total: number;
  percentage: number;
  speed: number;
  remainingTime: number;
}

interface DownloadTaskInfo {
  taskId: string;
  file: FileEntry;
  config: DownloadConfig;
  localPath: string;
  abortController?: AbortController;
  startTime: number;
  lastProgressTime: number;
  lastTransferred: number;
  speedSamples?: number[];
}

class DownloadManager {
  private tasks = new Map<string, DownloadTaskInfo>();

  /**
   * 开始下载
   */
  async startDownload(taskId: string, file: FileEntry, config: DownloadConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // 构建完整的本地文件路径
      const localPath = path.join(config.savePath, config.fileName);

      // 检查目标目录是否存在
      if (!fs.existsSync(config.savePath)) {
        fs.mkdirSync(config.savePath, { recursive: true });
      }

      // 检查文件是否已存在
      if (fs.existsSync(localPath) && !config.overwrite) {
        return {
          success: false,
          error: '文件已存在，请选择覆盖或更改文件名'
        };
      }

      // 创建任务信息
      const taskInfo: DownloadTaskInfo = {
        taskId,
        file,
        config,
        localPath,
        abortController: new AbortController(),
        startTime: Date.now(),
        lastProgressTime: Date.now(),
        lastTransferred: 0
      };

      this.tasks.set(taskId, taskInfo);

      // 开始下载
      this.performDownload(taskInfo).catch(error => {
        this.handleDownloadError(taskId, error);
      });

      return { success: true };
    } catch (error) {
      console.error('启动下载失败:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * 执行下载
   */
  private async performDownload(taskInfo: DownloadTaskInfo): Promise<void> {
    const { taskId, file, config, localPath } = taskInfo;

    try {
      // 构造正确的connectionId（与SFTP连接管理器保持一致）
      const connectionId = `sftp-${config.sessionId}`;
      console.log(`[DownloadManager] 使用connectionId: ${connectionId} (来自sessionId: ${config.sessionId})`);

      // 获取SFTP客户端
      const sftpClient = sftpManager.getClient(connectionId);
      if (!sftpClient) {
        throw new Error(`无法获取SFTP连接 - connectionId: ${connectionId}`);
      }

      // 检查远程文件是否存在
      const remoteStats = await sftpManager.stat(connectionId, file.path);
      if (!remoteStats) {
        throw new Error('远程文件不存在');
      }

      // 创建写入流
      const writeStream = fs.createWriteStream(localPath);

      // 分块下载参数
      const chunkSize = 64 * 1024; // 64KB per chunk
      const total = file.size;
      let transferred = 0;

      try {
        while (transferred < total && !taskInfo.abortController?.signal.aborted) {
          const remainingBytes = total - transferred;
          const currentChunkSize = Math.min(chunkSize, remainingBytes);

          // 读取文件块
          const result = await sftpManager.readFile(
            connectionId,
            file.path,
            transferred,
            currentChunkSize,
            'binary'
          );

          // 写入本地文件
          const buffer = Buffer.from(result.content, 'binary');
          writeStream.write(buffer);

          transferred += result.bytesRead;

          // 更新进度
          this.updateProgress(taskInfo, transferred, total);

          // 检查是否被取消
          if (taskInfo.abortController?.signal.aborted) {
            break;
          }
        }

        writeStream.end();

        // 检查是否完整下载
        if (transferred >= total && !taskInfo.abortController?.signal.aborted) {
          // 下载完成
          this.handleDownloadCompleted(taskId, localPath);
        } else {
          // 下载被取消
          this.handleDownloadCancelled(taskId);
        }

      } catch (error) {
        writeStream.destroy();
        throw error;
      }

    } catch (error) {
      if (taskInfo.abortController?.signal.aborted) {
        this.handleDownloadCancelled(taskId);
      } else {
        this.handleDownloadError(taskId, error);
      }

      // 删除部分下载的文件
      if (fs.existsSync(localPath)) {
        try {
          fs.unlinkSync(localPath);
        } catch (unlinkError) {
          console.error('删除部分下载文件失败:', unlinkError);
        }
      }
    }
  }

  /**
   * 更新下载进度
   */
  private updateProgress(taskInfo: DownloadTaskInfo, transferred: number, total: number): void {
    const now = Date.now();
    const timeDiff = (now - taskInfo.lastProgressTime) / 1000; // 秒

    // 限制更新频率，避免过于频繁的UI更新
    if (timeDiff < 0.05) return; // 最多每50ms更新一次，提高响应性

    // 计算瞬时速度
    const bytesDiff = transferred - taskInfo.lastTransferred;
    const instantSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

    // 使用移动平均来平滑速度计算
    if (!taskInfo.speedSamples) {
      taskInfo.speedSamples = [];
    }

    taskInfo.speedSamples.push(instantSpeed);
    if (taskInfo.speedSamples.length > 10) {
      taskInfo.speedSamples.shift();
    }

    const averageSpeed = taskInfo.speedSamples.reduce((sum, speed) => sum + speed, 0) / taskInfo.speedSamples.length;

    // 计算剩余时间
    const remainingBytes = total - transferred;
    const remainingTime = averageSpeed > 0 ? remainingBytes / averageSpeed : 0;

    // 计算百分比
    const percentage = total > 0 ? (transferred / total) * 100 : 0;

    const progress: DownloadProgress = {
      transferred,
      total,
      percentage,
      speed: averageSpeed,
      remainingTime
    };

    // 更新记录
    taskInfo.lastProgressTime = now;
    taskInfo.lastTransferred = transferred;

    // 发送进度更新到渲染进程
    this.notifyProgress(taskInfo.taskId, progress);
  }

  /**
   * 暂停下载
   */
  async pauseDownload(taskId: string): Promise<void> {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo && taskInfo.abortController) {
      taskInfo.abortController.abort();
      // 注意：这里实际上是取消了下载，真正的暂停/恢复需要更复杂的实现
      // 可以在后续版本中实现断点续传功能
    }
  }

  /**
   * 恢复下载
   */
  async resumeDownload(taskId: string): Promise<void> {
    // 断点续传功能的实现
    // 这里可以检查本地文件大小，然后从断点位置继续下载
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      // 重新开始下载（简化实现）
      await this.startDownload(taskId, taskInfo.file, taskInfo.config);
    }
  }

  /**
   * 取消下载
   */
  async cancelDownload(taskId: string): Promise<void> {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo && taskInfo.abortController) {
      taskInfo.abortController.abort();
    }
  }

  /**
   * 处理下载完成
   */
  private handleDownloadCompleted(taskId: string, filePath: string): void {
    this.tasks.delete(taskId);
    this.notifyCompleted(taskId, filePath);
  }

  /**
   * 处理下载错误
   */
  private handleDownloadError(taskId: string, error: any): void {
    console.error(`下载任务 ${taskId} 失败:`, error);
    this.tasks.delete(taskId);
    this.notifyError(taskId, (error as Error).message);
  }

  /**
   * 处理下载取消
   */
  private handleDownloadCancelled(taskId: string): void {
    this.tasks.delete(taskId);
    this.notifyCancelled(taskId);
  }

  /**
   * 通知进度更新
   */
  private notifyProgress(taskId: string, progress: DownloadProgress): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('download-progress', { taskId, progress });
    });
  }

  /**
   * 通知下载完成
   */
  private notifyCompleted(taskId: string, filePath: string): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('download-completed', { taskId, filePath });
    });
  }

  /**
   * 通知下载错误
   */
  private notifyError(taskId: string, error: string): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('download-error', { taskId, error });
    });
  }

  /**
   * 通知下载取消
   */
  private notifyCancelled(taskId: string): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('download-cancelled', { taskId });
    });
  }
}

// 创建下载管理器实例
const downloadManager = new DownloadManager();

/**
 * 注册下载相关的IPC处理器
 */
export function registerDownloadHandlers(): void {
  // 开始下载
  ipcMain.handle('download:start', async (event, data: {
    taskId: string;
    file: FileEntry;
    config: DownloadConfig;
  }) => {
    return await downloadManager.startDownload(data.taskId, data.file, data.config);
  });

  // 暂停下载
  ipcMain.handle('download:pause', async (event, taskId: string) => {
    await downloadManager.pauseDownload(taskId);
  });

  // 恢复下载
  ipcMain.handle('download:resume', async (event, taskId: string) => {
    await downloadManager.resumeDownload(taskId);
  });

  // 取消下载
  ipcMain.handle('download:cancel', async (event, taskId: string) => {
    await downloadManager.cancelDownload(taskId);
  });

  // 显示保存对话框
  ipcMain.handle('dialog:show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(options);
    return result;
  });

  // 打开文件
  ipcMain.handle('shell:open-path', async (event, filePath: string) => {
    return await shell.openPath(filePath);
  });

  // 在文件夹中显示文件
  ipcMain.handle('shell:show-item-in-folder', async (event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });
}
