import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedContext } from '../../core/types/context.types';
import { ScoringFactor } from './ScoringFactor';

/**
 * 基于上下文的评分因子
 */
export class ContextScoring extends ScoringFactor {
  /**
   * 计算基于上下文的得分
   * @param suggestion 补全建议
   * @param context 上下文信息
   * @returns 0-1之间的得分，上下文匹配度越高分数越高
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

      // 2. 计算上下文相关性得分
      let score = 0;

      // 2.1 检查最近命令中是否有相似命令
      const similarCommandScore = this.calculateSimilarCommandScore(
        suggestion.fullCommand,
        recentCommands
      );
      score += similarCommandScore * 0.6;

      // 2.2 检查环境变量相关性
      const envScore = this.calculateEnvironmentScore(
        suggestion.fullCommand,
        context
      );
      score += envScore * 0.4;

      return Math.min(score, 1);

    } catch (error) {
      console.error('[ContextScoring] 计算上下文得分时出错:', error);
      return 0;
    }
  }

  /**
   * 计算命令相似度得分
   */
  private calculateSimilarCommandScore(
    command: string,
    recentCommands: Array<{ command: string; timestamp: string; success: boolean }>
  ): number {
    const commandParts = command.split(' ');
    let maxScore = 0;

    for (const recent of recentCommands) {
      const recentParts = recent.command.split(' ');
      const commonParts = commandParts.filter(part => recentParts.includes(part));
      const score = commonParts.length / Math.max(commandParts.length, recentParts.length);
      maxScore = Math.max(maxScore, score);
    }

    return maxScore;
  }

  /**
   * 计算环境相关性得分
   */
  private calculateEnvironmentScore(
    command: string,
    context: EnhancedContext
  ): number {
    const envVars = this.getEnvironmentVars(context);
    if (!Object.keys(envVars).length) {
      return 0;
    }

    // 检查命令是否使用了环境变量
    const envVarRefs = command.match(/\$\w+|\${[^}]+}/g) || [];
    if (!envVarRefs.length) {
      return 0;
    }

    // 计算环境变量匹配度
    const matchedVars = envVarRefs.filter(ref => {
      const varName = ref.replace(/^\$\{?|\}$/g, '');
      return varName in envVars;
    });

    return matchedVars.length / envVarRefs.length;
  }
} 