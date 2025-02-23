/**
 * 过滤管理器
 * 负责文件内容的过滤功能
 */

import { EventEmitter } from 'events';
import { EditorEvents } from '../types/FileEditorTypes';
import { ErrorManager, ErrorType } from './ErrorManager';
import { FileWorker } from './FileWorker';

export interface FilterConfig {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
}

export interface FilterStats {
  matchedLines: number;
  totalLines: number;
  processedSize: number;
}

export class FilterManager extends EventEmitter {
  private worker: FileWorker;
  private errorManager: ErrorManager;
  private currentConfig: FilterConfig | null = null;
  private stats: FilterStats = {
    matchedLines: 0,
    totalLines: 0,
    processedSize: 0
  };

  constructor(errorManager: ErrorManager) {
    super();
    this.errorManager = errorManager;
    this.worker = new FileWorker();
  }

  /**
   * 设置过滤条件
   */
  public setFilter(config: FilterConfig): void {
    this.currentConfig = config;
    this.resetStats();
    this.emit(EditorEvents.FILTER_APPLIED, config);
  }

  /**
   * 清除过滤条件
   */
  public clearFilter(): void {
    this.currentConfig = null;
    this.resetStats();
    this.emit(EditorEvents.FILTER_CLEARED);
  }

  /**
   * 处理文本块
   */
  public async processChunk(lines: string[]): Promise<string[]> {
    try {
      if (!this.currentConfig || !this.currentConfig.pattern) {
        this.updateStats(lines.length, lines.length, this.calculateSize(lines));
        return lines;
      }

      const filteredLines = await this.worker.execute<string[]>({
        type: 'filter',
        data: {
          content: lines,
          ...this.currentConfig
        }
      });

      this.updateStats(filteredLines.length, lines.length, this.calculateSize(lines));
      return filteredLines;
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
      return lines;
    }
  }

  /**
   * 获取过滤统计信息
   */
  public getStats(): FilterStats {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  private resetStats(): void {
    this.stats = {
      matchedLines: 0,
      totalLines: 0,
      processedSize: 0
    };
  }

  /**
   * 更新统计信息
   */
  private updateStats(matchedLines: number, totalLines: number, processedSize: number): void {
    this.stats.matchedLines += matchedLines;
    this.stats.totalLines += totalLines;
    this.stats.processedSize += processedSize;
    this.emit('statsUpdated', this.stats);
  }

  /**
   * 计算文本大小（字节）
   */
  private calculateSize(lines: string[]): number {
    return lines.reduce((size, line) => size + line.length * 2, 0); // 假设每个字符占2字节
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    this.worker.destroy();
    this.removeAllListeners();
  }
} 