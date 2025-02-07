import { CompletionRule } from '../learning/analyzer/optimizer/types/rule-optimizer.types';
import { EnhancedContext } from '../core/types/context.types';
import { ParameterRuleMatcher } from './matchers/ParameterRuleMatcher';
import { ContextRuleMatcher } from './matchers/ContextRuleMatcher';
import { SequenceRuleMatcher } from './matchers/SequenceRuleMatcher';

/**
 * 规则评估器
 * 负责评估规则与当前输入和上下文的匹配程度
 */
export class RuleEvaluator {
  private static instance: RuleEvaluator;
  private parameterMatcher: ParameterRuleMatcher;
  private contextMatcher: ContextRuleMatcher;
  private sequenceMatcher: SequenceRuleMatcher;

  private constructor() {
    this.parameterMatcher = new ParameterRuleMatcher();
    this.contextMatcher = new ContextRuleMatcher();
    this.sequenceMatcher = new SequenceRuleMatcher();
  }

  public static getInstance(): RuleEvaluator {
    if (!RuleEvaluator.instance) {
      RuleEvaluator.instance = new RuleEvaluator();
    }
    return RuleEvaluator.instance;
  }

  /**
   * 评估规则
   * @returns 返回 0-1 之间的分数，0 表示不匹配，1 表示完全匹配
   */
  public evaluateRule(
    rule: CompletionRule,
    input: string,
    context: EnhancedContext
  ): number {
    // 根据规则类型选择匹配器
    const matcher = this.getMatcherForRule(rule);
    
    // 计算匹配分数
    const matchScore = matcher.match(rule, input, context);
    
    // 应用规则权重和置信度
    return matchScore * rule.weight * rule.confidence;
  }

  /**
   * 获取规则对应的匹配器
   */
  private getMatcherForRule(rule: CompletionRule) {
    switch (rule.type) {
      case 'parameter':
        return this.parameterMatcher;
      case 'context':
        return this.contextMatcher;
      case 'sequence':
        return this.sequenceMatcher;
      default:
        throw new Error(`Unknown rule type: ${rule.type}`);
    }
  }
} 