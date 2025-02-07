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
    
    // 计算基础匹配分数
    const matchScore = matcher.match(rule, input, context);
    if (matchScore === 0) {
      return 0;
    }

    // 应用规则权重和置信度
    const weightedScore = matchScore * rule.weight * rule.confidence;

    // 应用时间衰减因子（如果规则有时间信息）
    if (rule.metadata?.lastUsed) {
      const age = Date.now() - new Date(rule.metadata.lastUsed).getTime();
      const ageScore = Math.max(0, 1 - age / (7 * 24 * 60 * 60 * 1000)); // 7天衰减
      return weightedScore * (0.7 + ageScore * 0.3); // 时间因子最多影响30%
    }

    return weightedScore;
  }

  /**
   * 批量评估规则
   */
  public evaluateRules(
    rules: CompletionRule[],
    input: string,
    context: EnhancedContext
  ): Map<string, number> {
    const scores = new Map<string, number>();

    // 按类型分组规则
    const rulesByType = new Map<string, CompletionRule[]>();
    for (const rule of rules) {
      const type = rule.type;
      if (!rulesByType.has(type)) {
        rulesByType.set(type, []);
      }
      rulesByType.get(type)!.push(rule);
    }

    // 并行评估每种类型的规则
    for (const [type, typeRules] of rulesByType.entries()) {
      const matcher = this.getMatcherForType(type);
      for (const rule of typeRules) {
        const score = this.evaluateRule(rule, input, context);
        if (score > 0) {
          scores.set(rule.id, score);
        }
      }
    }

    return scores;
  }

  /**
   * 获取规则对应的匹配器
   */
  private getMatcherForRule(rule: CompletionRule) {
    return this.getMatcherForType(rule.type);
  }

  /**
   * 根据类型获取匹配器
   */
  private getMatcherForType(type: string) {
    switch (type) {
      case 'parameter':
        return this.parameterMatcher;
      case 'context':
        return this.contextMatcher;
      case 'sequence':
        return this.sequenceMatcher;
      default:
        throw new Error(`Unknown rule type: ${type}`);
    }
  }
} 