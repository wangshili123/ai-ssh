/**
 * 文件加载管理器
 * 负责大文件的分块加载、过滤和内存管理
 */

import { EventEmitter } from 'events';
import { FileWorker, ReadRequest, FilterRequest } from './FileWorker';
import { ErrorManager, ErrorType } from './ErrorManager';
import { detectEncoding, bufferToString, EncodingType, isValidEncoding } from '../utils/FileEncodingUtils';

export interface FileInfo {
  size: number;
  lineCount: number;
  encoding: EncodingType;
  lastModified: Date;
}

export interface FilterConfig {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
}

export interface LoadChunkResult {
  content: string[];
  startLine: number;
  endLine: number;
  isFiltered: boolean;
}

export class FileLoaderManager extends EventEmitter {
  private filePath: string;
  private chunkSize: number = 2 * 1024 * 1024; // 2MB
  private maxMemoryUsage: number = 512 * 1024 * 1024; // 512MB
  private currentFilter: FilterConfig | null = null;
  private cachedChunks: Map<number, LoadChunkResult> = new Map();
  private fileInfo: FileInfo | null = null;
  private encoding: EncodingType = 'UTF-8';
  private lastChunkIndex: number = -1;
  private worker: FileWorker;
  private errorManager: ErrorManager;

  constructor(filePath: string, errorManager: ErrorManager) {
    super();
    this.filePath = filePath;
    this.worker = new FileWorker();
    this.errorManager = errorManager;
  }

  /**
   * 获取文件基本信息
   */
  async getFileInfo(): Promise<FileInfo> {
    try {
      if (this.fileInfo) {
        return this.fileInfo;
      }

      // 使用 worker 读取文件头部
      const headerRequest: ReadRequest = {
        filePath: this.filePath,
        start: 0,
        size: 4096,
        encoding: 'binary'
      };
      const { content, bytesRead } = await this.worker.execute<{ content: string; bytesRead: number }>({
        type: 'read',
        data: headerRequest
      });

      // 检测文件编码
      const headerBuffer = Buffer.from(content, 'binary');
      this.encoding = detectEncoding(headerBuffer);

      // 估算行数（通过采样）
      const decodedContent = bufferToString(headerBuffer, this.encoding);
      const sampleLines = decodedContent.split(/\r?\n/);
      const avgLineLength = sampleLines.reduce((acc, line) => acc + line.length, 0) / sampleLines.length;
      const estimatedLines = Math.ceil(headerRequest.size / avgLineLength);

      this.fileInfo = {
        size: headerRequest.size,
        lineCount: estimatedLines,
        encoding: this.encoding,
        lastModified: new Date()
      };

      return this.fileInfo;
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.FILE_ENCODING_ERROR);
      throw error;
    }
  }

  /**
   * 设置文件编码
   * @param encoding 新的编码
   */
  public setEncoding(encoding: string): void {
    if (!isValidEncoding(encoding)) {
      this.errorManager.handleError(new Error('不支持的编码格式'), ErrorType.FILE_ENCODING_ERROR);
      return;
    }

    if (this.encoding !== encoding) {
      this.encoding = encoding;
      this.clearCache();
      this.emit('encodingChanged', encoding);
    }
  }

  /**
   * 获取当前编码
   */
  public getEncoding(): EncodingType {
    return this.encoding;
  }

  /**
   * 加载指定范围的文件内容
   * @param start 起始行号
   * @param end 结束行号
   */
  async loadChunk(start: number, end: number): Promise<LoadChunkResult> {
    try {
      const chunkIndex = Math.floor(start / this.chunkSize);
      
      // 检查缓存
      if (this.cachedChunks.has(chunkIndex)) {
        return this.cachedChunks.get(chunkIndex)!;
      }

      // 计算文件偏移
      const fileOffset = chunkIndex * this.chunkSize;
      
      // 使用 worker 读取数据
      const readRequest: ReadRequest = {
        filePath: this.filePath,
        start: fileOffset,
        size: this.chunkSize,
        encoding: this.encoding
      };
      const { content } = await this.worker.execute<{ content: string }>({
        type: 'read',
        data: readRequest
      });
      let lines = content.split(/\r?\n/);

      // 应用过滤
      const isFiltered = !!this.currentFilter;
      if (isFiltered && this.currentFilter) {
        const filterRequest: FilterRequest = {
          content: lines,
          ...this.currentFilter
        };
        lines = await this.worker.execute<string[]>({
          type: 'filter',
          data: filterRequest
        });
      }

      const result: LoadChunkResult = {
        content: lines,
        startLine: start,
        endLine: start + lines.length,
        isFiltered
      };

      // 缓存结果
      this.cachedChunks.set(chunkIndex, result);
      
      // 检查内存使用
      this.checkMemoryUsage();
      
      // 预加载下一块
      if (chunkIndex > this.lastChunkIndex) {
        this.lastChunkIndex = chunkIndex;
        this.preloadNextChunk();
      }

      return result;
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.FILE_NOT_FOUND);
      throw error;
    }
  }

  /**
   * 应用过滤条件
   * @param filter 过滤配置
   */
  applyFilter(filter: FilterConfig): void {
    this.currentFilter = filter;
    this.clearCache();
    this.emit('filterChanged', filter);
  }

  /**
   * 清除过滤条件
   */
  clearFilter(): void {
    this.currentFilter = null;
    this.clearCache();
    this.emit('filterCleared');
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cachedChunks.clear();
    this.emit('cacheCleared');
  }

  /**
   * 检查并清理内存
   */
  private checkMemoryUsage(): void {
    const currentUsage = this.calculateMemoryUsage();
    
    if (currentUsage > this.maxMemoryUsage) {
      // 删除最旧的缓存，直到内存使用量低于限制
      const sortedChunks = Array.from(this.cachedChunks.keys()).sort();
      while (this.calculateMemoryUsage() > this.maxMemoryUsage * 0.8) {
        const oldestChunk = sortedChunks.shift();
        if (oldestChunk !== undefined) {
          this.cachedChunks.delete(oldestChunk);
        } else {
          break;
        }
      }
      this.emit('memoryCleared');
    }
  }

  /**
   * 计算内存使用量
   */
  private calculateMemoryUsage(): number {
    let size = 0;
    for (const chunk of this.cachedChunks.values()) {
      size += chunk.content.reduce((acc, line) => acc + line.length * 2, 0); // 假设每个字符占2字节
    }
    return size;
  }

  /**
   * 预加载下一个块
   */
  private async preloadNextChunk(): Promise<void> {
    try {
      const nextChunkIndex = this.lastChunkIndex + 1;
      const fileOffset = nextChunkIndex * this.chunkSize;
      
      // 检查是否超出文件大小
      const fileInfo = await this.getFileInfo();
      if (fileOffset >= fileInfo.size) {
        return;
      }

      // 异步预加载
      const readRequest: ReadRequest = {
        filePath: this.filePath,
        start: fileOffset,
        size: this.chunkSize,
        encoding: this.encoding
      };
      const { content } = await this.worker.execute<{ content: string }>({
        type: 'read',
        data: readRequest
      });
      let lines = content.split(/\r?\n/);
      
      if (this.currentFilter) {
        const filterRequest: FilterRequest = {
          content: lines,
          ...this.currentFilter
        };
        lines = await this.worker.execute<string[]>({
          type: 'filter',
          data: filterRequest
        });
      }

      this.cachedChunks.set(nextChunkIndex, {
        content: lines,
        startLine: nextChunkIndex * this.chunkSize,
        endLine: nextChunkIndex * this.chunkSize + lines.length,
        isFiltered: !!this.currentFilter
      });

      this.checkMemoryUsage();
    } catch (error) {
      // 预加载错误不抛出，只记录
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
    }
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    this.worker.destroy();
    this.removeAllListeners();
  }
} 