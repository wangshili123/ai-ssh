/**
 * 搜索管理器
 * 负责处理文件内容的搜索功能
 */

import { EventEmitter } from 'events';
import { EditorEvents, SearchConfig, SearchResult } from '../types/FileEditorTypes';
import { sftpService } from '../../../../services/sftp';

export class SearchManager extends EventEmitter {
  private sessionId: string = '';
  private filePath: string = '';
  private searchConfig: SearchConfig | null = null;
  private isSearching: boolean = false;
  private shouldStop: boolean = false;
  private currentMatch: number = 0;
  private totalMatches: number = 0;
  private searchedBytes: number = 0;
  private totalBytes: number = 0;
  private chunkSize: number = 1024 * 1024; // 1MB
  private currentPattern: string = '';

  /**
   * 初始化搜索管理器
   */
  initialize(sessionId: string, filePath: string): void {
    this.sessionId = sessionId;
    this.filePath = filePath;
  }

  /**
   * 开始搜索
   */
  async startSearch(config: SearchConfig): Promise<void> {
    if (this.isSearching) {
      await this.stopSearch();
    }

    this.searchConfig = config;
    this.currentPattern = config.pattern;
    this.isSearching = true;
    this.shouldStop = false;
    this.currentMatch = 0;
    this.totalMatches = 0;
    this.searchedBytes = 0;

    try {
      // 获取文件大小
      const stats = await sftpService.stat(this.sessionId, this.filePath);
      this.totalBytes = stats.size;

      // 发出搜索开始事件
      this.emit(EditorEvents.SEARCH_STARTED);

      // 分块搜索
      let offset = 0;
      while (offset < this.totalBytes && !this.shouldStop) {
        const length = Math.min(this.chunkSize, this.totalBytes - offset);
        await this.searchChunk(offset, length);
        offset += length;

        // 更新进度
        this.searchedBytes = offset;
        this.emit(EditorEvents.SEARCH_PROGRESS, {
          searchedBytes: this.searchedBytes,
          totalBytes: this.totalBytes
        });
      }

      // 发出搜索完成事件
      this.emit(EditorEvents.SEARCH_COMPLETED, {
        totalMatches: this.totalMatches
      });
    } catch (error) {
      this.emit(EditorEvents.SEARCH_ERROR, error);
    } finally {
      this.isSearching = false;
    }
  }

  /**
   * 搜索文件块
   */
  private async searchChunk(offset: number, length: number): Promise<void> {
    if (!this.searchConfig) return;

    try {
      // 读取文件块
      const result = await sftpService.readFile(
        this.sessionId,
        this.filePath,
        offset,
        length
      );

      const lines = result.content.split(/\r?\n/);
      const matches = this.findMatches(lines, offset);

      if (matches.length > 0) {
        this.totalMatches += matches.length;
        this.emit(EditorEvents.SEARCH_PARTIAL_RESULTS, matches);
      }
    } catch (error) {
      console.error('搜索文件块失败:', error);
      throw error;
    }
  }

  /**
   * 在文本中查找匹配
   */
  private findMatches(lines: string[], offset: number): SearchResult[] {
    if (!this.searchConfig) return [];

    const { pattern, isRegex, caseSensitive, wholeWord } = this.searchConfig;
    const results: SearchResult[] = [];

    try {
      let regex: RegExp;
      if (isRegex) {
        regex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = pattern.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&');
        const searchPattern = wholeWord ? `\\b${escaped}\\b` : escaped;
        regex = new RegExp(searchPattern, caseSensitive ? 'g' : 'gi');
      }

      let lineOffset = 0;
      lines.forEach((line, index) => {
        let match;
        while ((match = regex.exec(line)) !== null) {
          const previewStart = Math.max(0, match.index - 50);
          const previewEnd = Math.min(line.length, match.index + match[0].length + 50);
          const preview = line.substring(previewStart, previewEnd);

          results.push({
            lineNumber: index + 1,
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
            previewText: preview
          });
        }
        lineOffset += line.length + 1; // +1 for newline
      });

      return results;
    } catch (error) {
      console.error('查找匹配失败:', error);
      return [];
    }
  }

  /**
   * 停止搜索
   */
  async stopSearch(): Promise<void> {
    this.shouldStop = true;
    while (this.isSearching) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * 获取搜索状态
   */
  getSearchStats(): {
    currentMatch: number;
    totalMatches: number;
    searchedBytes: number;
    totalBytes: number;
    isSearching: boolean;
  } {
    return {
      currentMatch: this.currentMatch,
      totalMatches: this.totalMatches,
      searchedBytes: this.searchedBytes,
      totalBytes: this.totalBytes,
      isSearching: this.isSearching
    };
  }

  /**
   * 设置当前匹配
   */
  setCurrentMatch(index: number): void {
    if (index >= 0 && index < this.totalMatches) {
      this.currentMatch = index;
      this.emit(EditorEvents.SEARCH_MATCH_CHANGED, this.currentMatch);
    }
  }

  /**
   * 获取当前匹配索引
   */
  getCurrentMatch(): number {
    return this.currentMatch;
  }

  /**
   * 获取总匹配数
   */
  getTotalMatches(): number {
    return this.totalMatches;
  }

  /**
   * 跳转到下一个匹配项
   */
  nextMatch(): boolean {
    if (this.totalMatches === 0) return false;
    
    this.currentMatch = (this.currentMatch + 1) % this.totalMatches;
    this.emit(EditorEvents.SEARCH_MATCH_CHANGED, this.currentMatch);
    return true;
  }

  /**
   * 跳转到上一个匹配项
   */
  previousMatch(): boolean {
    if (this.totalMatches === 0) return false;
    
    this.currentMatch = (this.currentMatch - 1 + this.totalMatches) % this.totalMatches;
    this.emit(EditorEvents.SEARCH_MATCH_CHANGED, this.currentMatch);
    return true;
  }

  /**
   * 销毁搜索管理器
   */
  destroy(): void {
    this.stopSearch();
    this.removeAllListeners();
  }

  /**
   * 获取当前搜索模式
   */
  getCurrentPattern(): string {
    return this.currentPattern;
  }
}

export { SearchResult, SearchConfig };
