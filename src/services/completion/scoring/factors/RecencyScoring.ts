import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedCompletionContext } from '../../analyzers/types/context.types';

/**
 * 基于命令最近使用时间的评分因子
 */
export class RecencyScoring {
  /**
   * 最大考虑天数
   * 超过这个天数的命令使用记录将不再影响得分
   */
  private readonly MAX_AGE_DAYS = 30;

  /**
   * 计算基于最近使用时间的得分
   * @param suggestion 补全建议
   * @param context 增强的补全上下文
   * @returns 0-1之间的得分，使用时间越近分数越高
   */
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    console.log('[RecencyScoring] 开始计算时效性得分:', {
      suggestion: suggestion.suggestion,
      statistics: context.commandHistory.statistics
    });

    try {
      // 1. 从命令历史统计中查找最后使用时间
      const commandStats = context.commandHistory.statistics
        .find(stat => stat.command === suggestion.fullCommand);

      if (!commandStats || !commandStats.lastUsed) {
        console.log('[RecencyScoring] 未找到命令使用记录, 返回0分');
        return 0;
      }

      // 2. 计算天数差
      const daysDiff = this.getDaysDifference(commandStats.lastUsed);

      // 3. 计算时效性得分（线性衰减）
      const score = Math.max(0, 1 - daysDiff / this.MAX_AGE_DAYS);

      console.log('[RecencyScoring] 时效性得分计算完成:', {
        command: suggestion.fullCommand,
        lastUsed: commandStats.lastUsed,
        daysDiff,
        score
      });

      return score;

    } catch (error) {
      console.error('[RecencyScoring] 计算时效性得分时出错:', error);
      return 0;
    }
  }

  /**
   * 计算与当前时间的天数差
   * @param date 要比较的日期
   * @returns 天数差
   */
  private getDaysDifference(date: Date): number {
    const diffTime = Math.abs(Date.now() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 获取命令在最近一段时间内的使用次数
   * @param suggestion 补全建议
   * @param context 上下文
   * @param hours 小时数
   * @returns 指定小时数内的使用次数
   */
  private getRecentUsageCount(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext,
    hours: number
  ): number {
    try {
      const now = Date.now();
      const periodStart = now - (hours * 60 * 60 * 1000);

      return context.commandHistory.recent
        .filter(execution => {
          return execution.command === suggestion.fullCommand &&
                 execution.timestamp.getTime() > periodStart;
        }).length;

    } catch (error) {
      console.error('[RecencyScoring] 计算最近使用次数时出错:', error);
      return 0;
    }
  }

  /**
   * 获取命令的使用时间模式
   * 例如某些命令可能在特定时间段使用频率更高
   * @param suggestion 补全建议
   * @param context 上下文
   * @returns 当前时间段的使用概率 (0-1)
   */
  private getTimePatternScore(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    try {
      const currentHour = new Date().getHours();
      const hourBucket = Math.floor(currentHour / 4); // 将24小时分为6个时间段

      // 统计每个时间段的使用次数
      const timeDistribution = new Array(6).fill(0);
      
      context.commandHistory.recent
        .filter(execution => execution.command === suggestion.fullCommand)
        .forEach(execution => {
          const hour = execution.timestamp.getHours();
          const bucket = Math.floor(hour / 4);
          timeDistribution[bucket]++;
        });

      // 计算当前时间段的使用概率
      const totalUsage = timeDistribution.reduce((a, b) => a + b, 0);
      if (totalUsage === 0) return 0;

      return timeDistribution[hourBucket] / totalUsage;

    } catch (error) {
      console.error('[RecencyScoring] 计算时间模式得分时出错:', error);
      return 0;
    }
  }
} 