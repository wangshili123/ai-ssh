import { ipcRenderer } from 'electron';
import type { FileEntry } from '../../main/types/file';
import type { SessionInfo } from '../types';

class SFTPService {
  /**
   * 创建 SFTP 客户端
   */
  async createClient(connectionId: string, sessionInfo: SessionInfo): Promise<void> {
    const result = await ipcRenderer.invoke('sftp:create-client', connectionId, sessionInfo);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  /**
   * 读取目录内容
   */
  async readDirectory(sessionId: string, path: string): Promise<FileEntry[]> {
    const result = await ipcRenderer.invoke('sftp:read-directory', sessionId, path);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data!;
  }

  /**
   * 关闭SFTP客户端
   */
  async close(sessionId: string): Promise<void> {
    const result = await ipcRenderer.invoke('sftp:close-client', sessionId);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  /**
   * 读取文件内容
   * @param sessionId 会话ID
   * @param filePath 文件路径
   * @param start 起始位置
   * @param length 读取长度
   * @param encoding 编码方式
   */
  async readFile(
    sessionId: string,
    filePath: string,
    start: number = 0,
    length: number = -1,
    encoding: BufferEncoding | 'binary' = 'utf8'
  ): Promise<{
    content: string;
    totalSize: number;
    bytesRead: number;
  }> {
    const result = await ipcRenderer.invoke('sftp:read-file', sessionId, filePath, start, length, encoding);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data!;
  }

  /**
   * 写入文件内容
   * @param sessionId 会话ID
   * @param filePath 文件路径
   * @param content 文件内容
   * @param encoding 编码方式
   */
  async writeFile(
    sessionId: string,
    filePath: string,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    const result = await ipcRenderer.invoke('sftp:write-file', sessionId, filePath, content, encoding);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  /**
   * 获取文件状态信息
   * @param sessionId 会话ID
   * @param filePath 文件路径
   */
  async stat(
    sessionId: string,
    filePath: string
  ): Promise<{
    size: number;
    modifyTime: number;
    isDirectory: boolean;
    permissions: number;
  }> {
    const result = await ipcRenderer.invoke('sftp:stat', sessionId, filePath);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data!;
  }

  /**
   * 读取文件指定范围的内容
   * @param sessionId 会话ID
   * @param filePath 文件路径
   * @param start 起始位置
   * @param size 读取大小
   * @param encoding 编码方式
   */
  async readChunk(
    sessionId: string,
    filePath: string,
    start: number = 0,
    size: number = -1,
    encoding: BufferEncoding | 'binary' = 'utf8'
  ): Promise<{
    content: string;
    totalSize: number;
    bytesRead: number;
  }> {
    const result = await ipcRenderer.invoke('sftp:read-file', sessionId, filePath, start, size, encoding);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data!;
  }

  /**
   * 使用服务端grep过滤文件内容
   * @param sessionId 会话ID
   * @param filePath 文件路径
   * @param pattern 过滤模式
   * @param options 过滤选项
   */
  async grepFile(
    sessionId: string,
    filePath: string,
    pattern: string,
    options: {
      isRegex: boolean;
      caseSensitive: boolean;
    }
  ): Promise<{
    content: string[];
    totalLines: number;
    matchedLines: number;
  }> {
    const result = await ipcRenderer.invoke('sftp:grep-file', sessionId, filePath, pattern, options);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data!;
  }

  /**
   * 并行读取大文件内容
   * 将文件分成多个块并行读取，然后合并结果
   * @param sessionId 会话ID
   * @param filePath 文件路径
   * @param options 选项
   */
  async readLargeFile(
    sessionId: string,
    filePath: string,
    options: {
      chunkSize?: number,              // 每个块的大小，默认64KB
      maxParallelChunks?: number,      // 最大并行块数，默认5
      encoding?: BufferEncoding | 'binary', // 编码方式
      onProgress?: (progress: number) => void // 进度回调
    } = {}
  ): Promise<{
    content: string,
    totalSize: number,
    bytesRead: number
  }> {
    console.log(`[SFTPService] 开始并行读取大文件 - sessionId: ${sessionId}, path: ${filePath}`);
    
    // 1. 获取文件信息
    const stats = await this.stat(sessionId, filePath);
    const totalSize = stats.size;
    
    console.log(`[SFTPService] 大文件信息 - size: ${totalSize}`);
    
    // 如果文件大小为0，直接返回空内容
    if (totalSize === 0) {
      console.log(`[SFTPService] 文件大小为0，返回空内容`);
      return {
        content: '',
        totalSize: 0,
        bytesRead: 0
      };
    }
    
    // 2. 设置参数
    const chunkSize = options.chunkSize || 65536; // 默认64KB
    const maxParallelChunks = options.maxParallelChunks || 5;
    const encoding = options.encoding || 'utf8';
    
    console.log(`[SFTPService] 并行读取参数 - chunkSize: ${chunkSize}, maxParallelChunks: ${maxParallelChunks}, encoding: ${encoding}`);
    
    // 3. 计算块数
    const chunks = Math.ceil(totalSize / chunkSize);
    console.log(`[SFTPService] 文件将被分成 ${chunks} 个块进行读取`);
    
    // 4. 创建结果数组
    const contentParts: string[] = [];
    let totalBytesRead = 0;
    let lastReportedProgress = 0;
    
    // 5. 分批并行读取
    try {
      // 先尝试读取第一个块来确定实际可读取的大小
      const firstChunkResult = await this.readFile(sessionId, filePath, 0, chunkSize, encoding);
      const actualChunkSize = firstChunkResult.bytesRead;
      contentParts.push(firstChunkResult.content);
      totalBytesRead = firstChunkResult.bytesRead;
      
      console.log(`[SFTPService] 首个块实际读取大小: ${actualChunkSize} 字节`);
      
      // 根据实际可读取的大小重新计算总块数
      const actualTotalSize = Math.ceil(totalSize / actualChunkSize) * actualChunkSize;
      console.log(`[SFTPService] 预计实际可读取总大小: ${actualTotalSize} 字节`);
      
      // 报告首个块的进度
      if (options.onProgress) {
        const progress = totalBytesRead / actualTotalSize;
        options.onProgress(progress);
        lastReportedProgress = progress;
        console.log(`[SFTPService] 读取进度: ${Math.round(progress * 100)}% (已读取 ${totalBytesRead} / ${actualTotalSize} 字节)`);
      }
      
      // 继续读取剩余的块
      let currentPosition = actualChunkSize;
      
      while (currentPosition < totalSize) {
        const batchTasks = [];
        const batchStart = Date.now();
        
        // 创建当前批次的任务
        for (let i = 0; i < maxParallelChunks && currentPosition < totalSize; i++) {
          const length = Math.min(actualChunkSize, totalSize - currentPosition);
          batchTasks.push(this.readFile(sessionId, filePath, currentPosition, length, encoding));
          currentPosition += length;
        }
        
        console.log(`[SFTPService] 开始新批次，从位置 ${currentPosition - actualChunkSize * batchTasks.length} 读取 ${batchTasks.length} 个块`);
        
        // 并行执行当前批次
        const batchResults = await Promise.all(batchTasks);
        
        const batchEnd = Date.now();
        console.log(`[SFTPService] 批次完成，耗时: ${batchEnd - batchStart}ms`);
        
        // 处理结果
        for (const result of batchResults) {
          if (result.bytesRead > 0) {
            contentParts.push(result.content);
            totalBytesRead += result.bytesRead;
            
            // 报告进度
            if (options.onProgress) {
              const progress = Math.min(totalBytesRead / actualTotalSize, 1);
              if (progress - lastReportedProgress >= 0.01) { // 每1%更新一次进度
                options.onProgress(progress);
                lastReportedProgress = progress;
                console.log(`[SFTPService] 读取进度: ${Math.round(progress * 100)}% (已读取 ${totalBytesRead} / ${actualTotalSize} 字节)`);
              }
            }
          }
        }
      }
      
      // 6. 合并结果
      console.log(`[SFTPService] 所有块读取完成，开始合并 ${contentParts.length} 个块`);
      const content = contentParts.join('');
      
      // 确保最终进度为100%
      if (options.onProgress && lastReportedProgress < 1) {
        options.onProgress(1);
        console.log(`[SFTPService] 读取进度: 100% (已读取 ${totalBytesRead} 字节)`);
      }
      
      console.log(`[SFTPService] 大文件读取完成 - 总大小: ${totalSize}, 实际读取字节数: ${totalBytesRead}, 内容长度: ${content.length}`);
      
      // 7. 返回结果
      return {
        content,
        totalSize,
        bytesRead: totalBytesRead
      };
    } catch (error) {
      console.error(`[SFTPService] 并行读取大文件失败:`, error);
      throw error;
    }
  }
}

export const sftpService = new SFTPService(); 