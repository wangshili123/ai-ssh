import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedCompletionContext } from '../../analyzers/types/context.types';

/**
 * 基于输入前缀的匹配评分因子
 */
export class PrefixScoring {
  /**
   * 计算基于前缀匹配的得分
   * @param suggestion 补全建议
   * @param input 用户输入
   * @returns 0-1之间的得分，匹配度越高分数越高
   */
  public calculateScore(
    suggestion: CompletionSuggestion,
    input: string
  ): number {
    console.log('[PrefixScoring] 开始计算前缀匹配得分:', {
      suggestion: suggestion.suggestion,
      input
    });

    try {
      if (!input) {
        console.log('[PrefixScoring] 输入为空, 返回1分');
        return 1;
      }

      const normalizedSuggestion = suggestion.suggestion.toLowerCase();
      const normalizedInput = input.toLowerCase();

      // 1. 完全匹配
      if (normalizedSuggestion === normalizedInput) {
        console.log('[PrefixScoring] 完全匹配, 返回1分');
        return 1;
      }

      // 2. 前缀匹配
      if (normalizedSuggestion.startsWith(normalizedInput)) {
        const score = 0.8 + (0.2 * (normalizedInput.length / normalizedSuggestion.length));
        console.log('[PrefixScoring] 前缀匹配, 得分:', score);
        return score;
      }

      // 3. 子串匹配
      if (normalizedSuggestion.includes(normalizedInput)) {
        const score = 0.4 + (0.2 * (normalizedInput.length / normalizedSuggestion.length));
        console.log('[PrefixScoring] 子串匹配, 得分:', score);
        return score;
      }

      // 4. 模糊匹配（编辑距离）
      const distance = this.calculateLevenshteinDistance(
        normalizedSuggestion,
        normalizedInput
      );
      if (distance <= 2) {
        const score = Math.max(0, 0.3 - (distance * 0.1));
        console.log('[PrefixScoring] 模糊匹配, 编辑距离:', distance, '得分:', score);
        return score;
      }

      console.log('[PrefixScoring] 无匹配, 返回0分');
      return 0;

    } catch (error) {
      console.error('[PrefixScoring] 计算前缀匹配得分时出错:', error);
      return 0;
    }
  }

  /**
   * 计算两个字符串的编辑距离（Levenshtein Distance）
   * @param str1 第一个字符串
   * @param str2 第二个字符串
   * @returns 编辑距离
   */
  private calculateLevenshteinDistance(str1: string, str2: string): number {
    const dp: number[][] = [];
    
    // 初始化第一行和第一列
    for (let i = 0; i <= str1.length; i++) {
      dp[i] = [i];
    }
    for (let j = 0; j <= str2.length; j++) {
      dp[0][j] = j;
    }
    
    // 填充动态规划表
    for (let i = 1; i <= str1.length; i++) {
      for (let j = 1; j <= str2.length; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,     // 删除
            dp[i][j - 1] + 1,     // 插入
            dp[i - 1][j - 1] + 1  // 替换
          );
        }
      }
    }
    
    return dp[str1.length][str2.length];
  }

  /**
   * 计算两个字符串的相似度
   * @param str1 第一个字符串
   * @param str2 第二个字符串
   * @returns 0-1之间的相似度
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const distance = this.calculateLevenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
  }
} 