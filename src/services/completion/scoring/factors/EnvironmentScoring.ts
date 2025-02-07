import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedContext } from '../../core/types/context.types';
import { ScoringFactor } from './ScoringFactor';

/**
 * 基于环境的评分因子
 */
export class EnvironmentScoring extends ScoringFactor {
  /**
   * 计算基于环境的得分
   * @param suggestion 补全建议
   * @param context 上下文信息
   * @returns 0-1之间的得分，环境匹配度越高分数越高
   */
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedContext | string
  ): number {
    if (typeof context === 'string') {
      return 0;
    }

    try {
      let score = 0;

      // 1. 检查环境变量相关性
      const envScore = this.calculateEnvironmentVarsScore(
        suggestion.fullCommand,
        context
      );
      score += envScore * 0.4;

      // 2. 检查目录相关性
      const dirScore = this.calculateDirectoryScore(
        suggestion.fullCommand,
        context
      );
      score += dirScore * 0.6;

      return Math.min(score, 1);

    } catch (error) {
      console.error('[EnvironmentScoring] 计算环境得分时出错:', error);
      return 0;
    }
  }

  /**
   * 计算环境变量相关性得分
   */
  private calculateEnvironmentVarsScore(
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

  /**
   * 计算目录相关性得分
   */
  private calculateDirectoryScore(
    command: string,
    context: EnhancedContext
  ): number {
    const currentDir = context.currentDirectory;
    if (!currentDir) {
      return 0;
    }

    // 检查命令是否与当前目录相关
    const dirParts = currentDir.split(/[\/\\]/);
    const commandParts = command.split(' ');

    // 计算目录部分与命令部分的匹配度
    let matchCount = 0;
    for (const dirPart of dirParts) {
      if (dirPart && commandParts.some(part => part.includes(dirPart))) {
        matchCount++;
      }
    }

    return matchCount > 0 ? matchCount / dirParts.length : 0;
  }
} 