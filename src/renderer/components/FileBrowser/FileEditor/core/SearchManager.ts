/**
 * 文件搜索管理器
 * 实现磁盘搜索策略，直接从磁盘读取并搜索，减少内存占用
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { EditorEvents, EditorErrorType, SearchConfig, SearchResult, SearchStats } from '../types/FileEditorTypes';
import { ErrorManager, ErrorType } from './ErrorManager';
import { detectEncoding } from '../utils/FileEditorUtils';

export class SearchManager extends EventEmitter {
  private filePath: string;
  private searchConfig: SearchConfig | null = null;
  private searchResults: SearchResult[] = [];
  private currentMatchIndex: number = -1;
  private isSearching: boolean = false;
  private shouldStop: boolean = false;
  private searchCache: Map<string, SearchResult[]> = new Map();
  private chunkSize: number = 1024 * 1024; // 1MB
  private fileHandle: fs.FileHandle | null = null;
  private encoding: BufferEncoding = 'utf8';
  private fileSize: number = 0;

  constructor(filePath: string) {
    super();
    this.filePath = filePath;
  }

  /**
   * 开始搜索
   */
  public async startSearch(config: SearchConfig): Promise<void> {
    try {
      // 如果正在搜索，先停止
      if (this.isSearching) {
        await this.stopSearch();
      }

      this.searchConfig = config;
      this.isSearching = true;
      this.shouldStop = false;
      this.searchResults = [];
      this.currentMatchIndex = -1;

      // 检查缓存
      const cacheKey = this.getCacheKey(config);
      const cachedResults = this.searchCache.get(cacheKey);
      if (cachedResults) {
        this.searchResults = cachedResults;
        this.emit(EditorEvents.SEARCH_COMPLETED, this.getSearchStats());
        return;
      }

      // 打开文件
      this.fileHandle = await fs.open(this.filePath, 'r');
      const stats = await this.fileHandle.stat();
      this.fileSize = stats.size;

      // 检测文件编码
      const headerBuffer = Buffer.alloc(4096);
      await this.fileHandle.read(headerBuffer, 0, 4096, 0);
      const detectedEncoding = detectEncoding(headerBuffer);
      this.encoding = detectedEncoding as BufferEncoding;

      // 发送搜索开始事件
      this.emit(EditorEvents.SEARCH_STARTED, this.getSearchStats());

      let processedBytes = 0;
      let lineNumber = 1;
      let partialLine = '';

      // 分块读取并搜索
      while (processedBytes < this.fileSize && !this.shouldStop) {
        const buffer = Buffer.alloc(this.chunkSize);
        const { bytesRead } = await this.fileHandle.read(
          buffer,
          0,
          this.chunkSize,
          processedBytes
        );

        if (bytesRead === 0) break;

        // 转换为文本
        const chunk = buffer.slice(0, bytesRead).toString(this.encoding);
        
        // 处理跨块的行
        const text = partialLine + chunk;
        const lines = text.split(/\r?\n/);
        
        // 保存最后一行，可能不完整
        partialLine = lines.pop() || '';

        // 搜索当前块的行
        const results = this.searchInLines(lines, lineNumber);
        this.searchResults.push(...results);

        // 更新行号
        lineNumber += lines.length;
        processedBytes += bytesRead;

        // 发送进度更新
        this.emit(EditorEvents.SEARCH_PROGRESS, {
          ...this.getSearchStats(),
          searchedBytes: processedBytes,
          totalBytes: this.fileSize
        });

        // 如果找到了结果，可以先返回一部分
        if (this.searchResults.length > 0 && this.searchResults.length % 100 === 0) {
          this.emit(EditorEvents.SEARCH_PARTIAL_RESULTS, this.searchResults);
        }
      }

      // 处理最后一行
      if (partialLine && !this.shouldStop) {
        const results = this.searchInLines([partialLine], lineNumber);
        this.searchResults.push(...results);
      }

      // 缓存结果
      if (!this.shouldStop) {
        this.searchCache.set(cacheKey, this.searchResults);
      }

      this.isSearching = false;
      this.emit(EditorEvents.SEARCH_COMPLETED, this.getSearchStats());
    } catch (error) {
      this.isSearching = false;
      this.emit(EditorEvents.SEARCH_ERROR, new Error(ErrorType.OPERATION_FAILED));
    } finally {
      // 关闭文件
      if (this.fileHandle) {
        await this.fileHandle.close();
        this.fileHandle = null;
      }
    }
  }

  /**
   * 停止搜索
   */
  public async stopSearch(): Promise<void> {
    this.shouldStop = true;
    this.isSearching = false;
    
    // 关闭文件
    if (this.fileHandle) {
      await this.fileHandle.close();
      this.fileHandle = null;
    }

    this.emit(EditorEvents.SEARCH_STOPPED);
  }

  /**
   * 跳转到下一个匹配项
   */
  public nextMatch(): SearchResult | null {
    if (this.searchResults.length === 0) {
      return null;
    }

    this.currentMatchIndex = (this.currentMatchIndex + 1) % this.searchResults.length;
    const result = this.searchResults[this.currentMatchIndex];
    this.emit(EditorEvents.SEARCH_MATCH_CHANGED, this.getSearchStats());
    return result;
  }

  /**
   * 跳转到上一个匹配项
   */
  public previousMatch(): SearchResult | null {
    if (this.searchResults.length === 0) {
      return null;
    }

    this.currentMatchIndex = this.currentMatchIndex <= 0 
      ? this.searchResults.length - 1 
      : this.currentMatchIndex - 1;
    
    const result = this.searchResults[this.currentMatchIndex];
    this.emit(EditorEvents.SEARCH_MATCH_CHANGED, this.getSearchStats());
    return result;
  }

  /**
   * 在文本行中搜索
   */
  private searchInLines(lines: string[], startLineNumber: number): SearchResult[] {
    if (!this.searchConfig) return [];

    const results: SearchResult[] = [];
    let regex: RegExp;

    try {
      if (this.searchConfig.isRegex) {
        regex = new RegExp(this.searchConfig.pattern, 
          `${this.searchConfig.caseSensitive ? 'g' : 'gi'}`);
      } else {
        const escaped = this.searchConfig.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = this.searchConfig.wholeWord ? `\\b${escaped}\\b` : escaped;
        regex = new RegExp(pattern, 
          `${this.searchConfig.caseSensitive ? 'g' : 'gi'}`);
      }

      lines.forEach((line, index) => {
        let match;
        while ((match = regex.exec(line)) !== null) {
          // 提取匹配行的前后文本片段
          const previewStart = Math.max(0, match.index - 50);
          const previewEnd = Math.min(line.length, match.index + match[0].length + 50);
          const preview = line.substring(previewStart, previewEnd);

          results.push({
            lineNumber: startLineNumber + index,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
            previewText: preview
          });
        }
      });
    } catch (error) {
      this.emit(EditorEvents.SEARCH_ERROR, new Error(ErrorType.OPERATION_FAILED));
      return [];
    }

    return results;
  }

  /**
   * 获取搜索统计信息
   */
  private getSearchStats(): SearchStats {
    return {
      totalMatches: this.searchResults.length,
      currentMatch: this.currentMatchIndex + 1,
      searchedBytes: 0,
      totalBytes: this.fileSize,
      isSearching: this.isSearching
    };
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(config: SearchConfig): string {
    return `${config.pattern}:${config.isRegex}:${config.caseSensitive}:${config.wholeWord}`;
  }

  /**
   * 清理缓存
   */
  public clearCache(): void {
    this.searchCache.clear();
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    this.stopSearch();
    this.clearCache();
    this.removeAllListeners();
  }
} 

export { SearchResult, SearchConfig };
