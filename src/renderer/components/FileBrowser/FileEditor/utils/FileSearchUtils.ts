/**
 * 文件搜索工具函数
 */

import { EditorErrorType } from '../types/FileEditorTypes';

export interface SearchMatch {
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

/**
 * 在文本行中搜索匹配项
 * @param lines 文本行数组
 * @param searchConfig 搜索配置
 */
export function searchInLines(
  lines: string[],
  searchConfig: {
    query: string;
    isRegex: boolean;
    caseSensitive: boolean;
    wholeWord: boolean;
  }
): SearchMatch[] {
  if (!searchConfig.query) {
    return [];
  }

  let regex: RegExp;
  if (searchConfig.isRegex) {
    try {
      const flags = searchConfig.caseSensitive ? 'g' : 'gi';
      regex = new RegExp(searchConfig.query, flags);
    } catch {
      throw new Error(EditorErrorType.FILTER_ERROR);
    }
  } else {
    const escaped = searchConfig.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = searchConfig.wholeWord ? `\\b${escaped}\\b` : escaped;
    regex = new RegExp(pattern, searchConfig.caseSensitive ? 'g' : 'gi');
  }

  const matches: SearchMatch[] = [];
  lines.forEach((line, index) => {
    let match;
    while ((match = regex.exec(line)) !== null) {
      matches.push({
        lineNumber: index + 1,
        lineContent: line,
        matchStart: match.index,
        matchEnd: match.index + match[0].length
      });
    }
  });

  return matches;
}

/**
 * 计算搜索结果的统计信息
 * @param matches 搜索匹配结果
 */
export function calculateSearchStats(matches: SearchMatch[]) {
  const uniqueLines = new Set(matches.map(m => m.lineNumber));
  return {
    totalMatches: matches.length,
    matchedLines: uniqueLines.size
  };
}

/**
 * 验证搜索表达式的有效性
 * @param pattern 搜索表达式
 * @param isRegex 是否为正则表达式
 */
export function validateSearchPattern(pattern: string, isRegex: boolean): boolean {
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