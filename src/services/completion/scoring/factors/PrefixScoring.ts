import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedContext } from '../../core/types/context.types';
import { ScoringFactor } from './ScoringFactor';

/**
 * 基于前缀匹配的评分因子
 */
export class PrefixScoring extends ScoringFactor {
  /**
   * 计算基于前缀匹配的得分
   * @param suggestion 补全建议
   * @param context 输入字符串
   * @returns 0-1之间的得分，前缀匹配度越高分数越高
   */
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedContext | string
  ): number {
    if (typeof context !== 'string') {
      return 0;
    }

    try {
      const input = context.toLowerCase();
      const command = suggestion.fullCommand.toLowerCase();

      // 1. 完全匹配
      if (command === input) {
        return 1;
      }

      // 2. 前缀匹配
      if (command.startsWith(input)) {
        // 根据匹配长度计算得分
        return 0.7 + (input.length / command.length) * 0.3;
      }

      // 3. 部分匹配
      const parts = command.split(' ');
      for (const part of parts) {
        if (part.startsWith(input)) {
          // 参数匹配得分稍低
          return 0.5 + (input.length / part.length) * 0.3;
        }
      }

      // 4. 模糊匹配
      if (this.calculateFuzzyScore(input, command) > 0.8) {
        return 0.4;
      }

      return 0;

    } catch (error) {
      console.error('[PrefixScoring] 计算前缀匹配得分时出错:', error);
      return 0;
    }
  }

  /**
   * 计算模糊匹配得分
   */
  private calculateFuzzyScore(input: string, target: string): number {
    let score = 0;
    let lastMatchIndex = -1;
    let consecutiveMatches = 0;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const index = target.indexOf(char, lastMatchIndex + 1);

      if (index > -1) {
        // 找到匹配字符
        score++;

        // 连续匹配加分
        if (index === lastMatchIndex + 1) {
          consecutiveMatches++;
          score += consecutiveMatches * 0.1;
        } else {
          consecutiveMatches = 0;
        }

        lastMatchIndex = index;
      }
    }

    return score / Math.max(input.length, target.length);
  }
} 