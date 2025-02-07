import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedContext } from '../../core/types/context.types';
import { ScoringFactor } from './ScoringFactor';

/**
 * 基于最近使用的评分因子
 */
export class RecencyScoring extends ScoringFactor {
  /**
   * 最大考虑时间（毫秒）
   * 超过这个时间的命令将得到0分
   */
  private readonly MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7天

  /**
   * 计算基于最近使用的得分
   * @param suggestion 补全建议
   * @param context 上下文信息
   * @returns 0-1之间的得分，最近使用过的命令得分越高
   */
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedContext | string
  ): number {
    if (typeof context === 'string') {
      return 0;
    }

    try {
      // 1. 获取命令统计信息
      const stats = this.getCommandStats(suggestion.fullCommand, context);
      if (!stats) {
        return 0;
      }

      // 2. 计算时间衰减得分
      const age = Date.now() - new Date(stats.lastUsed).getTime();
      if (age > this.MAX_AGE) {
        return 0;
      }

      // 使用指数衰减函数计算得分
      return Math.exp(-age / this.MAX_AGE);

    } catch (error) {
      console.error('[RecencyScoring] 计算最近使用得分时出错:', error);
      return 0;
    }
  }
} 