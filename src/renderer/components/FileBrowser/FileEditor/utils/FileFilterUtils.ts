/**
 * 文件过滤工具函数
 */

import { EditorErrorType } from '../types/FileEditorTypes';

/**
 * 应用过滤条件到文本行
 * @param lines 文本行数组
 * @param filter 过滤配置
 */
export function applyFilter(lines: string[], filter: { pattern: string; isRegex: boolean; caseSensitive: boolean }): string[] {
  if (!filter.pattern) {
    return lines;
  }

  let regex: RegExp;
  if (filter.isRegex) {
    try {
      regex = new RegExp(filter.pattern, filter.caseSensitive ? 'g' : 'gi');
    } catch {
      throw new Error(EditorErrorType.FILTER_ERROR);
    }
  } else {
    const escaped = filter.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    regex = new RegExp(escaped, filter.caseSensitive ? 'g' : 'gi');
  }

  return lines.filter(line => regex.test(line));
}

/**
 * 计算过滤结果的统计信息
 * @param filteredLines 过滤后的文本行
 * @param totalLines 总行数
 */
export function calculateFilterStats(filteredLines: string[], totalLines: number) {
  return {
    matchedLines: filteredLines.length,
    totalLines,
    matchPercentage: (filteredLines.length / totalLines) * 100
  };
}

/**
 * 验证过滤表达式的有效性
 * @param pattern 过滤表达式
 * @param isRegex 是否为正则表达式
 */
export function validateFilterPattern(pattern: string, isRegex: boolean): boolean {
  if (!isRegex) {
    return true;
  }
  
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
} 