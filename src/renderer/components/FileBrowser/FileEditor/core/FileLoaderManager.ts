/**
 * 文件加载管理器
 * 负责大文件的分块加载、过滤和内存管理
 */

import { EventEmitter } from 'events';
import { EditorEvents, RemoteFileInfo, EncodingType } from '../types/FileEditorTypes';
import { ErrorManager, ErrorType } from './ErrorManager';
import { sftpService } from '../../../../services/sftp';
import { detectEncoding, isValidEncoding } from '../utils/FileEncodingUtils';
import { VirtualScroller, ScrollConfig, ScrollState } from './VirtualScroller';

const LARGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const INITIAL_CHUNK_SIZE = 1024 * 1024; // 1MB
const DEFAULT_LINE_HEIGHT = 20; // 默认行高
const DEFAULT_BLOCK_SIZE = 1000; // 默认块大小（行数）
const DEFAULT_PRELOAD_BLOCKS = 2; // 默认预加载块数
const MAX_CACHED_BLOCKS = 10; // 最大缓存块数

export interface FileInfo {
  size: number;
  modifyTime: number;
  isPartiallyLoaded: boolean;
  totalLines: number;
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

interface FileChunk {
  content: string;
  startLine: number;
  endLine: number;
  lastAccessed: number;
  accessCount: number;
}

export class FileLoaderManager extends EventEmitter {
  private sessionId: string;
  private filePath: string;
  private errorManager: ErrorManager;
  private fileInfo: RemoteFileInfo | null = null;
  private encoding: EncodingType = 'UTF-8';
  private chunks: Map<number, FileChunk> = new Map();
  private virtualScroller: VirtualScroller;
  private containerHeight: number = 800; // 默认容器高度
  private estimatedTotalLines: number = 0;
  private lineCount: number = 0;
  private isCountingLines: boolean = false;

  constructor(sessionId: string, filePath: string, errorManager: ErrorManager) {
    super();
    this.sessionId = sessionId;
    this.filePath = filePath;
    this.errorManager = errorManager;

    // 初始化虚拟滚动器
    this.virtualScroller = new VirtualScroller({
      blockSize: DEFAULT_BLOCK_SIZE,
      preloadBlocks: DEFAULT_PRELOAD_BLOCKS,
      lineHeight: DEFAULT_LINE_HEIGHT,
      containerHeight: this.containerHeight,
      totalLines: 0
    });
  }

  /**
   * 初始化文件加载器
   */
  public async initialize(): Promise<void> {
    try {
      const stats = await sftpService.stat(this.sessionId, this.filePath);
      this.fileInfo = {
        size: stats.size,
        modifyTime: stats.modifyTime,
        isDirectory: stats.isDirectory,
        permissions: stats.permissions,
        encoding: this.encoding,
        isPartiallyLoaded: true
      };

      // 估算总行数
      this.estimatedTotalLines = Math.ceil(stats.size / 50); // 假设每行平均50字节
      this.virtualScroller.updateConfig({
        totalLines: this.estimatedTotalLines
      });

      // 开始统计实际行数
      this.countTotalLines();

      // 加载初始可见区域
      await this.loadInitialContent();
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.FILE_NOT_FOUND);
    }
  }

  /**
   * 统计文件总行数
   */
  private async countTotalLines(): Promise<void> {
    if (this.isCountingLines) return;
    this.isCountingLines = true;

    try {
      let offset = 0;
      let lineCount = 0;
      const chunkSize = 1024 * 1024; // 1MB

      while (offset < this.fileInfo!.size) {
        const result = await sftpService.readFile(
          this.sessionId,
          this.filePath,
          offset,
          chunkSize
        );

        lineCount += result.content.split('\n').length - 1;
        offset += chunkSize;

        // 更新估算的总行数
        this.estimatedTotalLines = lineCount;
        this.virtualScroller.updateConfig({
          totalLines: this.estimatedTotalLines
        });
      }

      this.lineCount = lineCount;
      this.virtualScroller.updateConfig({
        totalLines: lineCount
      });
    } catch (error) {
      console.error('统计行数失败:', error);
    } finally {
      this.isCountingLines = false;
    }
  }

  /**
   * 加载初始内容
   */
  private async loadInitialContent(): Promise<void> {
    try {
      this.emit(EditorEvents.LOADING_START);
      
      // 加载第一个块
      const firstChunk = await this.loadChunk(0, DEFAULT_BLOCK_SIZE);
      if (firstChunk) {
        this.chunks.set(0, {
          ...firstChunk,
          lastAccessed: Date.now(),
          accessCount: 1
        });
      }

      this.emit(EditorEvents.PARTIAL_LOAD);
      this.emit(EditorEvents.LOADING_END);
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
    }
  }

  /**
   * 处理滚动事件
   */
  public async handleScroll(scrollTop: number): Promise<void> {
    const scrollState = this.virtualScroller.calculateScrollState(scrollTop);
    
    // 加载需要的块
    for (const blockIndex of scrollState.blocksToLoad) {
      await this.loadBlock(blockIndex);
    }

    // 释放不需要的块
    for (const blockIndex of scrollState.blocksToRelease) {
      this.releaseBlock(blockIndex);
    }

    this.emit('scrollStateChanged', scrollState);
  }

  /**
   * 加载指定块
   */
  private async loadBlock(blockIndex: number): Promise<void> {
    if (this.chunks.has(blockIndex)) {
      // 更新访问信息
      const chunk = this.chunks.get(blockIndex)!;
      chunk.lastAccessed = Date.now();
      chunk.accessCount++;
      return;
    }

    try {
      const [startLine, endLine] = this.virtualScroller.getBlockRange(blockIndex);
      const chunk = await this.loadChunk(startLine, endLine - startLine);
      
      if (chunk) {
        // 缓存管理
        if (this.chunks.size >= MAX_CACHED_BLOCKS) {
          this.evictLeastUsedChunk();
        }

        this.chunks.set(blockIndex, {
          ...chunk,
          lastAccessed: Date.now(),
          accessCount: 1
        });
      }
    } catch (error) {
      console.error(`加载块 ${blockIndex} 失败:`, error);
    }
  }

  /**
   * 释放指定块
   */
  private releaseBlock(blockIndex: number): void {
    this.chunks.delete(blockIndex);
  }

  /**
   * 清除最少使用的块
   */
  private evictLeastUsedChunk(): void {
    let leastUsedBlock: number | null = null;
    let leastUsedTime = Infinity;

    for (const [blockIndex, chunk] of this.chunks.entries()) {
      const score = chunk.lastAccessed + (chunk.accessCount * 1000);
      if (score < leastUsedTime) {
        leastUsedTime = score;
        leastUsedBlock = blockIndex;
      }
    }

    if (leastUsedBlock !== null) {
      this.chunks.delete(leastUsedBlock);
    }
  }

  /**
   * 加载指定范围的内容
   */
  private async loadChunk(startLine: number, lineCount: number): Promise<FileChunk | null> {
    try {
      // 计算大致的字节范围
      const estimatedStart = startLine * 50; // 假设每行平均50字节
      const estimatedLength = lineCount * 50;

      const result = await sftpService.readFile(
        this.sessionId,
        this.filePath,
        estimatedStart,
        estimatedLength,
        this.encoding as BufferEncoding
      );

      return {
        content: result.content,
        startLine,
        endLine: startLine + lineCount,
        lastAccessed: Date.now(),
        accessCount: 1
      };
    } catch (error) {
      console.error('加载内容块失败:', error);
      return null;
    }
  }

  /**
   * 获取指定行范围的内容
   */
  public getLines(startLine: number, endLine: number): string[] {
    const lines: string[] = [];
    const blockIndices = new Set<number>();

    // 计算需要的块
    for (let line = startLine; line < endLine; line++) {
      const blockIndex = Math.floor(line / DEFAULT_BLOCK_SIZE);
      blockIndices.add(blockIndex);
    }

    // 从缓存中获取内容
    for (const blockIndex of blockIndices) {
      const chunk = this.chunks.get(blockIndex);
      if (chunk) {
        const chunkLines = chunk.content.split('\n');
        const blockStartLine = blockIndex * DEFAULT_BLOCK_SIZE;
        const relativeStart = Math.max(0, startLine - blockStartLine);
        const relativeEnd = Math.min(chunkLines.length, endLine - blockStartLine);
        lines.push(...chunkLines.slice(relativeStart, relativeEnd));
      }
    }

    return lines;
  }

  /**
   * 更新容器高度
   */
  public updateContainerHeight(height: number): void {
    this.containerHeight = height;
    this.virtualScroller.updateConfig({
      containerHeight: height
    });
  }

  /**
   * 获取总高度
   */
  public getTotalHeight(): number {
    return this.virtualScroller.getTotalHeight();
  }

  /**
   * 获取已加载的块数量
   */
  public getLoadedBlockCount(): number {
    return this.chunks.size;
  }

  /**
   * 清理所有缓存
   */
  public clearCache(): void {
    this.chunks.clear();
    this.virtualScroller.clearLoadedBlocks();
  }

  /**
   * 销毁加载器
   */
  public destroy(): void {
    this.clearCache();
    this.removeAllListeners();
  }
} 