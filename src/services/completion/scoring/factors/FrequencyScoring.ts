import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedContext } from '../../core/types/context.types';
import { ScoringFactor } from './ScoringFactor';

/**
 * 基于命令使用频率的评分因子
 */
export class FrequencyScoring extends ScoringFactor {
  /**
   * 最大考虑频率
   * 当命令使用次数达到这个值时，频率得分为1
   */
  private readonly MAX_FREQUENCY = 100;

  /**
   * 计算基于使用频率的得分
   * @param suggestion 补全建议
   * @param context 增强的补全上下文
   * @returns 0-1之间的得分，使用频率越高分数越高
   */
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedContext
  ): number {
    try {
      // 1. 从命令历史统计中查找当前命令的使用频率
      const commandStats = this.getCommandStats(suggestion.fullCommand, context);

      if (!commandStats) {
        return 0;
      }

      // 2. 计算归一化的频率得分 (0-1)
      return Math.min(commandStats.frequency / this.MAX_FREQUENCY, 1);

    } catch (error) {
      console.error('[FrequencyScoring] 计算频率得分时出错:', error);
      return 0;
    }
  }

  /**
   * 获取指定时间段内的命令使用频率
   */
  private getFrequencyInPeriod(
    suggestion: CompletionSuggestion,
    context: EnhancedContext,
    days: number
  ): number {
    const recentCommands = this.getRecentCommands(context);
    if (!recentCommands.length) {
      return 0;
    }

    const cutoffTime = new Date();
    cutoffTime.setDate(cutoffTime.getDate() - days);

    return recentCommands.filter(cmd => {
      const cmdTime = new Date(cmd.timestamp);
      return cmdTime >= cutoffTime && cmd.command === suggestion.fullCommand;
    }).length;
  }
} 