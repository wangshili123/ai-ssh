import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedCompletionContext } from '../../analyzers/types/context.types';
import { ShellParserTypes } from '../../../parser/ShellParserTypes';

/**
 * 基于命令语法的匹配评分因子
 */
export class SyntaxScoring {
  /**
   * 常见命令选项前缀
   */
  private readonly OPTION_PREFIXES = ['-', '--'];

  /**
   * 计算基于语法匹配的得分
   * @param suggestion 补全建议
   * @param context 增强的补全上下文
   * @returns 0-1之间的得分，语法匹配度越高分数越高
   */
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    console.log('[SyntaxScoring] 开始计算语法匹配得分:', {
      suggestion: suggestion.suggestion,
      currentCommand: context.currentCommand
    });

    try {
      let score = 0;

      // 1. 命令名匹配
      if (this.isCommandNameMatch(suggestion, context)) {
        score += 0.4;
      }

      // 2. 参数位置匹配
      if (this.isArgumentPositionMatch(suggestion, context)) {
        score += 0.3;
      }

      // 3. 选项匹配
      if (this.isOptionMatch(suggestion, context)) {
        score += 0.3;
      }

      // 4. 语法上下文匹配
      const contextScore = this.calculateSyntaxContextScore(suggestion, context);
      score = Math.min(1, score + contextScore);

      console.log('[SyntaxScoring] 语法匹配得分计算完成:', {
        suggestion: suggestion.suggestion,
        score,
        details: {
          commandMatch: this.isCommandNameMatch(suggestion, context),
          argMatch: this.isArgumentPositionMatch(suggestion, context),
          optionMatch: this.isOptionMatch(suggestion, context),
          contextScore
        }
      });

      return score;

    } catch (error) {
      console.error('[SyntaxScoring] 计算语法匹配得分时出错:', error);
      return 0;
    }
  }

  /**
   * 检查是否是命令名匹配
   */
  private isCommandNameMatch(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): boolean {
    if (!context.currentCommand || context.currentCommand.type !== 'command') return false;
    return suggestion.suggestion === context.currentCommand.name;
  }

  /**
   * 检查是否是参数位置匹配
   */
  private isArgumentPositionMatch(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): boolean {
    if (!context.currentCommand || context.currentCommand.type !== 'command') return false;
    return context.currentCommand.args?.includes(suggestion.suggestion) || false;
  }

  /**
   * 检查是否是选项匹配
   */
  private isOptionMatch(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): boolean {
    // 检查建议是否是选项格式
    const isOption = this.OPTION_PREFIXES.some(prefix => 
      suggestion.suggestion.startsWith(prefix)
    );

    if (!isOption || !context.currentCommand || context.currentCommand.type !== 'command') return false;

    // 检查是否在当前命令的选项列表中
    return context.currentCommand.options?.some(opt => 
      opt.startsWith(suggestion.suggestion)
    ) || false;
  }

  /**
   * 计算语法上下文得分
   */
  private calculateSyntaxContextScore(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    let contextScore = 0;

    // 1. 检查是否在引号内
    if (this.isInQuotes(context) && this.isValidQuoteCompletion(suggestion)) {
      contextScore += 0.1;
    }

    // 2. 检查是否在管道后
    if (this.isAfterPipe(context)) {
      contextScore += this.calculatePipeContextScore(suggestion);
    }

    // 3. 检查是否在重定向后
    if (this.isAfterRedirection(context)) {
      contextScore += this.calculateRedirectionContextScore(suggestion);
    }

    return contextScore;
  }

  /**
   * 检查是否在引号内
   */
  private isInQuotes(context: EnhancedCompletionContext): boolean {
    if (!context.currentCommand || context.currentCommand.type !== 'command') return false;
    const lastArg = context.currentCommand.args?.[context.currentCommand.args.length - 1] || '';
    return (
      (lastArg.startsWith('"') && !lastArg.endsWith('"')) ||
      (lastArg.startsWith("'") && !lastArg.endsWith("'"))
    );
  }

  /**
   * 检查是否是有效的引号内补全
   */
  private isValidQuoteCompletion(suggestion: CompletionSuggestion): boolean {
    // 引号内的补全不应该包含特殊字符
    return !/['"\\|><]/.test(suggestion.suggestion);
  }

  /**
   * 检查是否在管道后
   */
  private isAfterPipe(context: EnhancedCompletionContext): boolean {
    if (!context.currentCommand || context.currentCommand.type !== 'command') return false;
    const lastArg = context.currentCommand.args?.[context.currentCommand.args.length - 2] || '';
    return lastArg === '|';
  }

  /**
   * 计算管道上下文得分
   */
  private calculatePipeContextScore(suggestion: CompletionSuggestion): number {
    // 管道后面常见的命令
    const pipeCommands = ['grep', 'awk', 'sed', 'sort', 'uniq', 'wc', 'head', 'tail'];
    if (pipeCommands.includes(suggestion.suggestion)) {
      return 0.2;
    }
    return 0;
  }

  /**
   * 检查是否在重定向后
   */
  private isAfterRedirection(context: EnhancedCompletionContext): boolean {
    if (!context.currentCommand || context.currentCommand.type !== 'command') return false;
    const lastArg = context.currentCommand.args?.[context.currentCommand.args.length - 2] || '';
    return ['>', '>>', '<'].includes(lastArg);
  }

  /**
   * 计算重定向上下文得分
   */
  private calculateRedirectionContextScore(suggestion: CompletionSuggestion): number {
    // 重定向后通常是文件路径
    if (suggestion.suggestion.includes('/') || 
        suggestion.suggestion.endsWith('.txt') ||
        suggestion.suggestion.endsWith('.log')) {
      return 0.2;
    }
    return 0;
  }
} 