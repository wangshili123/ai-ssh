import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedCompletionContext } from '../../analyzers/types/context.types';

/**
 * 基于命令使用频率的评分因子
 */
export class FrequencyScoring {
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
    context: EnhancedCompletionContext
  ): number {
    console.log('[FrequencyScoring] 开始计算频率得分:', {
      suggestion: suggestion.suggestion,
      statistics: context.commandHistory.statistics
    });

    try {
      // 1. 从命令历史统计中查找当前命令的使用频率
      const commandStats = context.commandHistory.statistics
        .find(stat => stat.command === suggestion.fullCommand);

      if (!commandStats) {
        console.log('[FrequencyScoring] 未找到命令使用记录, 返回0分');
        return 0;
      }

      // 2. 计算归一化的频率得分 (0-1)
      const normalizedScore = Math.min(commandStats.frequency / this.MAX_FREQUENCY, 1);

      console.log('[FrequencyScoring] 频率得分计算完成:', {
        command: suggestion.fullCommand,
        frequency: commandStats.frequency,
        normalizedScore
      });

      return normalizedScore;

    } catch (error) {
      console.error('[FrequencyScoring] 计算频率得分时出错:', error);
      return 0;
    }
  }

  /**
   * 获取命令在指定时间段内的使用频率
   * @param suggestion 补全建议
   * @param context 上下文
   * @param days 统计天数
   * @returns 指定天数内的平均使用频率
   */
  private getFrequencyInPeriod(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext,
    days: number
  ): number {
    try {
      const now = Date.now();
      const periodStart = now - (days * 24 * 60 * 60 * 1000);

      // 获取时间段内的执行记录
      const periodExecutions = context.commandHistory.recent
        .filter(execution => {
          return execution.command === suggestion.fullCommand &&
                 execution.timestamp.getTime() > periodStart;
        });

      // 计算平均每天使用频率
      return periodExecutions.length / days;

    } catch (error) {
      console.error('[FrequencyScoring] 计算时间段内频率时出错:', error);
      return 0;
    }
  }
} 