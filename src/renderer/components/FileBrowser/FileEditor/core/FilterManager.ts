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
  private currentConfig: FilterConfig | null = null;

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
    this.currentConfig = config;

    await this.reloadWithFilter();
  }

  /**
   * 重新加载并应用过滤
   */
  async reloadWithFilter(): Promise<void> {
    if (!this.filterActive || !this.currentConfig) {
      return;
    }

    try {
      // 发出过滤开始事件
      this.emit(EditorEvents.FILTER_STARTED);

      // 使用服务端grep过滤
      const result = await sftpService.grepFile(
        this.sessionId,
        this.filePath,
        this.pattern,
        {
          isRegex: this.isRegex,
          caseSensitive: this.caseSensitive
        }
      );

      // 更新统计信息
      this.totalLines = result.totalLines;
      this.matchedLines = result.matchedLines;

      // 发送过滤结果
      this.emit(EditorEvents.FILTER_PARTIAL_RESULTS, result.content);

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
   * 清除过滤条件
   */
  clearFilter(): void {
    this.pattern = '';
    this.isRegex = false;
    this.caseSensitive = false;
    this.filterActive = false;
    this.currentConfig = null;
    this.totalLines = 0;
    this.matchedLines = 0;

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
    return this.currentConfig;
  }

  /**
   * 获取过滤统计信息
   */
  getFilterStats(): {
    matchedLines: number;
    totalLines: number;
  } {
    return {
      matchedLines: this.matchedLines,
      totalLines: this.totalLines
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