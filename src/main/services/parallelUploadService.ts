/**
 * 并行上传服务
 * 实现大文件分块并行上传功能
 */

import * as fs from 'fs';
import * as path from 'path';
import { sftpManager } from './sftp';

export interface ParallelUploadOptions {
  taskId: string;
  localFilePath: string;
  remotePath: string;
  fileName: string;
  sessionId: string;
  maxParallelChunks: number;
  onProgress?: (transferred: number, total: number) => void;
  abortSignal?: AbortSignal;
}

interface UploadChunk {
  id: number;
  start: number;
  end: number;
  size: number;
  uploaded: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  retryCount: number;
  tempPath?: string;
}

export class ParallelUploadService {
  private static readonly MAX_RETRY_COUNT = 3;
  private static readonly CHUNK_SIZE = 10 * 1024 * 1024; // 10MB per chunk

  /**
   * 执行并行上传
   */
  static async performParallelUpload(options: ParallelUploadOptions): Promise<void> {
    const { taskId, localFilePath, remotePath, fileName, sessionId, maxParallelChunks, onProgress, abortSignal } = options;
    const connectionId = `sftp-${sessionId}`;

    console.log(`[ParallelUpload] 开始并行上传任务 ${taskId}，文件: ${fileName}, 并行数: ${maxParallelChunks}`);

    // 获取文件大小
    const fileStats = fs.statSync(localFilePath);
    const fileSize = fileStats.size;

    // 如果文件太小，使用普通上传
    if (fileSize < this.CHUNK_SIZE || maxParallelChunks <= 1) {
      console.log(`[ParallelUpload] 文件较小或并行数为1，使用普通上传`);
      await sftpManager.uploadFile(connectionId, localFilePath, remotePath, {
        onProgress,
        abortSignal
      });
      return;
    }

    try {
      // 创建上传块
      const chunks = this.createUploadChunks(fileSize, maxParallelChunks);
      console.log(`[ParallelUpload] 创建了 ${chunks.length} 个上传块`);

      // 创建临时目录
      const tempDir = path.join(require('os').tmpdir(), 'electerm-parallel-upload', taskId);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // 分割文件为块
      await this.splitFileIntoChunks(localFilePath, chunks, tempDir);

      if (abortSignal?.aborted) {
        await this.cleanupTempFiles(chunks);
        return;
      }

      // 并行上传所有块
      await this.uploadChunksInParallel(connectionId, chunks, remotePath, onProgress, abortSignal, fileSize);

      if (abortSignal?.aborted) {
        await this.cleanupTempFiles(chunks);
        await this.cleanupRemoteChunks(connectionId, remotePath, chunks);
        return;
      }

      // 合并远程文件
      await this.mergeRemoteChunks(connectionId, remotePath, chunks);

      // 清理临时文件
      await this.cleanupTempFiles(chunks);
      await this.cleanupRemoteChunks(connectionId, remotePath, chunks);

      console.log(`[ParallelUpload] 并行上传完成: ${fileName}`);

    } catch (error) {
      console.error(`[ParallelUpload] 并行上传失败:`, error);
      throw error;
    }
  }

  /**
   * 创建上传块
   */
  private static createUploadChunks(fileSize: number, maxParallelChunks: number): UploadChunk[] {
    const chunkSize = Math.ceil(fileSize / maxParallelChunks);
    const chunks: UploadChunk[] = [];

    for (let i = 0; i < maxParallelChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      
      if (start >= fileSize) break;

      chunks.push({
        id: i,
        start,
        end,
        size: end - start,
        uploaded: 0,
        status: 'pending',
        retryCount: 0
      });
    }

    return chunks;
  }

  /**
   * 将文件分割为块
   */
  private static async splitFileIntoChunks(filePath: string, chunks: UploadChunk[], tempDir: string): Promise<void> {
    console.log(`[ParallelUpload] 开始分割文件为 ${chunks.length} 个块`);

    const fileHandle = await fs.promises.open(filePath, 'r');

    try {
      for (const chunk of chunks) {
        const chunkPath = path.join(tempDir, `chunk_${chunk.id}`);
        chunk.tempPath = chunkPath;

        const buffer = Buffer.alloc(chunk.size);
        const { bytesRead } = await fileHandle.read(buffer, 0, chunk.size, chunk.start);

        if (bytesRead !== chunk.size) {
          throw new Error(`读取块 ${chunk.id} 失败，期望 ${chunk.size} 字节，实际 ${bytesRead} 字节`);
        }

        await fs.promises.writeFile(chunkPath, buffer.slice(0, bytesRead));
        console.log(`[ParallelUpload] 创建块文件: ${chunkPath}, 大小: ${bytesRead}`);
      }
    } finally {
      await fileHandle.close();
    }
  }

  /**
   * 并行上传所有块
   */
  private static async uploadChunksInParallel(
    connectionId: string,
    chunks: UploadChunk[],
    remotePath: string,
    onProgress?: (transferred: number, total: number) => void,
    abortSignal?: AbortSignal,
    totalSize?: number
  ): Promise<void> {
    console.log(`[ParallelUpload] 开始并行上传 ${chunks.length} 个块`);

    // 创建上传任务
    const uploadPromises = chunks.map(chunk => 
      this.uploadSingleChunk(connectionId, chunk, remotePath, onProgress, abortSignal, totalSize)
    );

    // 等待所有块上传完成
    await Promise.all(uploadPromises);

    // 检查是否所有块都成功上传
    const failedChunks = chunks.filter(chunk => chunk.status !== 'completed');
    if (failedChunks.length > 0) {
      throw new Error(`${failedChunks.length} 个块上传失败`);
    }

    console.log(`[ParallelUpload] 所有块上传完成`);
  }

  /**
   * 上传单个块
   */
  private static async uploadSingleChunk(
    connectionId: string,
    chunk: UploadChunk,
    remotePath: string,
    onProgress?: (transferred: number, total: number) => void,
    abortSignal?: AbortSignal,
    totalSize?: number
  ): Promise<void> {
    const remoteChunkPath = `${remotePath}.chunk.${chunk.id}`;

    for (let attempt = 0; attempt <= this.MAX_RETRY_COUNT; attempt++) {
      if (abortSignal?.aborted) {
        throw new Error('上传被取消');
      }

      try {
        console.log(`[ParallelUpload] 上传块 ${chunk.id}，尝试 ${attempt + 1}/${this.MAX_RETRY_COUNT + 1}`);
        chunk.status = 'uploading';

        await sftpManager.uploadFile(connectionId, chunk.tempPath!, remoteChunkPath, {
          onProgress: (transferred, total) => {
            chunk.uploaded = transferred;
            
            // 计算总进度
            if (onProgress && totalSize) {
              // 这里需要从外部传入chunks数组，暂时只更新当前块的进度
              onProgress(transferred, chunk.size);
            }
          },
          abortSignal
        });

        chunk.status = 'completed';
        console.log(`[ParallelUpload] 块 ${chunk.id} 上传完成`);
        return;

      } catch (error) {
        chunk.retryCount++;
        console.warn(`[ParallelUpload] 块 ${chunk.id} 上传失败，尝试 ${attempt + 1}:`, error);

        if (attempt === this.MAX_RETRY_COUNT) {
          chunk.status = 'error';
          throw new Error(`块 ${chunk.id} 上传失败，已重试 ${this.MAX_RETRY_COUNT} 次: ${error}`);
        }

        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  /**
   * 合并远程文件块
   */
  private static async mergeRemoteChunks(connectionId: string, remotePath: string, chunks: UploadChunk[]): Promise<void> {
    console.log(`[ParallelUpload] 开始合并远程文件块`);

    // 构建合并命令
    const chunkPaths = chunks.map(chunk => `"${remotePath}.chunk.${chunk.id}"`).join(' ');
    const mergeCommand = `cat ${chunkPaths} > "${remotePath}"`;

    console.log(`[ParallelUpload] 执行合并命令: ${mergeCommand}`);

    const result = await sftpManager.executeCommand(connectionId, mergeCommand);
    
    if (!result.success || result.exitCode !== 0) {
      throw new Error(`远程文件合并失败: ${result.stderr}`);
    }

    console.log(`[ParallelUpload] 远程文件合并完成: ${remotePath}`);
  }

  /**
   * 清理本地临时文件
   */
  private static async cleanupTempFiles(chunks: UploadChunk[]): Promise<void> {
    for (const chunk of chunks) {
      if (chunk.tempPath && fs.existsSync(chunk.tempPath)) {
        try {
          fs.unlinkSync(chunk.tempPath);
          console.log(`[ParallelUpload] 清理临时文件: ${chunk.tempPath}`);
        } catch (error) {
          console.warn(`[ParallelUpload] 清理临时文件失败: ${error}`);
        }
      }
    }

    // 清理临时目录
    try {
      const tempDir = path.dirname(chunks[0]?.tempPath || '');
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmdirSync(tempDir);
        console.log(`[ParallelUpload] 清理临时目录: ${tempDir}`);
      }
    } catch (error) {
      console.warn(`[ParallelUpload] 清理临时目录失败: ${error}`);
    }
  }

  /**
   * 清理远程文件块
   */
  private static async cleanupRemoteChunks(connectionId: string, remotePath: string, chunks: UploadChunk[]): Promise<void> {
    for (const chunk of chunks) {
      const remoteChunkPath = `${remotePath}.chunk.${chunk.id}`;
      try {
        const result = await sftpManager.executeCommand(connectionId, `rm -f "${remoteChunkPath}"`);
        if (result.success) {
          console.log(`[ParallelUpload] 清理远程块文件: ${remoteChunkPath}`);
        }
      } catch (error) {
        console.warn(`[ParallelUpload] 清理远程块文件失败: ${error}`);
      }
    }
  }
}

export default ParallelUploadService;
