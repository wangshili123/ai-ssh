/**
 * 过滤管理器
 * 负责处理文件内容的过滤功能
 */

import { EventEmitter } from 'events';
import { FilterConfig, EditorEvents } from '../types/FileEditorTypes';
import { sftpService } from '../../../../services/sftp';

export class FilterManager extends EventEmitter {
  private sessionId: string = '';
  private filePath: string = '';
  private pattern: string = '';
  private isRegex: boolean = false;
  private caseSensitive: boolean = false;
  private filterActive: boolean = false;
  private totalLines: number = 0;
  private matchedLines: number = 0;
  private processedSize: number = 0;
  private chunkSize: number = 1024 * 1024; // 1MB

  /**
   * 初始化过滤管理器
   */
  initialize(sessionId: string, filePath: string): void {
    this.sessionId = sessionId;
    this.filePath = filePath;
  }

  /**
   * 应用过滤条件
   */
  async applyFilter(config: FilterConfig): Promise<void> {
    this.pattern = config.pattern;
    this.isRegex = config.isRegex;
    this.caseSensitive = config.caseSensitive;
    this.filterActive = true;

    // 重置统计信息
    this.totalLines = 0;
    this.matchedLines = 0;
    this.processedSize = 0;

    try {
      // 获取文件大小
      const stats = await sftpService.stat(this.sessionId, this.filePath);
      const totalSize = stats.size;

      // 发出过滤开始事件
      this.emit(EditorEvents.FILTER_STARTED);

      // 分块过滤
      let offset = 0;
      while (offset < totalSize) {
        const length = Math.min(this.chunkSize, totalSize - offset);
        await this.filterChunk(offset, length);
        offset += length;

        // 更新进度
        this.processedSize = offset;
        this.emit(EditorEvents.FILTER_PROGRESS, {
          processedSize: this.processedSize,
          totalSize
        });
      }

      // 发出过滤完成事件
      this.emit(EditorEvents.FILTER_COMPLETED, {
        matchedLines: this.matchedLines,
        totalLines: this.totalLines
      });
    } catch (error) {
      this.emit(EditorEvents.FILTER_ERROR, error);
      throw error;
    }
  }

  /**
   * 过滤文件块
   */
  private async filterChunk(offset: number, length: number): Promise<void> {
    try {
      // 读取文件块
      const result = await sftpService.readFile(
        this.sessionId,
        this.filePath,
        offset,
        length
      );

      const lines = result.content.split(/\r?\n/);
      const filteredLines = this.filterLines(lines);

      this.totalLines += lines.length;
      this.matchedLines += filteredLines.length;

      // 发出部分结果事件
      this.emit(EditorEvents.FILTER_PARTIAL_RESULTS, filteredLines);
    } catch (error) {
      console.error('过滤文件块失败:', error);
      throw error;
    }
  }

  /**
   * 过滤文本行
   */
  private filterLines(lines: string[]): string[] {
    if (!this.pattern) return lines;

    try {
      let regex: RegExp;
      if (this.isRegex) {
        regex = new RegExp(this.pattern, this.caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = this.pattern.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&');
        regex = new RegExp(escaped, this.caseSensitive ? 'g' : 'gi');
      }

      return lines.filter(line => regex.test(line));
    } catch (error) {
      console.error('过滤文本失败:', error);
      return lines;
    }
  }

  /**
   * 清除过滤条件
   */
  clearFilter(): void {
    this.pattern = '';
    this.isRegex = false;
    this.caseSensitive = false;
    this.filterActive = false;
    this.totalLines = 0;
    this.matchedLines = 0;
    this.processedSize = 0;

    this.emit(EditorEvents.FILTER_CLEARED);
  }

  /**
   * 检查是否有活动的过滤器
   */
  isFilterActive(): boolean {
    return this.filterActive;
  }

  /**
   * 获取当前过滤配置
   */
  getFilterConfig(): FilterConfig | null {
    if (!this.filterActive) {
      return null;
    }

    return {
      pattern: this.pattern,
      isRegex: this.isRegex,
      caseSensitive: this.caseSensitive
    };
  }

  /**
   * 获取过滤统计信息
   */
  getFilterStats(): {
    matchedLines: number;
    totalLines: number;
    processedSize: number;
  } {
    return {
      matchedLines: this.matchedLines,
      totalLines: this.totalLines,
      processedSize: this.processedSize
    };
  }

  /**
   * 销毁过滤管理器
   */
  destroy(): void {
    this.clearFilter();
    this.removeAllListeners();
  }
} 