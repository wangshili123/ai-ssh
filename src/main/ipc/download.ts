/**
 * 文件下载IPC处理器
 */

import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

import { sftpManager } from '../services/sftp';
import { CompressionDownloadService, type CompressionStrategy, type CompressionDownloadOptions } from '../services/compressionDownloadService';
import { ParallelDownloadService, type DownloadChunk } from '../services/parallelDownloadService';
import type { FileEntry } from '../types/file';

interface DownloadProgress {
  transferred: number;
  total: number;
  percentage: number;
  speed: number;
  remainingTime: number;
  eta?: Date;
  // 压缩相关进度信息
  compressionPhase?: 'compressing' | 'downloading' | 'extracting' | 'completed';
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  // 并行下载相关进度信息
  downloadChunks?: DownloadChunk[];
  parallelEnabled?: boolean;
  activeChunks?: number;
}

export interface DownloadConfig {
  savePath: string;
  fileName: string;
  overwrite: boolean;
  openFolder: boolean;
  sessionId: string;
  // 新增：压缩优化选项
  useCompression?: boolean;
  compressionMethod?: 'auto' | 'gzip' | 'bzip2' | 'xz' | 'none';
  useParallelDownload?: boolean;
  maxParallelChunks?: number;
}



interface DownloadTaskInfo {
  taskId: string;
  file: FileEntry;
  config: DownloadConfig;
  localPath: string;
  tempPath?: string; // 临时文件路径
  abortController?: AbortController;
  startTime: number;
  lastProgressTime: number;
  lastTransferred: number;
  speedSamples?: number[];
  isPaused?: boolean;
  resumePosition?: number; // 断点续传位置
  // 新增：压缩相关字段
  compressionEnabled?: boolean;
  compressionMethod?: 'gzip' | 'bzip2' | 'xz' | 'none';
  remoteTempPath?: string; // 远程临时压缩文件路径
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  compressionPhase?: 'compressing' | 'downloading' | 'extracting' | 'completed';
  // 新增：并行下载相关字段
  parallelEnabled?: boolean;
  maxParallelChunks?: number;
  downloadChunks?: DownloadChunk[];
  parallelSupported?: boolean;
}

class DownloadManager {
  private tasks = new Map<string, DownloadTaskInfo>();

  /**
   * 选择压缩策略
   */
  private selectCompressionStrategy(file: FileEntry, config: DownloadConfig): CompressionStrategy {
    // 如果用户禁用了压缩
    if (!config.useCompression) {
      return {
        enabled: false,
        method: 'none',
        command: 'cat',
        extension: '',
        estimatedRatio: 1.0
      };
    }

    const ext = file.name.toLowerCase().split('.').pop() || '';
    const size = file.size;

    // 高压缩比文件类型
    const highCompressible = [
      'txt', 'js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'html', 'htm', 'css', 'scss', 'sass', 'less',
      'md', 'markdown', 'log', 'conf', 'config', 'sql', 'csv', 'tsv', 'yaml', 'yml', 'ini',
      'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'php', 'rb', 'go', 'rs', 'kt', 'swift',
      'sh', 'bash', 'zsh', 'fish', 'ps1', 'bat', 'cmd'
    ];

    // 不适合压缩的文件类型
    const nonCompressible = [
      'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'ico', 'tiff', 'tga',
      'mp3', 'mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v',
      'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a',
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'lz4', 'zst',
      'exe', 'dll', 'so', 'dylib', 'bin', 'deb', 'rpm', 'dmg', 'iso',
      'pdf', 'epub', 'mobi', 'azw', 'azw3'
    ];

    // 文件太小或不适合压缩
    if (size < 1024 || nonCompressible.includes(ext)) {
      return {
        enabled: false,
        method: 'none',
        command: 'cat',
        extension: '',
        estimatedRatio: 1.0
      };
    }

    // 用户指定了压缩方法
    if (config.compressionMethod && config.compressionMethod !== 'auto') {
      if (config.compressionMethod === 'none') {
        return {
          enabled: false,
          method: 'none',
          command: 'cat',
          extension: '',
          estimatedRatio: 1.0
        };
      }
      return this.createCompressionStrategy(config.compressionMethod);
    }

    // 自动选择压缩策略 - 优先使用gzip（最通用）
    if (highCompressible.includes(ext)) {
      // 所有文本文件都使用gzip，因为它最通用且效果不错
      return this.createCompressionStrategy('gzip');
    }

    // 默认使用gzip压缩
    if (size > 10 * 1024) { // 10KB以上
      return this.createCompressionStrategy('gzip');
    }

    return {
      enabled: false,
      method: 'none',
      command: 'cat',
      extension: '',
      estimatedRatio: 1.0
    };
  }

  /**
   * 创建指定方法的压缩策略
   */
  private createCompressionStrategy(method: 'gzip' | 'bzip2' | 'xz'): CompressionStrategy {
    switch (method) {
      case 'gzip':
        return {
          enabled: true,
          method: 'gzip',
          command: 'gzip -c', // 使用简单的gzip命令
          extension: '.gz',
          estimatedRatio: 0.4
        };
      case 'bzip2':
        return {
          enabled: true,
          method: 'bzip2',
          command: 'tar -jcf',
          extension: '.tar.bz2',
          estimatedRatio: 0.3
        };
      case 'xz':
        return {
          enabled: true,
          method: 'xz',
          command: 'tar -Jcf',
          extension: '.tar.xz',
          estimatedRatio: 0.2
        };
      default:
        return {
          enabled: false,
          method: 'none',
          command: 'cat',
          extension: '',
          estimatedRatio: 1.0
        };
    }
  }

  /**
   * 开始下载
   */
  async startDownload(taskId: string, file: FileEntry, config: DownloadConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // 构建完整的本地文件路径
      const localPath = path.join(config.savePath, config.fileName);
      const tempPath = localPath + '.download'; // 临时文件路径

      // 检查目标目录是否存在，如果不存在则创建
      try {
        if (!fs.existsSync(config.savePath)) {
          fs.mkdirSync(config.savePath, { recursive: true });
          console.log(`[DownloadManager] 创建下载目录: ${config.savePath}`);
        }
      } catch (error) {
        console.error(`[DownloadManager] 创建目录失败: ${config.savePath}`, error);
        return {
          success: false,
          error: `无法创建下载目录: ${(error as Error).message}`
        };
      }

      // 检查文件是否已存在
      if (fs.existsSync(localPath) && !config.overwrite) {
        return {
          success: false,
          error: '文件已存在，请选择覆盖或更改文件名'
        };
      }

      // 分析压缩策略
      const compressionStrategy = this.selectCompressionStrategy(file, config);
      console.log(`[DownloadManager] 任务 ${taskId} 压缩策略:`, compressionStrategy);
      console.log(`[DownloadManager] 文件信息 - 名称: ${file.name}, 大小: ${file.size}, 扩展名: ${file.name.toLowerCase().split('.').pop()}`);
      console.log(`[DownloadManager] 用户配置 - useCompression: ${config.useCompression}, compressionMethod: ${config.compressionMethod}`);

      // 检查并行下载支持
      const connectionId = `sftp-${config.sessionId}`;
      let parallelSupported = false;
      let parallelEnabled = false;
      let maxParallelChunks = 1;

      if (config.useParallelDownload && file.size > 10 * 1024 * 1024) { // 大于10MB才考虑并行
        try {
          parallelSupported = await ParallelDownloadService.checkParallelSupport(connectionId, file.path);
          if (parallelSupported) {
            parallelEnabled = true;
            maxParallelChunks = config.maxParallelChunks || ParallelDownloadService.getOptimalParallelChunks(file.size);
            console.log(`[DownloadManager] 并行下载已启用，并行数: ${maxParallelChunks}`);
          } else {
            console.log(`[DownloadManager] 远程服务器不支持并行下载，降级为单线程`);
          }
        } catch (error) {
          console.warn(`[DownloadManager] 检查并行下载支持失败:`, error);
        }
      }

      // 检查是否有未完成的下载（断点续传）
      let resumePosition = 0;
      if (fs.existsSync(tempPath)) {
        const stats = fs.statSync(tempPath);
        resumePosition = stats.size;
        console.log(`[DownloadManager] 发现未完成的下载，从位置 ${resumePosition} 继续`);
      }

      // 创建任务信息
      const taskInfo: DownloadTaskInfo = {
        taskId,
        file,
        config,
        localPath,
        tempPath,
        abortController: new AbortController(),
        startTime: Date.now(),
        lastProgressTime: Date.now(),
        lastTransferred: resumePosition,
        resumePosition,
        isPaused: false,
        // 压缩相关字段
        compressionEnabled: compressionStrategy.enabled,
        compressionMethod: compressionStrategy.method,
        originalSize: file.size,
        compressionRatio: compressionStrategy.estimatedRatio,
        compressionPhase: compressionStrategy.enabled ? 'compressing' : undefined,
        // 并行下载相关字段
        parallelEnabled,
        maxParallelChunks,
        parallelSupported,
        downloadChunks: []
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
    const { taskId, file, config, tempPath } = taskInfo;

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

      // 选择下载策略
      console.log(`[DownloadManager] 选择下载策略 - 压缩: ${taskInfo.compressionEnabled}, 并行: ${taskInfo.parallelEnabled}, 断点: ${taskInfo.resumePosition || 0}`);

      if (taskInfo.compressionEnabled && taskInfo.compressionMethod !== 'none') {
        // 压缩下载
        if (taskInfo.parallelEnabled && taskInfo.maxParallelChunks! > 1) {
          console.log(`[DownloadManager] 开始压缩+并行下载: ${taskId}, 方法: ${taskInfo.compressionMethod}, 并行数: ${taskInfo.maxParallelChunks}, 断点: ${taskInfo.resumePosition || 0}`);
          await this.performCompressedParallelDownload(taskInfo, connectionId);
        } else {
          console.log(`[DownloadManager] 开始压缩下载: ${taskId}, 方法: ${taskInfo.compressionMethod}, 断点: ${taskInfo.resumePosition || 0}`);
          await this.performCompressedDownload(taskInfo, connectionId);
        }
        return;
      }

      // 如果启用了并行下载，使用并行下载
      if (taskInfo.parallelEnabled && taskInfo.maxParallelChunks! > 1) {
        console.log(`[DownloadManager] 开始并行下载: ${taskId}, 并行数: ${taskInfo.maxParallelChunks}, 断点: ${taskInfo.resumePosition || 0}`);
        await this.performParallelDownload(taskInfo, connectionId);
        return;
      }

      console.log(`[DownloadManager] 使用普通下载: ${taskId}, 断点: ${taskInfo.resumePosition || 0}`);
      await this.performNormalDownload(taskInfo, connectionId);

    } catch (error) {
      if (taskInfo.abortController?.signal.aborted) {
        if (taskInfo.isPaused) {
          // 暂停状态，保留临时文件
          console.log(`[DownloadManager] 下载暂停，保留临时文件: ${tempPath}`);
        } else {
          // 取消状态，删除临时文件
          if (fs.existsSync(tempPath!)) {
            try {
              fs.unlinkSync(tempPath!);
            } catch (unlinkError) {
              console.error('删除临时文件失败:', unlinkError);
            }
          }
          this.handleDownloadCancelled(taskId);
        }
      } else {
        this.handleDownloadError(taskId, error);

        // 错误状态，删除临时文件
        if (fs.existsSync(tempPath!)) {
          try {
            fs.unlinkSync(tempPath!);
          } catch (unlinkError) {
            console.error('删除临时文件失败:', unlinkError);
          }
        }
      }
    }
  }

  /**
   * 执行压缩下载
   */
  private async performCompressedDownload(taskInfo: DownloadTaskInfo, connectionId: string): Promise<void> {
    const { taskId, file, localPath, tempPath } = taskInfo;

    // 检查压缩方法是否有效
    const method = taskInfo.compressionMethod!;
    if (method === 'none') {
      throw new Error('压缩方法不能为none');
    }

    // 构建压缩策略
    const strategy: CompressionStrategy = {
      enabled: true,
      method: method,
      command: this.getCompressionCommand(method),
      extension: this.getCompressionExtension(method),
      estimatedRatio: this.getEstimatedRatio(method)
    };

    try {
      await CompressionDownloadService.performCompressedDownload({
        taskId,
        file,
        sessionId: taskInfo.config.sessionId,
        localPath,
        tempPath: tempPath!,
        strategy,
        onProgress: (transferred, total, phase) => {
          // 更新任务的压缩阶段
          taskInfo.compressionPhase = phase;

          // 直接使用传入的进度值，因为CompressionDownloadService已经做了映射
          this.updateProgress(taskInfo, transferred, total);
        },
        abortSignal: taskInfo.abortController?.signal,
        resumePosition: taskInfo.resumePosition,
        remoteTempPath: taskInfo.remoteTempPath,
        onRemotePathCreated: (remotePath) => {
          // 保存远程压缩文件路径
          taskInfo.remoteTempPath = remotePath;
          console.log(`[DownloadManager] 保存远程压缩文件路径: ${remotePath}`);
        }
      });

      // 压缩下载完成
      this.handleDownloadCompleted(taskId, localPath);

    } catch (error) {
      if (taskInfo.abortController?.signal.aborted) {
        if (taskInfo.isPaused) {
          console.log(`[DownloadManager] 压缩下载暂停: ${taskId}`);
        } else {
          this.handleDownloadCancelled(taskId);
        }
      } else {
        console.error(`[DownloadManager] 压缩下载失败: ${taskId}`, error);
        // 如果压缩下载失败，尝试降级到普通下载
        console.log(`[DownloadManager] 降级到普通下载: ${taskId}`);
        taskInfo.compressionEnabled = false;
        taskInfo.compressionMethod = 'none';
        taskInfo.compressionPhase = undefined;

        // 重新开始普通下载
        await this.performNormalDownload(taskInfo, connectionId);
      }
    }
  }

  /**
   * 获取压缩命令
   */
  private getCompressionCommand(method: 'gzip' | 'bzip2' | 'xz'): string {
    switch (method) {
      case 'gzip': return 'gzip -c';
      case 'bzip2': return 'tar -jcf';
      case 'xz': return 'tar -Jcf';
      default: return 'cat';
    }
  }

  /**
   * 获取压缩文件扩展名
   */
  private getCompressionExtension(method: 'gzip' | 'bzip2' | 'xz'): string {
    switch (method) {
      case 'gzip': return '.gz';
      case 'bzip2': return '.tar.bz2';
      case 'xz': return '.tar.xz';
      default: return '';
    }
  }

  /**
   * 获取预估压缩比
   */
  private getEstimatedRatio(method: 'gzip' | 'bzip2' | 'xz'): number {
    switch (method) {
      case 'gzip': return 0.4;
      case 'bzip2': return 0.3;
      case 'xz': return 0.2;
      default: return 1.0;
    }
  }

  /**
   * 执行并行下载
   */
  private async performParallelDownload(taskInfo: DownloadTaskInfo, connectionId: string): Promise<void> {
    const { taskId, file, localPath, tempPath } = taskInfo;

    try {
      await ParallelDownloadService.performParallelDownload({
        taskId,
        file,
        sessionId: taskInfo.config.sessionId,
        localPath,
        tempPath: tempPath!,
        maxParallelChunks: taskInfo.maxParallelChunks!,
        onProgress: (transferred, total, chunks) => {
          // 更新任务的下载块信息
          taskInfo.downloadChunks = chunks;

          // 更新进度
          this.updateProgress(taskInfo, transferred, total);
        },
        abortSignal: taskInfo.abortController?.signal,
        resumePosition: taskInfo.resumePosition
      });

      // 并行下载完成
      this.handleDownloadCompleted(taskId, localPath);

    } catch (error) {
      if (taskInfo.abortController?.signal.aborted) {
        if (taskInfo.isPaused) {
          console.log(`[DownloadManager] 并行下载暂停: ${taskId}`);
        } else {
          this.handleDownloadCancelled(taskId);
        }
      } else {
        console.error(`[DownloadManager] 并行下载失败: ${taskId}`, error);
        // 如果并行下载失败，尝试降级到普通下载
        console.log(`[DownloadManager] 降级到普通下载: ${taskId}`);
        taskInfo.parallelEnabled = false;
        taskInfo.maxParallelChunks = 1;
        taskInfo.downloadChunks = [];

        // 重新开始普通下载
        await this.performNormalDownload(taskInfo, connectionId);
      }
    }
  }

  /**
   * 执行压缩+并行下载
   */
  private async performCompressedParallelDownload(taskInfo: DownloadTaskInfo, connectionId: string): Promise<void> {
    const { taskId, file, localPath, tempPath } = taskInfo;

    // 检查压缩方法是否有效
    const method = taskInfo.compressionMethod!;
    if (method === 'none') {
      throw new Error('压缩方法不能为none');
    }

    // 构建压缩策略
    const strategy: CompressionStrategy = {
      enabled: true,
      method: method,
      command: this.getCompressionCommand(method),
      extension: this.getCompressionExtension(method),
      estimatedRatio: this.getEstimatedRatio(method)
    };

    try {
      // 使用压缩下载服务，但在下载阶段启用并行
      await CompressionDownloadService.performCompressedDownload({
        taskId,
        file,
        sessionId: taskInfo.config.sessionId,
        localPath,
        tempPath: tempPath!,
        strategy,
        // 传递并行下载参数
        useParallel: true,
        maxParallelChunks: taskInfo.maxParallelChunks!,
        onProgress: (transferred, total, phase) => {
          // 更新任务的压缩阶段
          taskInfo.compressionPhase = phase;

          // 直接使用传入的进度值
          this.updateProgress(taskInfo, transferred, total);
        },
        abortSignal: taskInfo.abortController?.signal,
        resumePosition: taskInfo.resumePosition
      });

      // 压缩+并行下载完成
      this.handleDownloadCompleted(taskId, localPath);

    } catch (error) {
      if (taskInfo.abortController?.signal.aborted) {
        if (taskInfo.isPaused) {
          console.log(`[DownloadManager] 压缩+并行下载暂停: ${taskId}`);
        } else {
          this.handleDownloadCancelled(taskId);
        }
      } else {
        console.error(`[DownloadManager] 压缩+并行下载失败: ${taskId}`, error);
        // 降级到普通压缩下载
        console.log(`[DownloadManager] 降级到普通压缩下载: ${taskId}`);
        taskInfo.parallelEnabled = false;
        taskInfo.maxParallelChunks = 1;
        taskInfo.downloadChunks = [];

        // 重新开始压缩下载
        await this.performCompressedDownload(taskInfo, connectionId);
      }
    }
  }

  /**
   * 执行普通下载（非压缩）
   */
  private async performNormalDownload(taskInfo: DownloadTaskInfo, connectionId: string): Promise<void> {
    const { taskId, file, localPath, tempPath } = taskInfo;

    // 创建写入流（支持断点续传）
    const writeStream = fs.createWriteStream(tempPath!, { flags: 'a' }); // 追加模式

    // 自适应缓冲区配置
    const bufferConfig = {
      initialChunkSize: 1024 * 1024, // 1MB
      minChunkSize: 256 * 1024,      // 256KB
      maxChunkSize: 8 * 1024 * 1024, // 8MB
      speedThreshold: 1024 * 1024,   // 1MB/s
      adjustmentFactor: 1.5
    };

    let currentChunkSize = bufferConfig.initialChunkSize;
    const total = file.size;
    let transferred = taskInfo.resumePosition || 0;
    let lastSpeedCheck = Date.now();
    let lastTransferred = transferred;

    try {
      while (transferred < total && !taskInfo.abortController?.signal.aborted) {
        const remainingBytes = total - transferred;
        const readSize = Math.min(currentChunkSize, remainingBytes);

        // 读取文件块
        const result = await sftpManager.readFile(
          connectionId,
          file.path,
          transferred,
          readSize,
          'binary'
        );

        // 写入本地文件
        const buffer = Buffer.from(result.content, 'binary');
        writeStream.write(buffer);

        transferred += result.bytesRead;

        // 自适应调整块大小
        const now = Date.now();
        if (now - lastSpeedCheck > 1000) { // 每秒检查一次
          const timeDiff = (now - lastSpeedCheck) / 1000;
          const bytesDiff = transferred - lastTransferred;
          const speed = bytesDiff / timeDiff;

          if (speed > bufferConfig.speedThreshold) {
            // 速度快，增加块大小
            currentChunkSize = Math.min(bufferConfig.maxChunkSize, currentChunkSize * bufferConfig.adjustmentFactor);
          } else if (speed < bufferConfig.speedThreshold / 2) {
            // 速度慢，减少块大小
            currentChunkSize = Math.max(bufferConfig.minChunkSize, currentChunkSize / bufferConfig.adjustmentFactor);
          }

          lastSpeedCheck = now;
          lastTransferred = transferred;
        }

        // 更新进度
        this.updateProgress(taskInfo, transferred, total);

        // 检查是否被取消
        if (taskInfo.abortController?.signal.aborted) {
          break;
        }

        if (result.bytesRead < readSize) {
          break; // 读取完成
        }
      }

      writeStream.end();

      // 检查是否完整下载
      if (transferred >= total && !taskInfo.abortController?.signal.aborted) {
        // 下载完成，将临时文件重命名为最终文件
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath); // 删除已存在的文件
        }
        fs.renameSync(tempPath!, localPath);
        this.handleDownloadCompleted(taskId, localPath);
      } else if (taskInfo.isPaused) {
        // 下载被暂停，保留临时文件
        console.log(`[DownloadManager] 下载暂停，已保存到位置 ${transferred}`);
      } else {
        // 下载被取消，删除临时文件
        if (fs.existsSync(tempPath!)) {
          fs.unlinkSync(tempPath!);
        }
        this.handleDownloadCancelled(taskId);
      }

    } catch (error) {
      writeStream.destroy();
      throw error;
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

    // 计算瞬时速度，确保不为负数
    const bytesDiff = transferred - taskInfo.lastTransferred;
    let instantSpeed = 0;
    if (timeDiff > 0 && bytesDiff >= 0) {
      instantSpeed = bytesDiff / timeDiff;
    }

    // 使用移动平均来平滑速度计算
    if (!taskInfo.speedSamples) {
      taskInfo.speedSamples = [];
    }

    // 只有在速度为正数时才添加到样本中
    if (instantSpeed >= 0) {
      taskInfo.speedSamples.push(instantSpeed);
      if (taskInfo.speedSamples.length > 10) {
        taskInfo.speedSamples.shift();
      }
    }

    // 确保平均速度不为负数
    const averageSpeed = Math.max(0, taskInfo.speedSamples.reduce((sum, speed) => sum + speed, 0) / Math.max(1, taskInfo.speedSamples.length));

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
      remainingTime,
      // 压缩相关进度信息
      compressionPhase: taskInfo.compressionPhase,
      originalSize: taskInfo.originalSize,
      compressedSize: taskInfo.compressedSize,
      compressionRatio: taskInfo.compressionRatio,
      // 并行下载相关进度信息
      downloadChunks: taskInfo.downloadChunks,
      parallelEnabled: taskInfo.parallelEnabled,
      activeChunks: taskInfo.downloadChunks ? taskInfo.downloadChunks.filter(c => c.status === 'downloading').length : 0
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
      taskInfo.isPaused = true;
      taskInfo.abortController.abort();
      console.log(`[DownloadManager] 暂停下载任务: ${taskId}`);

      // 通知渲染进程暂停状态
      this.notifyPaused(taskId);
    }
  }

  /**
   * 恢复下载
   */
  async resumeDownload(taskId: string): Promise<void> {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      // 重置暂停状态
      taskInfo.isPaused = false;
      taskInfo.abortController = new AbortController();

      // 检查临时文件大小，更新断点位置
      let resumeFileToCheck = taskInfo.tempPath;

      // 对于压缩下载，检查压缩文件的临时文件
      if (taskInfo.compressionEnabled && taskInfo.compressionMethod !== 'none') {
        const extension = this.getCompressionExtension(taskInfo.compressionMethod!);
        if (taskInfo.parallelEnabled && taskInfo.maxParallelChunks! > 1) {
          // 压缩+并行下载：检查 .gz.tmp 文件
          resumeFileToCheck = taskInfo.tempPath + extension + '.tmp';
        } else {
          // 仅压缩下载：检查 .gz 文件
          resumeFileToCheck = taskInfo.tempPath + extension;
        }
        console.log(`[DownloadManager] 压缩下载，检查文件: ${resumeFileToCheck}`);
      }

      if (resumeFileToCheck && fs.existsSync(resumeFileToCheck)) {
        const stats = fs.statSync(resumeFileToCheck);
        taskInfo.resumePosition = stats.size;
        taskInfo.lastTransferred = stats.size;
        console.log(`[DownloadManager] 恢复下载任务: ${taskId}，从位置 ${stats.size} 继续`);
        console.log(`[DownloadManager] 任务配置 - 压缩: ${taskInfo.compressionEnabled}, 并行: ${taskInfo.parallelEnabled}`);
        console.log(`[DownloadManager] 检查文件: ${resumeFileToCheck}, 大小: ${stats.size}`);

        // 断点续传：压缩和并行下载现在都支持断点续传
        console.log(`[DownloadManager] 断点续传支持所有下载模式: ${taskId}`);
      } else {
        console.log(`[DownloadManager] 临时文件不存在或路径无效: ${resumeFileToCheck}`);
        taskInfo.resumePosition = 0;
      }

      // 通知渲染进程恢复状态
      this.notifyResumed(taskId);

      // 添加短暂延迟，确保之前的文件句柄完全释放
      await new Promise(resolve => setTimeout(resolve, 100));

      // 重新开始下载
      this.performDownload(taskInfo).catch(error => {
        this.handleDownloadError(taskId, error);
      });
    }
  }

  /**
   * 取消下载
   */
  async cancelDownload(taskId: string): Promise<void> {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo && taskInfo.abortController) {
      taskInfo.isPaused = false; // 确保不是暂停状态
      taskInfo.abortController.abort();
      console.log(`[DownloadManager] 取消下载任务: ${taskId}`);
    }
  }

  /**
   * 处理下载完成
   */
  private handleDownloadCompleted(taskId: string, filePath: string): void {
    const taskInfo = this.tasks.get(taskId);

    // 如果设置了打开文件夹，则打开
    if (taskInfo?.config.openFolder) {
      try {
        shell.showItemInFolder(filePath);
        console.log(`[DownloadManager] 已打开文件夹: ${filePath}`);
      } catch (error) {
        console.error(`[DownloadManager] 打开文件夹失败:`, error);
      }
    }

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

  /**
   * 通知下载暂停
   */
  private notifyPaused(taskId: string): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('download-paused', { taskId });
    });
  }

  /**
   * 通知下载恢复
   */
  private notifyResumed(taskId: string): void {
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('download-resumed', { taskId });
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

  // 显示打开对话框（用于选择文件夹）
  ipcMain.handle('dialog:show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(options);
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
