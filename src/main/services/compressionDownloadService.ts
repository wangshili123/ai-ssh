/**
 * 压缩下载服务
 * 负责处理文件的压缩传输下载
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { sftpManager } from './sftp';
import type { FileEntry } from '../types/file';

const execAsync = promisify(exec);

export interface CompressionStrategy {
  enabled: boolean;
  method: 'gzip' | 'bzip2' | 'xz' | 'none';
  command: string;
  extension: string;
  estimatedRatio: number;
}

export interface CompressionDownloadOptions {
  taskId: string;
  file: FileEntry;
  sessionId: string;
  localPath: string;
  tempPath: string;
  strategy: CompressionStrategy;
  onProgress?: (transferred: number, total: number, phase: 'compressing' | 'downloading' | 'extracting') => void;
  abortSignal?: AbortSignal;
  // 新增：并行下载支持
  useParallel?: boolean;
  maxParallelChunks?: number;
}

export class CompressionDownloadService {
  
  /**
   * 执行压缩下载
   */
  static async performCompressedDownload(options: CompressionDownloadOptions): Promise<void> {
    const { taskId, file, sessionId, localPath, tempPath, strategy, onProgress, abortSignal, useParallel, maxParallelChunks } = options;

    if (!strategy.enabled) {
      throw new Error('压缩策略未启用');
    }

    const connectionId = `sftp-${sessionId}`;
    console.log(`[CompressionDownload] 开始压缩下载任务 ${taskId}，方法: ${strategy.method}`);

    try {
      // 第一阶段：远程压缩 (0% - 10%)
      console.log(`[CompressionDownload] 阶段1: 开始远程压缩`);
      onProgress?.(0, file.size, 'compressing');

      const remoteTempPath = await this.compressRemoteFile(connectionId, file, strategy, (progress) => {
        // 压缩进度映射到0-10%
        const adjustedProgress = Math.min(progress * 0.1, file.size * 0.1);
        onProgress?.(adjustedProgress, file.size, 'compressing');
      }, abortSignal);

      if (abortSignal?.aborted) {
        await this.cleanupRemoteFile(connectionId, remoteTempPath);
        return;
      }

      // 压缩完成，进度到10%
      onProgress?.(file.size * 0.1, file.size, 'compressing');

      // 第二阶段：下载压缩文件 (10% - 90%)
      console.log(`[CompressionDownload] 阶段2: 开始下载压缩文件`);
      onProgress?.(file.size * 0.1, file.size, 'downloading');

      const compressedLocalPath = tempPath + strategy.extension;

      // 根据是否启用并行选择下载方式
      if (useParallel && maxParallelChunks && maxParallelChunks > 1) {
        console.log(`[CompressionDownload] 使用并行下载压缩文件，并行数: ${maxParallelChunks}`);
        await this.downloadCompressedFileParallel(connectionId, remoteTempPath, compressedLocalPath, maxParallelChunks, (transferred, total) => {
          // 下载进度映射到10%-90%
          const progressRatio = total > 0 ? transferred / total : 0;
          const adjustedProgress = file.size * 0.1 + (progressRatio * file.size * 0.8);
          onProgress?.(adjustedProgress, file.size, 'downloading');
        }, abortSignal);
      } else {
        await this.downloadCompressedFile(connectionId, remoteTempPath, compressedLocalPath, (transferred, total) => {
          // 下载进度映射到10%-90%
          const progressRatio = total > 0 ? transferred / total : 0;
          const adjustedProgress = file.size * 0.1 + (progressRatio * file.size * 0.8);
          onProgress?.(adjustedProgress, file.size, 'downloading');
        }, abortSignal);
      }

      if (abortSignal?.aborted) {
        await this.cleanupRemoteFile(connectionId, remoteTempPath);
        this.cleanupLocalFile(compressedLocalPath);
        return;
      }

      // 下载完成，进度到90%
      onProgress?.(file.size * 0.9, file.size, 'downloading');

      // 第三阶段：本地解压 (90% - 100%)
      console.log(`[CompressionDownload] 阶段3: 开始本地解压`);
      onProgress?.(file.size * 0.9, file.size, 'extracting');

      await this.extractLocalFile(compressedLocalPath, localPath, strategy, (progress) => {
        // 解压进度映射到90%-100%
        const adjustedProgress = file.size * 0.9 + (progress * file.size * 0.1);
        onProgress?.(adjustedProgress, file.size, 'extracting');
      });

      // 清理临时文件
      await this.cleanupRemoteFile(connectionId, remoteTempPath);
      this.cleanupLocalFile(compressedLocalPath);

      // 完成，进度到100%
      onProgress?.(file.size, file.size, 'extracting');
      console.log(`[CompressionDownload] 任务 ${taskId} 完成`);

    } catch (error) {
      console.error(`[CompressionDownload] 任务 ${taskId} 失败:`, error);
      throw error;
    }
  }

  /**
   * 在远程服务器压缩文件
   */
  private static async compressRemoteFile(
    connectionId: string,
    file: FileEntry,
    strategy: CompressionStrategy,
    onProgress?: (progress: number) => void,
    abortSignal?: AbortSignal
  ): Promise<string> {
    const remoteTempPath = `/tmp/download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${strategy.extension}`;

    // 构建压缩命令，确保文件路径安全
    const safeFilePath = file.path.replace(/'/g, "'\"'\"'"); // 转义单引号

    // 使用更简单的gzip命令，避免tar的复杂性
    let compressCommand: string;
    if (strategy.method === 'gzip') {
      // 直接使用gzip压缩单个文件
      compressCommand = `gzip -c '${safeFilePath}' > '${remoteTempPath}'`;
    } else {
      // 对于其他压缩方法，使用tar
      const fileDir = safeFilePath.substring(0, safeFilePath.lastIndexOf('/'));
      const fileName = safeFilePath.substring(safeFilePath.lastIndexOf('/') + 1);
      compressCommand = `cd '${fileDir}' && ${strategy.command} '${remoteTempPath}' '${fileName}'`;
    }

    console.log(`[CompressionDownload] 开始压缩文件: ${file.name} (${file.size} bytes)`);
    console.log(`[CompressionDownload] 压缩方法: ${strategy.method}, 预估压缩比: ${strategy.estimatedRatio}`);
    console.log(`[CompressionDownload] 执行远程压缩命令: ${compressCommand}`);

    try {
      // 报告压缩开始
      onProgress?.(0);

      const result = await sftpManager.executeCommand(connectionId, compressCommand);

      if (abortSignal?.aborted) {
        throw new Error('操作被取消');
      }

      // 报告压缩进行中
      onProgress?.(file.size * 0.5);

      if (!result.success || result.exitCode !== 0) {
        throw new Error(`压缩命令执行失败: ${result.stderr || result.stdout || '未知错误'}`);
      }

      // 验证压缩文件是否创建成功
      const compressedStats = await sftpManager.stat(connectionId, remoteTempPath);
      if (!compressedStats) {
        throw new Error('压缩文件创建失败');
      }

      // 报告压缩完成
      onProgress?.(file.size);

      console.log(`[CompressionDownload] 压缩完成，原始大小: ${file.size}, 压缩后大小: ${compressedStats.size}`);
      return remoteTempPath;

    } catch (error) {
      // 清理可能创建的临时文件
      await this.cleanupRemoteFile(connectionId, remoteTempPath);
      throw error;
    }
  }

  /**
   * 下载压缩文件
   */
  private static async downloadCompressedFile(
    connectionId: string,
    remotePath: string,
    localPath: string,
    onProgress?: (transferred: number, total: number) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    // 获取压缩文件大小
    const remoteStats = await sftpManager.stat(connectionId, remotePath);
    if (!remoteStats) {
      throw new Error('无法获取压缩文件信息');
    }

    const compressedSize = remoteStats.size;
    const writeStream = fs.createWriteStream(localPath);
    
    try {
      const chunkSize = 256 * 1024; // 256KB chunks for compressed files
      let transferred = 0;

      while (transferred < compressedSize && !abortSignal?.aborted) {
        const remainingBytes = compressedSize - transferred;
        const currentChunkSize = Math.min(chunkSize, remainingBytes);

        const result = await sftpManager.readFile(
          connectionId,
          remotePath,
          transferred,
          currentChunkSize,
          'binary'
        );

        const buffer = Buffer.from(result.content, 'binary');
        writeStream.write(buffer);
        transferred += result.bytesRead;

        // 报告下载进度
        onProgress?.(transferred, compressedSize);

        if (abortSignal?.aborted) {
          break;
        }
      }

      writeStream.end();

      if (abortSignal?.aborted) {
        throw new Error('下载被取消');
      }

      if (transferred < compressedSize) {
        throw new Error('下载不完整');
      }

    } catch (error) {
      writeStream.destroy();
      throw error;
    }
  }

  /**
   * 并行下载压缩文件
   */
  private static async downloadCompressedFileParallel(
    connectionId: string,
    remotePath: string,
    localPath: string,
    maxParallelChunks: number,
    onProgress?: (transferred: number, total: number) => void,
    abortSignal?: AbortSignal
  ): Promise<void> {
    // 获取压缩文件大小
    const remoteStats = await sftpManager.stat(connectionId, remotePath);
    if (!remoteStats) {
      throw new Error('无法获取压缩文件信息');
    }

    const compressedSize = remoteStats.size;
    console.log(`[CompressionDownload] 开始并行下载压缩文件，大小: ${compressedSize}, 并行数: ${maxParallelChunks}`);

    // 使用ParallelDownloadService下载压缩文件
    const { ParallelDownloadService } = await import('./parallelDownloadService');

    // 创建虚拟文件对象
    const virtualFile: FileEntry = {
      name: remotePath.split('/').pop() || 'compressed',
      path: remotePath,
      size: compressedSize,
      isDirectory: false,
      modifyTime: Date.now(),
      permissions: 644,
      extension: remotePath.split('.').pop() || ''
    };

    await ParallelDownloadService.performParallelDownload({
      taskId: `compressed_${Date.now()}`,
      file: virtualFile,
      sessionId: connectionId.replace('sftp-', ''),
      localPath,
      tempPath: localPath + '.tmp',
      maxParallelChunks,
      onProgress: (transferred, total) => {
        onProgress?.(transferred, total);
      },
      abortSignal
    });

    console.log(`[CompressionDownload] 并行下载压缩文件完成`);
  }

  /**
   * 解压本地文件
   */
  private static async extractLocalFile(
    compressedPath: string,
    targetPath: string,
    strategy: CompressionStrategy,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    const targetDir = path.dirname(targetPath);

    // 确保目标目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
      // 报告解压开始
      onProgress?.(0);

      if (strategy.method === 'gzip') {
        // 使用Node.js内置的zlib模块解压gzip文件
        console.log(`[CompressionDownload] 使用Node.js zlib解压gzip文件: ${compressedPath}`);

        const readStream = fs.createReadStream(compressedPath);
        const writeStream = fs.createWriteStream(targetPath);
        const gunzip = zlib.createGunzip();

        // 报告解压进行中
        onProgress?.(0.5);

        await pipeline(readStream, gunzip, writeStream);

        console.log(`[CompressionDownload] gzip解压完成: ${targetPath}`);

      } else {
        // 对于其他压缩方法，使用系统命令
        let extractCommand: string;

        switch (strategy.method) {
          case 'bzip2':
            extractCommand = `tar -xjf "${compressedPath}" -C "${targetDir}"`;
            break;
          case 'xz':
            extractCommand = `tar -xJf "${compressedPath}" -C "${targetDir}"`;
            break;
          default:
            throw new Error(`不支持的压缩方法: ${strategy.method}`);
        }

        console.log(`[CompressionDownload] 执行解压命令: ${extractCommand}`);

        // 报告解压进行中
        onProgress?.(0.5);

        const { stderr } = await execAsync(extractCommand);

        if (stderr && !stderr.includes('Warning')) { // 忽略警告信息
          console.warn(`[CompressionDownload] 解压警告: ${stderr}`);
        }

        // 查找解压出的文件
        const extractedFiles = fs.readdirSync(targetDir);
        const extractedFile = extractedFiles.find(f =>
          f !== path.basename(compressedPath) &&
          f !== path.basename(targetPath) &&
          !f.startsWith('.')
        );

        if (extractedFile) {
          const extractedPath = path.join(targetDir, extractedFile);

          // 如果解压出的文件名与目标文件名不同，重命名
          if (extractedPath !== targetPath) {
            if (fs.existsSync(targetPath)) {
              fs.unlinkSync(targetPath);
            }
            fs.renameSync(extractedPath, targetPath);
          }
        } else {
          throw new Error('解压后未找到目标文件');
        }

        console.log(`[CompressionDownload] tar解压完成: ${targetPath}`);
      }

      // 报告解压完成
      onProgress?.(1.0);

    } catch (error) {
      console.error(`[CompressionDownload] 解压失败:`, error);
      throw new Error(`文件解压失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 清理远程临时文件
   */
  private static async cleanupRemoteFile(connectionId: string, remotePath: string): Promise<void> {
    try {
      await sftpManager.executeCommand(connectionId, `rm -f '${remotePath}'`);
      console.log(`[CompressionDownload] 清理远程临时文件: ${remotePath}`);
    } catch (error) {
      console.warn(`[CompressionDownload] 清理远程文件失败: ${remotePath}`, error);
    }
  }

  /**
   * 清理本地临时文件
   */
  private static cleanupLocalFile(localPath: string): void {
    try {
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`[CompressionDownload] 清理本地临时文件: ${localPath}`);
      }
    } catch (error) {
      console.warn(`[CompressionDownload] 清理本地文件失败: ${localPath}`, error);
    }
  }

  /**
   * 检查远程服务器压缩工具支持
   */
  static async checkCompressionSupport(
    connectionId: string,
    method: 'gzip' | 'bzip2' | 'xz'
  ): Promise<boolean> {
    try {
      let checkCommand: string;

      switch (method) {
        case 'gzip':
          // 只检查gzip和gunzip命令
          checkCommand = 'which gzip && which gunzip';
          break;
        case 'bzip2':
          checkCommand = 'which bzip2 && which tar';
          break;
        case 'xz':
          checkCommand = 'which xz && which tar';
          break;
        default:
          return false;
      }

      const result = await sftpManager.executeCommand(connectionId, checkCommand);
      return result.success && result.exitCode === 0;

    } catch (error) {
      console.warn(`[CompressionDownload] 检查压缩支持失败 (${method}):`, error);
      return false;
    }
  }
}

export default CompressionDownloadService;
