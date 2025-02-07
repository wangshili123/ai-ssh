import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedContext } from '../../core/types/context.types';

/**
 * 评分因子基类
 * 所有评分因子都应该继承这个类
 */
export abstract class ScoringFactor {
  /**
   * 计算得分
   * @param suggestion 补全建议
   * @param context 上下文信息
   * @returns 0-1之间的得分
   */
  public abstract calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedContext | string
  ): number;

  /**
   * 从命令历史中获取命令统计信息
   */
  protected getCommandStats(
    command: string,
    context: EnhancedContext
  ) {
    if (!context.commandHistory?.statistics) {
      return null;
    }
    return context.commandHistory.statistics.find(stat => stat.command === command);
  }

  /**
   * 从命令历史中获取最近的命令
   */
  protected getRecentCommands(context: EnhancedContext) {
    return context.commandHistory?.recent || [];
  }

  /**
   * 获取环境变量
   */
  protected getEnvironmentVars(context: EnhancedContext) {
    return context.environmentVars || {};
  }
} 