import { CompletionRule } from '../../learning/analyzer/optimizer/types/rule-optimizer.types';
import { EnhancedContext } from '../../core/types/context.types';

/**
 * 规则匹配器基类
 * 定义规则匹配的基本接口和通用功能
 */
export abstract class RuleMatcher {
  /**
   * 匹配规则
   * @returns 返回 0-1 之间的分数，0 表示不匹配，1 表示完全匹配
   */
  abstract match(
    rule: CompletionRule,
    input: string,
    context: EnhancedContext
  ): number;

  /**
   * 计算字符串相似度（0-1）
   */
  protected calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }

    // 计算编辑距离
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * 计算编辑距离
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    // 初始化矩阵
    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str2.length; j++) {
      matrix[0][j] = j;
    }

    // 填充矩阵
    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // 替换
            matrix[i][j - 1] + 1,     // 插入
            matrix[i - 1][j] + 1      // 删除
          );
        }
      }
    }

    return matrix[str1.length][str2.length];
  }

  /**
   * 检查字符串前缀匹配
   */
  protected checkPrefixMatch(input: string, pattern: string): number {
    if (!input) {
      return 0;
    }

    // 如果输入完全匹配模式的开头部分，给出高分
    if (pattern.toLowerCase().startsWith(input.toLowerCase())) {
      return 0.8 + (input.length / pattern.length) * 0.2;
    }

    return 0;
  }
} 