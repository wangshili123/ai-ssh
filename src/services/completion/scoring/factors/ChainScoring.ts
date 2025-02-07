import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedContext } from '../../core/types/context.types';
import { ScoringFactor } from './ScoringFactor';

/**
 * 基于命令链的评分因子
 */
export class ChainScoring extends ScoringFactor {
  /**
   * 计算基于命令链的得分
   * @param suggestion 补全建议
   * @param context 上下文信息
   * @returns 0-1之间的得分，命令链匹配度越高分数越高
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
      if (recentCommands.length < 2) {
        return 0;
      }

      // 2. 查找命令链模式
      const chainScore = this.findChainPattern(
        suggestion.fullCommand,
        recentCommands
      );

      return chainScore;

    } catch (error) {
      console.error('[ChainScoring] 计算命令链得分时出错:', error);
      return 0;
    }
  }

  /**
   * 查找命令链模式
   */
  private findChainPattern(
    command: string,
    recentCommands: Array<{ command: string; timestamp: string; success: boolean }>
  ): number {
    // 只考虑最近的5个命令
    const recentChain = recentCommands.slice(0, 5);
    
    // 检查命令是否经常出现在当前命令序列之后
    let chainCount = 0;
    let totalChains = 0;

    for (let i = 0; i < recentChain.length - 1; i++) {
      const currentCmd = recentChain[i].command;
      const nextCmd = recentChain[i + 1].command;

      if (currentCmd === recentChain[recentChain.length - 1].command) {
        totalChains++;
        if (nextCmd === command) {
          chainCount++;
        }
      }
    }

    return totalChains > 0 ? chainCount / totalChains : 0;
  }
} 