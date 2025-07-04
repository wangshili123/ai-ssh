/**
 * 并行下载服务
 * 实现文件分块并行下载，提升下载速度
 */

import * as fs from 'fs';
import * as path from 'path';
import { sftpManager } from './sftp';
import type { FileEntry } from '../types/file';

export interface DownloadChunk {
  id: number;
  start: number;
  end: number;
  size: number;
  downloaded: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  error?: string;
  retryCount: number;
}

export interface ParallelDownloadOptions {
  taskId: string;
  file: FileEntry;
  sessionId: string;
  localPath: string;
  tempPath: string;
  maxParallelChunks: number;
  onProgress?: (transferred: number, total: number, chunks: DownloadChunk[]) => void;
  abortSignal?: AbortSignal;
  resumePosition?: number;
}

export interface AdaptiveBufferConfig {
  initialChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  speedThreshold: number; // bytes per second
  adjustmentFactor: number;
}

export class ParallelDownloadService {
  private static readonly DEFAULT_BUFFER_CONFIG: AdaptiveBufferConfig = {
    initialChunkSize: 1024 * 1024, // 1MB
    minChunkSize: 256 * 1024,      // 256KB
    maxChunkSize: 8 * 1024 * 1024, // 8MB
    speedThreshold: 1024 * 1024,   // 1MB/s
    adjustmentFactor: 1.5
  };

  /**
   * 执行并行下载
   */
  static async performParallelDownload(options: ParallelDownloadOptions): Promise<void> {
    const { taskId, file, sessionId, localPath, tempPath, maxParallelChunks, onProgress, abortSignal, resumePosition } = options;
    const connectionId = `sftp-${sessionId}`;

    console.log(`[ParallelDownload] 开始并行下载任务 ${taskId}，文件大小: ${file.size}, 并行数: ${maxParallelChunks}`);

    // 检查是否为断点续传
    const isResume = !!(resumePosition && resumePosition > 0);
    console.log(`[ParallelDownload] 断点续传检查 - isResume: ${isResume}, resumePosition: ${resumePosition}`);

    if (isResume) {
      console.log(`[ParallelDownload] 检测到断点续传，位置: ${resumePosition}`);
      // 检查临时文件状态
      if (fs.existsSync(tempPath)) {
        const stats = fs.statSync(tempPath);
        console.log(`[ParallelDownload] 临时文件存在，大小: ${stats.size}`);
      } else {
        console.log(`[ParallelDownload] 临时文件不存在: ${tempPath}`);
      }
    } else {
      console.log(`[ParallelDownload] 非断点续传，正常开始并行下载`);
    }

    // 检查文件大小，小文件不使用并行下载
    if (file.size < 10 * 1024 * 1024 || maxParallelChunks <= 1) { // 小于10MB或单线程
      console.log(`[ParallelDownload] 使用单线程下载`);
      return this.performSingleThreadDownload(options);
    }

    try {
      // 创建下载块
      const chunks = this.createDownloadChunks(file.size, maxParallelChunks, resumePosition);
      console.log(`[ParallelDownload] 创建了 ${chunks.length} 个下载块`);

      // 创建临时文件（如果是断点续传，保留现有文件）
      await this.createTempFile(tempPath, file.size, isResume);

      // 自适应缓冲区配置
      const bufferConfig = { ...this.DEFAULT_BUFFER_CONFIG };
      let currentChunkSize = bufferConfig.initialChunkSize;

      // 创建文件写入流，支持随机位置写入
      // 如果是断点续传，使用 r+ 模式；否则使用 w 模式
      const fileHandle = await fs.promises.open(tempPath, isResume ? 'r+' : 'w');

      // 并行下载所有块，直接写入文件
      const downloadPromises = chunks
        .filter(chunk => chunk.status !== 'completed') // 跳过已完成的块
        .map(chunk =>
          this.downloadChunkToFile(connectionId, file.path, chunk, currentChunkSize, fileHandle, abortSignal)
        );

      // 监控下载进度
      const progressInterval = setInterval(() => {
        if (abortSignal?.aborted) {
          clearInterval(progressInterval);
          return;
        }

        const totalTransferred = chunks.reduce((sum, chunk) => sum + chunk.downloaded, 0);
        onProgress?.(totalTransferred, file.size, chunks);

        // 自适应调整块大小
        currentChunkSize = this.adjustChunkSize(chunks, bufferConfig);
      }, 100);

      try {
        // 等待所有块下载完成
        await Promise.all(downloadPromises);
        clearInterval(progressInterval);

        if (abortSignal?.aborted) {
          throw new Error('下载被取消');
        }

        // 不需要合并，因为已经直接写入文件了

        // 验证下载完整性
        await this.verifyDownload(tempPath, file.size);

        // 移动到最终位置
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
        fs.renameSync(tempPath, localPath);

        console.log(`[ParallelDownload] 任务 ${taskId} 完成`);

      } finally {
        // 确保文件句柄总是被关闭
        try {
          await fileHandle.close();
        } catch (closeError) {
          console.warn(`[ParallelDownload] 关闭文件句柄失败:`, closeError);
        }
      }

    } catch (error) {
      console.error(`[ParallelDownload] 任务 ${taskId} 失败:`, error);
      throw error;
    }
  }

  /**
   * 创建下载块
   */
  private static createDownloadChunks(fileSize: number, maxChunks: number, resumePosition?: number): DownloadChunk[] {
    const chunks: DownloadChunk[] = [];
    const chunkSize = Math.ceil(fileSize / maxChunks);

    for (let i = 0; i < maxChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize - 1, fileSize - 1);

      if (start <= end) {
        // 计算已下载的字节数（用于断点续传）
        let downloaded = 0;
        let status: 'pending' | 'downloading' | 'completed' | 'error' = 'pending';

        if (resumePosition && resumePosition > 0) {
          if (end < resumePosition) {
            // 这个块已经完全下载
            downloaded = end - start + 1;
            status = 'completed';
            console.log(`[ParallelDownload] 块 ${i} 已完成: ${start}-${end}, 下载: ${downloaded}`);
          } else if (start < resumePosition) {
            // 这个块部分下载
            downloaded = resumePosition - start;
            console.log(`[ParallelDownload] 块 ${i} 部分完成: ${start}-${end}, 下载: ${downloaded}/${end - start + 1}`);
          } else {
            console.log(`[ParallelDownload] 块 ${i} 未开始: ${start}-${end}`);
          }
        } else {
          console.log(`[ParallelDownload] 块 ${i} 新建: ${start}-${end}`);
        }

        chunks.push({
          id: i,
          start,
          end,
          size: end - start + 1,
          downloaded,
          status,
          retryCount: 0
        });
      }
    }

    return chunks;
  }

  /**
   * 创建临时文件
   */
  private static async createTempFile(tempPath: string, fileSize: number, isResume?: boolean): Promise<void> {
    // 如果是断点续传且文件存在，保留现有文件
    if (isResume && fs.existsSync(tempPath)) {
      console.log(`[ParallelDownload] 断点续传，保留现有临时文件: ${tempPath}`);
      return;
    }

    // 创建指定大小的文件，用于支持随机位置写入
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    // 创建文件并预分配空间
    const fileHandle = await fs.promises.open(tempPath, 'w');
    await fileHandle.truncate(fileSize); // 预分配文件大小
    await fileHandle.close();

    console.log(`[ParallelDownload] 创建临时文件: ${tempPath}, 大小: ${fileSize}`);
  }

  /**
   * 下载单个块直接到文件
   */
  private static async downloadChunkToFile(
    connectionId: string,
    remotePath: string,
    chunk: DownloadChunk,
    _chunkSize: number,
    fileHandle: fs.promises.FileHandle,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const maxRetries = 3;

    while (chunk.retryCount < maxRetries && !abortSignal?.aborted) {
      try {
        chunk.status = 'downloading';
        console.log(`[ParallelDownload] 开始下载块 ${chunk.id}: ${chunk.start}-${chunk.end}`);

        let position = chunk.start + chunk.downloaded;

        while (position <= chunk.end && !abortSignal?.aborted) {
          const remainingInChunk = chunk.end - position + 1;
          // 使用较小的块大小，因为SFTP服务器可能有读取限制
          const readSize = Math.min(64 * 1024, remainingInChunk); // 64KB per read

          const result = await sftpManager.readFile(
            connectionId,
            remotePath,
            position,
            readSize,
            'binary'
          );

          if (result.bytesRead > 0) {
            const buffer = Buffer.from(result.content, 'binary');

            // 直接写入文件的指定位置
            await fileHandle.write(buffer, 0, buffer.length, position);

            position += result.bytesRead;
            chunk.downloaded += result.bytesRead;
          }

          // 如果读取的字节数小于请求的字节数，但还没到块末尾，继续读取
          if (result.bytesRead < readSize && position <= chunk.end) {
            console.log(`[ParallelDownload] 块 ${chunk.id} 读取不完整，继续读取。位置: ${position}, 块结束: ${chunk.end}`);
            continue;
          }

          // 如果读取字节数为0，说明到达文件末尾
          if (result.bytesRead === 0) {
            break;
          }
        }

        chunk.status = 'completed';
        console.log(`[ParallelDownload] 块 ${chunk.id} 下载完成`);
        break;

      } catch (error) {
        chunk.retryCount++;
        chunk.error = error instanceof Error ? error.message : String(error);
        console.error(`[ParallelDownload] 块 ${chunk.id} 下载失败 (重试 ${chunk.retryCount}/${maxRetries}):`, error);

        if (chunk.retryCount >= maxRetries) {
          chunk.status = 'error';
          throw new Error(`块 ${chunk.id} 下载失败: ${chunk.error}`);
        }

        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * chunk.retryCount));
      }
    }

    if (abortSignal?.aborted) {
      throw new Error('下载被取消');
    }
  }

  /**
   * 下载单个块到内存（保留旧方法以防需要）
   */
  private static async downloadChunkToMemory(
    connectionId: string,
    remotePath: string,
    chunk: DownloadChunk,
    _chunkSize: number,
    chunkDataMap: Map<number, Buffer[]>,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const maxRetries = 3;

    while (chunk.retryCount < maxRetries && !abortSignal?.aborted) {
      try {
        chunk.status = 'downloading';
        console.log(`[ParallelDownload] 开始下载块 ${chunk.id}: ${chunk.start}-${chunk.end}`);

        let position = chunk.start + chunk.downloaded;
        const chunkBuffers: Buffer[] = [];

        while (position <= chunk.end && !abortSignal?.aborted) {
          const remainingInChunk = chunk.end - position + 1;
          // 使用较小的块大小，因为SFTP服务器可能有读取限制
          const readSize = Math.min(64 * 1024, remainingInChunk); // 64KB per read

          const result = await sftpManager.readFile(
            connectionId,
            remotePath,
            position,
            readSize,
            'binary'
          );

          if (result.bytesRead > 0) {
            const buffer = Buffer.from(result.content, 'binary');
            chunkBuffers.push(buffer);
            position += result.bytesRead;
            chunk.downloaded += result.bytesRead;
          }

          // 如果读取的字节数小于请求的字节数，但还没到块末尾，继续读取
          if (result.bytesRead < readSize && position <= chunk.end) {
            console.log(`[ParallelDownload] 块 ${chunk.id} 读取不完整，继续读取。位置: ${position}, 块结束: ${chunk.end}`);
            continue;
          }

          // 如果读取字节数为0，说明到达文件末尾
          if (result.bytesRead === 0) {
            break;
          }
        }

        // 存储块数据
        chunkDataMap.set(chunk.id, chunkBuffers);
        chunk.status = 'completed';
        console.log(`[ParallelDownload] 块 ${chunk.id} 下载完成`);
        break;

      } catch (error) {
        chunk.retryCount++;
        chunk.error = error instanceof Error ? error.message : String(error);
        console.error(`[ParallelDownload] 块 ${chunk.id} 下载失败 (重试 ${chunk.retryCount}/${maxRetries}):`, error);

        if (chunk.retryCount >= maxRetries) {
          chunk.status = 'error';
          throw new Error(`块 ${chunk.id} 下载失败: ${chunk.error}`);
        }

        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * chunk.retryCount));
      }
    }

    if (abortSignal?.aborted) {
      throw new Error('下载被取消');
    }
  }

  /**
   * 合并块数据到文件
   */
  private static async mergeChunksToFile(
    chunks: DownloadChunk[],
    chunkDataMap: Map<number, Buffer[]>,
    filePath: string
  ): Promise<void> {
    console.log(`[ParallelDownload] 开始合并 ${chunks.length} 个块到文件`);

    return new Promise((resolve, reject) => {
      const writeStream = fs.createWriteStream(filePath, { flags: 'w' });

      writeStream.on('error', (error) => {
        console.error(`[ParallelDownload] 写入文件失败:`, error);
        reject(error);
      });

      writeStream.on('finish', () => {
        console.log(`[ParallelDownload] 文件合并完成`);
        resolve();
      });

      try {
        // 按块ID顺序合并
        chunks.sort((a, b) => a.id - b.id);

        let totalWritten = 0;
        for (const chunk of chunks) {
          const buffers = chunkDataMap.get(chunk.id);
          if (!buffers) {
            throw new Error(`块 ${chunk.id} 数据丢失`);
          }

          console.log(`[ParallelDownload] 合并块 ${chunk.id}, 缓冲区数量: ${buffers.length}`);
          for (const buffer of buffers) {
            writeStream.write(buffer);
            totalWritten += buffer.length;
          }
        }

        console.log(`[ParallelDownload] 总共写入字节数: ${totalWritten}`);
        writeStream.end();

      } catch (error) {
        writeStream.destroy();
        reject(error);
      }
    });
  }



  /**
   * 自适应调整块大小
   */
  private static adjustChunkSize(chunks: DownloadChunk[], config: AdaptiveBufferConfig): number {
    const activeChunks = chunks.filter(chunk => chunk.status === 'downloading');
    if (activeChunks.length === 0) return config.initialChunkSize;

    // 计算平均下载速度
    const totalSpeed = activeChunks.reduce((sum, chunk) => {
      // 简单的速度估算
      return sum + (chunk.downloaded / Math.max(1, Date.now() - chunk.start));
    }, 0);

    const averageSpeed = totalSpeed / activeChunks.length * 1000; // 转换为 bytes/s

    let newChunkSize = config.initialChunkSize;

    if (averageSpeed > config.speedThreshold) {
      // 速度快，增加块大小
      newChunkSize = Math.min(
        config.maxChunkSize,
        config.initialChunkSize * config.adjustmentFactor
      );
    } else {
      // 速度慢，减少块大小
      newChunkSize = Math.max(
        config.minChunkSize,
        config.initialChunkSize / config.adjustmentFactor
      );
    }

    return Math.floor(newChunkSize);
  }

  /**
   * 验证下载完整性
   */
  private static async verifyDownload(filePath: string, expectedSize: number): Promise<void> {
    const stats = fs.statSync(filePath);
    if (stats.size !== expectedSize) {
      throw new Error(`文件大小不匹配: 期望 ${expectedSize}, 实际 ${stats.size}`);
    }
  }

  /**
   * 单线程下载（用于小文件）
   */
  private static async performSingleThreadDownload(options: ParallelDownloadOptions): Promise<void> {
    const { taskId, file, sessionId, localPath, tempPath, onProgress, abortSignal } = options;
    const connectionId = `sftp-${sessionId}`;

    console.log(`[ParallelDownload] 使用单线程下载小文件: ${file.name}`);

    // 自适应缓冲区配置
    const bufferConfig = { ...this.DEFAULT_BUFFER_CONFIG };
    let currentChunkSize = bufferConfig.initialChunkSize;

    const writeStream = fs.createWriteStream(tempPath, { flags: 'w' });
    const total = file.size;
    let transferred = 0;
    let lastSpeedCheck = Date.now();
    let lastTransferred = 0;

    try {
      while (transferred < total && !abortSignal?.aborted) {
        const remainingBytes = total - transferred;
        const readSize = Math.min(currentChunkSize, remainingBytes);

        const result = await sftpManager.readFile(
          connectionId,
          file.path,
          transferred,
          readSize,
          'binary'
        );

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
            currentChunkSize = Math.min(bufferConfig.maxChunkSize, currentChunkSize * bufferConfig.adjustmentFactor);
          } else if (speed < bufferConfig.speedThreshold / 2) {
            currentChunkSize = Math.max(bufferConfig.minChunkSize, currentChunkSize / bufferConfig.adjustmentFactor);
          }

          lastSpeedCheck = now;
          lastTransferred = transferred;
        }

        // 报告进度
        onProgress?.(transferred, total, []);

        if (result.bytesRead < readSize) {
          break;
        }
      }

      writeStream.end();

      if (abortSignal?.aborted) {
        throw new Error('下载被取消');
      }

      // 移动到最终位置
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      fs.renameSync(tempPath, localPath);

      console.log(`[ParallelDownload] 单线程下载完成: ${taskId}`);

    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  /**
   * 获取最优并行数
   */
  static getOptimalParallelChunks(fileSize: number, _networkSpeed?: number): number {
    // 基于文件大小计算最优并行数，更激进的策略
    if (fileSize < 5 * 1024 * 1024) return 1;   // 小于5MB，单线程
    if (fileSize < 50 * 1024 * 1024) return 8;  // 小于50MB，8线程
    if (fileSize < 200 * 1024 * 1024) return 12; // 小于200MB，12线程
    return 30; // 大文件，16线程（最大）
  }

  /**
   * 检查是否支持并行下载
   */
  static async checkParallelSupport(connectionId: string, filePath: string): Promise<boolean> {
    try {
      // 尝试读取文件的不同位置，检查是否支持随机访问
      const result1 = await sftpManager.readFile(connectionId, filePath, 0, 1024, 'binary');
      const result2 = await sftpManager.readFile(connectionId, filePath, 1024, 1024, 'binary');

      return result1.bytesRead > 0 && result2.bytesRead > 0;
    } catch (error) {
      console.warn('[ParallelDownload] 并行下载支持检查失败:', error);
      return false;
    }
  }
}

export default ParallelDownloadService;
