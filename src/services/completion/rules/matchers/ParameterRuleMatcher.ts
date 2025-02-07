import { RuleMatcher } from './RuleMatcher';
import { CompletionRule } from '../../learning/analyzer/optimizer/types/rule-optimizer.types';
import { EnhancedContext } from '../../core/types/context.types';

/**
 * 参数规则匹配器
 * 负责匹配命令参数相关的规则
 */
export class ParameterRuleMatcher extends RuleMatcher {
  /**
   * 匹配参数规则
   */
  match(
    rule: CompletionRule,
    input: string,
    context: EnhancedContext
  ): number {
    if (rule.type !== 'parameter') {
      return 0;
    }

    // 分割输入和规则模式
    const inputParts = input.trim().split(/\s+/);
    const patternParts = rule.pattern.trim().split(/\s+/);

    // 如果输入为空或只有一个词，只匹配命令名
    if (inputParts.length <= 1) {
      return this.matchCommand(inputParts[0] || '', patternParts[0]);
    }

    // 匹配命令名和参数
    const commandScore = this.matchCommand(inputParts[0], patternParts[0]);
    if (commandScore === 0) {
      return 0;
    }

    // 匹配参数
    const paramScore = this.matchParameters(
      inputParts.slice(1),
      patternParts.slice(1)
    );

    // 综合评分
    return commandScore * 0.6 + paramScore * 0.4;
  }

  /**
   * 匹配命令名
   */
  private matchCommand(input: string, pattern: string): number {
    // 优先使用前缀匹配
    const prefixScore = this.checkPrefixMatch(input, pattern);
    if (prefixScore > 0) {
      return prefixScore;
    }

    // 如果前缀不匹配，使用相似度匹配
    return this.calculateStringSimilarity(input, pattern) * 0.8;
  }

  /**
   * 匹配参数
   */
  private matchParameters(
    inputParams: string[],
    patternParams: string[]
  ): number {
    if (inputParams.length === 0 || patternParams.length === 0) {
      return 0;
    }

    let totalScore = 0;
    let matchedCount = 0;

    // 遍历输入的参数
    for (let i = 0; i < inputParams.length; i++) {
      const input = inputParams[i];
      let bestScore = 0;

      // 找到最佳匹配的参数
      for (const pattern of patternParams) {
        const score = this.matchParameter(input, pattern);
        bestScore = Math.max(bestScore, score);
      }

      if (bestScore > 0) {
        totalScore += bestScore;
        matchedCount++;
      }
    }

    return matchedCount > 0 ? totalScore / matchedCount : 0;
  }

  /**
   * 匹配单个参数
   */
  private matchParameter(input: string, pattern: string): number {
    // 处理可选参数
    if (pattern.startsWith('[') && pattern.endsWith(']')) {
      pattern = pattern.slice(1, -1);
    }

    // 处理变量参数
    if (pattern.startsWith('<') && pattern.endsWith('>')) {
      // 变量参数总是部分匹配
      return 0.5;
    }

    // 处理标志参数
    if (pattern.startsWith('-')) {
      // 优先使用前缀匹配
      const prefixScore = this.checkPrefixMatch(input, pattern);
      if (prefixScore > 0) {
        return prefixScore;
      }
      // 如果前缀不匹配且输入也是标志，使用相似度匹配
      if (input.startsWith('-')) {
        return this.calculateStringSimilarity(input, pattern) * 0.8;
      }
      return 0;
    }

    // 处理普通参数
    return this.calculateStringSimilarity(input, pattern) * 0.7;
  }
} 