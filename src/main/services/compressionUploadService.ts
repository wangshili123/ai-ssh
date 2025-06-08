/**
 * 压缩上传服务
 * 实现文件压缩后上传到远程服务器，然后在远程解压的功能
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { sftpManager } from './sftp';

export type CompressionMethod = 'gzip' | 'bzip2' | 'xz' | 'auto' | 'none';

export interface CompressionUploadOptions {
  taskId: string;
  localFilePath: string;
  remotePath: string;
  fileName: string;
  sessionId: string;
  compressionMethod: CompressionMethod;
  onProgress?: (transferred: number, total: number, phase: 'compressing' | 'uploading' | 'extracting') => void;
  abortSignal?: AbortSignal;
}

export class CompressionUploadService {
  /**
   * 执行压缩上传
   */
  static async performCompressedUpload(options: CompressionUploadOptions): Promise<void> {
    const { taskId, localFilePath, remotePath, fileName, sessionId, compressionMethod, onProgress, abortSignal } = options;
    const connectionId = `sftp-${sessionId}`;

    console.log(`[CompressionUpload] 开始压缩上传任务 ${taskId}，方法: ${compressionMethod}`);

    // 获取原始文件大小
    const originalStats = fs.statSync(localFilePath);
    const originalSize = originalStats.size;

    // 确定实际使用的压缩方法（Node.js 只支持 gzip）
    let actualMethod = compressionMethod === 'auto' ? 'gzip' : compressionMethod;
    if (actualMethod === 'bzip2' || actualMethod === 'xz') {
      console.warn(`[CompressionUpload] ${actualMethod} 不支持，回退到 gzip`);
      actualMethod = 'gzip';
    }

    try {
      // 第一阶段：本地压缩 (0% - 20%)
      console.log(`[CompressionUpload] 阶段1: 开始本地压缩`);
      onProgress?.(0, originalSize, 'compressing');

      const compressedPath = await this.compressLocalFile(localFilePath, actualMethod, (progress) => {
        // 压缩进度映射到0-20%
        const adjustedProgress = Math.min(progress * 0.2, originalSize * 0.2);
        onProgress?.(adjustedProgress, originalSize, 'compressing');
      }, abortSignal);

      if (abortSignal?.aborted) {
        await this.cleanupTempFile(compressedPath);
        return;
      }

      // 第二阶段：上传压缩文件 (20% - 90%)
      console.log(`[CompressionUpload] 阶段2: 开始上传压缩文件`);
      onProgress?.(originalSize * 0.2, originalSize, 'uploading');

      const remoteCompressedPath = path.posix.join(path.posix.dirname(remotePath), `${fileName}.${this.getCompressionExtension(actualMethod)}`);

      await sftpManager.uploadFile(connectionId, compressedPath, remoteCompressedPath, {
        onProgress: (transferred, total) => {
          // 上传进度映射到20%-90%
          const progressRatio = total > 0 ? transferred / total : 0;
          const adjustedProgress = originalSize * 0.2 + (progressRatio * originalSize * 0.7);
          onProgress?.(adjustedProgress, originalSize, 'uploading');
        },
        abortSignal
      });

      if (abortSignal?.aborted) {
        await this.cleanupTempFile(compressedPath);
        await this.cleanupRemoteFile(connectionId, remoteCompressedPath);
        return;
      }

      // 第三阶段：远程解压 (90% - 100%)
      console.log(`[CompressionUpload] 阶段3: 开始远程解压`);
      onProgress?.(originalSize * 0.9, originalSize, 'extracting');

      await this.extractRemoteFile(connectionId, remoteCompressedPath, remotePath, actualMethod, abortSignal);

      // 完成
      onProgress?.(originalSize, originalSize, 'extracting');
      console.log(`[CompressionUpload] 压缩上传完成: ${fileName}`);

      // 清理临时文件
      await this.cleanupTempFile(compressedPath);
      await this.cleanupRemoteFile(connectionId, remoteCompressedPath);

    } catch (error) {
      console.error(`[CompressionUpload] 压缩上传失败:`, error);
      throw error;
    }
  }

  /**
   * 压缩本地文件
   */
  private static async compressLocalFile(
    filePath: string,
    method: CompressionMethod,
    onProgress?: (progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    // 此时传入的 method 已经是实际支持的方法（在调用方已经处理了回退）
    const actualMethod = method === 'auto' ? 'gzip' : method;
    const compressedPath = `${filePath}.${this.getCompressionExtension(actualMethod)}`;

    console.log(`[CompressionUpload] 压缩文件: ${filePath} -> ${compressedPath}, 方法: ${actualMethod}`);

    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath);
      const writeStream = fs.createWriteStream(compressedPath);

      let compressStream: any;

      // 目前只支持 gzip 压缩
      switch (actualMethod) {
        case 'gzip':
          compressStream = zlib.createGzip({ level: 6 });
          break;
        default:
          // 所有其他方法都使用 gzip（不应该到达这里，因为调用方已经处理了）
          compressStream = zlib.createGzip({ level: 6 });
      }

      // 进度跟踪
      const fileSize = fs.statSync(filePath).size;
      let processedBytes = 0;

      readStream.on('data', (chunk) => {
        processedBytes += chunk.length;
        const progress = fileSize > 0 ? processedBytes / fileSize : 0;
        onProgress?.(progress);
      });

      // 处理取消信号
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          if (readStream && typeof readStream.destroy === 'function') {
            readStream.destroy();
          }
          if (writeStream && typeof writeStream.destroy === 'function') {
            writeStream.destroy();
          }
          if (compressStream && typeof compressStream.destroy === 'function') {
            compressStream.destroy();
          }
          // 清理部分压缩的文件
          if (fs.existsSync(compressedPath)) {
            fs.unlinkSync(compressedPath);
          }
          reject(new Error('压缩被取消'));
        });
      }

      writeStream.on('finish', () => {
        console.log(`[CompressionUpload] 本地压缩完成: ${compressedPath}`);
        resolve(compressedPath);
      });

      writeStream.on('error', reject);
      readStream.on('error', reject);
      compressStream.on('error', reject);

      // 开始压缩
      readStream.pipe(compressStream).pipe(writeStream);
    });
  }

  /**
   * 远程解压文件
   */
  private static async extractRemoteFile(
    connectionId: string,
    compressedPath: string,
    targetPath: string,
    method: CompressionMethod,
    abortSignal?: AbortSignal
  ): Promise<void> {
    // 此时传入的 method 已经是实际使用的压缩方法
    const actualMethod = method === 'auto' ? 'gzip' : method;

    let extractCommand: string;

    // 根据实际使用的压缩方法选择对应的解压命令
    switch (actualMethod) {
      case 'gzip':
        extractCommand = `gunzip -c "${compressedPath}" > "${targetPath}"`;
        break;
      case 'bzip2':
        extractCommand = `bunzip2 -c "${compressedPath}" > "${targetPath}"`;
        break;
      case 'xz':
        extractCommand = `xz -dc "${compressedPath}" > "${targetPath}"`;
        break;
      default:
        // 默认使用 gzip 解压（目前只支持 gzip）
        extractCommand = `gunzip -c "${compressedPath}" > "${targetPath}"`;
    }

    console.log(`[CompressionUpload] 执行远程解压命令: ${extractCommand}`);

    const result = await sftpManager.executeCommand(connectionId, extractCommand);

    if (!result.success || result.exitCode !== 0) {
      throw new Error(`远程解压失败: ${result.stderr}`);
    }

    console.log(`[CompressionUpload] 远程解压完成: ${targetPath}`);
  }

  /**
   * 获取压缩文件扩展名
   */
  private static getCompressionExtension(method: CompressionMethod): string {
    switch (method) {
      case 'gzip':
        return 'gz';
      case 'bzip2':
        return 'bz2';
      case 'xz':
        return 'xz';
      case 'auto':
        return 'gz';
      default:
        return 'gz';
    }
  }

  /**
   * 清理本地临时文件
   */
  private static async cleanupTempFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[CompressionUpload] 清理本地临时文件: ${filePath}`);
      }
    } catch (error) {
      console.warn(`[CompressionUpload] 清理本地临时文件失败: ${error}`);
    }
  }

  /**
   * 清理远程临时文件
   */
  private static async cleanupRemoteFile(connectionId: string, filePath: string): Promise<void> {
    try {
      const result = await sftpManager.executeCommand(connectionId, `rm -f "${filePath}"`);
      if (result.success) {
        console.log(`[CompressionUpload] 清理远程临时文件: ${filePath}`);
      }
    } catch (error) {
      console.warn(`[CompressionUpload] 清理远程临时文件失败: ${error}`);
    }
  }

  /**
   * 检查远程服务器压缩工具支持
   */
  static async checkCompressionSupport(
    connectionId: string,
    method: CompressionMethod
  ): Promise<boolean> {
    try {
      let checkCommand: string;

      switch (method) {
        case 'gzip':
        case 'auto':
          checkCommand = 'which gzip && which gunzip';
          break;
        case 'bzip2':
          checkCommand = 'which bzip2 && which bunzip2';
          break;
        case 'xz':
          checkCommand = 'which xz';
          break;
        default:
          return false;
      }

      const result = await sftpManager.executeCommand(connectionId, checkCommand);
      return result.success && result.exitCode === 0;

    } catch (error) {
      console.warn(`[CompressionUpload] 检查压缩支持失败 (${method}):`, error);
      return false;
    }
  }
}

export default CompressionUploadService;
