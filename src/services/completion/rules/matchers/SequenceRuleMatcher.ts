import { RuleMatcher } from './RuleMatcher';
import { CompletionRule } from '../../learning/analyzer/optimizer/types/rule-optimizer.types';
import { EnhancedContext } from '../../core/types/context.types';

/**
 * 序列规则匹配器
 * 负责匹配命令序列相关的规则
 */
export class SequenceRuleMatcher extends RuleMatcher {
  /**
   * 匹配序列规则
   */
  match(
    rule: CompletionRule,
    input: string,
    context: EnhancedContext
  ): number {
    if (rule.type !== 'sequence') {
      return 0;
    }

    // 获取最近的命令历史
    const recentCommands = context.commandHistory?.recent || [];
    if (recentCommands.length === 0) {
      return 0;
    }

    // 解析规则中的命令序列
    const sequenceCommands = rule.pattern.split(/\s*&&\s*|\s*;\s*|\s*\|\s*/).map(cmd => cmd.trim());
    if (sequenceCommands.length === 0) {
      return 0;
    }

    // 如果当前输入为空，检查是否匹配序列的下一个命令
    if (!input) {
      return this.matchNextCommand(sequenceCommands, recentCommands);
    }

    // 如果有输入，检查是否匹配序列中的某个命令
    return this.matchSequenceCommand(input, sequenceCommands, recentCommands);
  }

  /**
   * 匹配序列中的下一个命令
   */
  private matchNextCommand(
    sequenceCommands: string[],
    recentCommands: Array<{ command: string; timestamp: string; success: boolean }>
  ): number {
    // 获取最近的命令
    const recentCommandList = recentCommands.map(cmd => cmd.command);
    
    // 尝试在序列中找到匹配的部分
    for (let i = 0; i < sequenceCommands.length - 1; i++) {
      const partialSequence = sequenceCommands.slice(0, i + 1);
      const matchResult = this.matchPartialSequence(
        partialSequence,
        recentCommandList
      );

      if (matchResult > 0.8) {
        // 如果找到高度匹配的部分序列，建议下一个命令
        // 检查最后一个命令是否成功执行
        const lastCommand = recentCommands[recentCommandList.length - partialSequence.length];
        if (lastCommand && lastCommand.success) {
          return 0.9;
        }
        return 0.5; // 如果最后一个命令执行失败，降低建议的可信度
      }
    }

    return 0;
  }

  /**
   * 匹配序列中的命令
   */
  private matchSequenceCommand(
    input: string,
    sequenceCommands: string[],
    recentCommands: Array<{ command: string; timestamp: string; success: boolean }>
  ): number {
    let bestScore = 0;

    // 检查输入是否匹配序列中的任何命令
    for (const command of sequenceCommands) {
      // 优先使用前缀匹配
      const prefixScore = this.checkPrefixMatch(input, command);
      if (prefixScore > 0) {
        bestScore = Math.max(bestScore, prefixScore);
        continue;
      }

      // 如果前缀不匹配，使用相似度匹配
      const similarity = this.calculateStringSimilarity(input, command);
      bestScore = Math.max(bestScore, similarity * 0.8);
    }

    // 如果有很好的匹配，检查上下文是否适合
    if (bestScore > 0.7) {
      const contextScore = this.matchSequenceContext(
        sequenceCommands,
        recentCommands
      );
      return bestScore * 0.6 + contextScore * 0.4;
    }

    return bestScore * 0.3; // 如果只是命令匹配，给出较低的分数
  }

  /**
   * 匹配部分序列
   */
  private matchPartialSequence(
    partialSequence: string[],
    recentCommands: string[]
  ): number {
    let matchCount = 0;
    let lastMatchIndex = -1;

    // 检查每个命令是否按顺序出现在最近的命令中
    for (const command of partialSequence) {
      let found = false;
      for (let i = lastMatchIndex + 1; i < recentCommands.length; i++) {
        // 优先使用前缀匹配
        const prefixScore = this.checkPrefixMatch(command, recentCommands[i]);
        if (prefixScore > 0.8) {
          matchCount++;
          lastMatchIndex = i;
          found = true;
          break;
        }

        // 如果前缀不匹配，使用相似度匹配
        if (this.calculateStringSimilarity(command, recentCommands[i]) > 0.8) {
          matchCount++;
          lastMatchIndex = i;
          found = true;
          break;
        }
      }
      if (!found) {
        break;
      }
    }

    return matchCount / partialSequence.length;
  }

  /**
   * 匹配序列上下文
   */
  private matchSequenceContext(
    sequenceCommands: string[],
    recentCommands: Array<{ command: string; timestamp: string; success: boolean }>
  ): number {
    // 检查最近命令中是否有序列的前缀
    const recentCommandList = recentCommands.map(cmd => cmd.command);
    let maxScore = 0;

    // 尝试不同长度的前缀
    for (let i = 1; i < sequenceCommands.length; i++) {
      const prefix = sequenceCommands.slice(0, i);
      const score = this.matchPartialSequence(prefix, recentCommandList);
      
      // 如果前缀匹配，检查最后一个命令的执行状态
      if (score > 0.8) {
        const lastCommand = recentCommands[recentCommandList.length - prefix.length];
        if (lastCommand && lastCommand.success) {
          maxScore = Math.max(maxScore, score);
        } else {
          maxScore = Math.max(maxScore, score * 0.6); // 如果命令执行失败，降低分数
        }
      } else {
        maxScore = Math.max(maxScore, score);
      }
    }

    return maxScore;
  }
} 