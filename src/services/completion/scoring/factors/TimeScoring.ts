import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedContext } from '../../core/types/context.types';
import { ScoringFactor } from './ScoringFactor';

/**
 * 基于时间模式的评分因子
 */
export class TimeScoring extends ScoringFactor {
  /**
   * 计算基于时间模式的得分
   * @param suggestion 补全建议
   * @param context 上下文信息
   * @returns 0-1之间的得分，时间模式匹配度越高分数越高
   */
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedContext | string
  ): number {
    if (typeof context === 'string') {
      return 0;
    }

    try {
      // 1. 获取最近的命令
      const recentCommands = this.getRecentCommands(context);
      if (!recentCommands.length) {
        return 0;
      }

      // 2. 计算时间模式得分
      const currentHour = new Date().getHours();
      let matchCount = 0;
      let totalCount = 0;

      // 统计在当前时间段的命令使用情况
      for (const cmd of recentCommands) {
        if (cmd.command === suggestion.fullCommand) {
          totalCount++;
          const cmdHour = new Date(cmd.timestamp).getHours();
          // 考虑前后1小时的时间窗口
          if (Math.abs(cmdHour - currentHour) <= 1) {
            matchCount++;
          }
        }
      }

      return totalCount > 0 ? matchCount / totalCount : 0;

    } catch (error) {
      console.error('[TimeScoring] 计算时间模式得分时出错:', error);
      return 0;
    }
  }
} 