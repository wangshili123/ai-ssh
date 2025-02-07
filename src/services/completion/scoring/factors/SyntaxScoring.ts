import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedContext } from '../../core/types/context.types';
import { ScoringFactor } from './ScoringFactor';

/**
 * 基于语法的评分因子
 */
export class SyntaxScoring extends ScoringFactor {
  /**
   * 计算基于语法的得分
   * @param suggestion 补全建议
   * @param context 输入字符串
   * @returns 0-1之间的得分，语法匹配度越高分数越高
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

      // 1. 检查命令结构
      const inputParts = input.split(' ');
      const commandParts = command.split(' ');

      // 如果输入为空，返回基础分数
      if (!input) {
        return 0.5;
      }

      // 2. 命令名匹配
      if (inputParts[0] && commandParts[0]) {
        if (commandParts[0].startsWith(inputParts[0])) {
          // 命令名匹配得分
          const commandScore = this.calculateMatchScore(inputParts[0], commandParts[0]);
          
          // 如果只有命令名，直接返回得分
          if (inputParts.length === 1) {
            return commandScore;
          }

          // 3. 参数匹配
          const argScore = this.calculateArgumentScore(
            inputParts.slice(1),
            commandParts.slice(1)
          );

          // 综合得分：命令名占60%，参数占40%
          return commandScore * 0.6 + argScore * 0.4;
        }
      }

      return 0;

    } catch (error) {
      console.error('[SyntaxScoring] 计算语法匹配得分时出错:', error);
      return 0;
    }
  }

  /**
   * 计算匹配得分
   */
  private calculateMatchScore(input: string, target: string): number {
    if (input === target) {
      return 1;
    }
    if (target.startsWith(input)) {
      return 0.8 + (input.length / target.length) * 0.2;
    }
    return 0;
  }

  /**
   * 计算参数匹配得分
   */
  private calculateArgumentScore(
    inputArgs: string[],
    targetArgs: string[]
  ): number {
    if (!inputArgs.length || !targetArgs.length) {
      return 0;
    }

    let matchCount = 0;
    let totalWeight = 0;
    const argWeight = 1 / inputArgs.length; // 平均权重

    for (let i = 0; i < inputArgs.length; i++) {
      const input = inputArgs[i];
      
      // 检查是否是选项参数
      if (input.startsWith('-')) {
        // 选项参数需要精确匹配
        if (targetArgs.includes(input)) {
          matchCount += argWeight;
        }
      } else {
        // 普通参数可以部分匹配
        for (const target of targetArgs) {
          if (target.includes(input)) {
            matchCount += argWeight * 0.8; // 部分匹配得分稍低
            break;
          }
        }
      }
      totalWeight += argWeight;
    }

    return matchCount / totalWeight;
  }
} 