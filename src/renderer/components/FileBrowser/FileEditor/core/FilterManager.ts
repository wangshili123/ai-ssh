/**
 * 过滤管理器
 * 负责处理文件内容的过滤功能
 */

import { EventEmitter } from 'events';
import { FilterConfig } from '../types/FileEditorTypes';

export class FilterManager extends EventEmitter {
  private pattern: string = '';
  private isRegex: boolean = false;
  private caseSensitive: boolean = false;
  private filterActive: boolean = false;

  /**
   * 应用过滤条件
   */
  applyFilter(config: FilterConfig): void {
    this.pattern = config.pattern;
    this.isRegex = config.isRegex;
    this.caseSensitive = config.caseSensitive;
    this.filterActive = true;
  }

  /**
   * 清除过滤条件
   */
  clearFilter(): void {
    this.pattern = '';
    this.isRegex = false;
    this.caseSensitive = false;
    this.filterActive = false;
  }

  /**
   * 过滤文本内容
   */
  filterContent(content: string[]): string[] {
    if (!this.filterActive || !this.pattern) {
      return content;
    }

    try {
      let regex: RegExp;
      if (this.isRegex) {
        regex = new RegExp(this.pattern, this.caseSensitive ? 'g' : 'gi');
      } else {
        const escaped = this.pattern.replace(/[-/\\^$*+?.()|[\\]{}]/g, '\\$&');
        regex = new RegExp(escaped, this.caseSensitive ? 'g' : 'gi');
      }

      return content.filter(line => regex.test(line));
    } catch (error) {
      console.error('过滤内容失败:', error);
      return content;
    }
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
} 