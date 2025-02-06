import { AIAnalysisResult } from '../ai/types/ai-analysis.types';
import { PatternAnalysisResult } from '../types';
import {
  CompletionRule,
  RuleMetadata,
  RulePerformance
} from './types/rule-optimizer.types';

/**
 * 规则生成器
 * 负责从分析结果生成补全规则
 */
export class RuleGenerator {
  /**
   * 从模式分析结果生成规则
   */
  public generateFromPatterns(patterns: PatternAnalysisResult): CompletionRule[] {
    const rules: CompletionRule[] = [];
    const timestamp = new Date().toISOString();

    // 处理参数模式
    patterns.parameterPatterns.forEach(pattern => {
      rules.push(this.createRule({
        type: 'parameter',
        pattern: `${pattern.command} ${pattern.parameter}`,
        weight: pattern.frequency,
        confidence: pattern.confidence,
        source: 'pattern_analysis',
        timestamp
      }));
    });

    // 处理上下文模式
    patterns.contextPatterns.forEach(pattern => {
      rules.push(this.createRule({
        type: 'context',
        pattern: `${pattern.command} ${pattern.context}`,
        weight: pattern.frequency,
        confidence: pattern.confidence,
        source: 'pattern_analysis',
        timestamp
      }));
    });

    // 处理序列模式
    patterns.sequencePatterns.forEach(pattern => {
      rules.push(this.createRule({
        type: 'sequence',
        pattern: pattern.commands.join(' && '),
        weight: pattern.frequency,
        confidence: pattern.confidence,
        source: 'pattern_analysis',
        timestamp
      }));
    });

    return rules;
  }

  /**
   * 从 AI 分析结果生成规则
   */
  public generateFromAIInsights(insights: AIAnalysisResult): CompletionRule[] {
    const rules: CompletionRule[] = [];
    const timestamp = new Date().toISOString();

    // 处理模式洞察
    insights.insights.patternInsights.forEach(insight => {
      if (insight.confidence >= 0.7) {
        rules.push(this.createRule({
          type: this.inferRuleType(insight.pattern),
          pattern: this.extractPattern(insight.pattern),
          weight: insight.impact,
          confidence: insight.confidence,
          source: 'ai_analysis',
          timestamp
        }));
      }
    });

    // 处理模式关联
    insights.insights.correlations.forEach(correlation => {
      if (correlation.strength >= 0.8) {
        rules.push(this.createRule({
          type: 'sequence',
          pattern: `${correlation.sourcePattern} && ${correlation.targetPattern}`,
          weight: correlation.strength,
          confidence: correlation.strength,
          source: 'ai_analysis',
          timestamp
        }));
      }
    });

    return rules;
  }

  /**
   * 合并规则
   */
  public mergeRules(
    existing: CompletionRule[],
    newRules: CompletionRule[]
  ): CompletionRule[] {
    const mergedMap = new Map<string, CompletionRule>();

    // 先添加现有规则
    existing.forEach(rule => {
      mergedMap.set(rule.id, rule);
    });

    // 合并新规则
    newRules.forEach(rule => {
      const existingRule = mergedMap.get(rule.id);
      if (existingRule) {
        // 更新现有规则
        mergedMap.set(rule.id, this.mergeRule(existingRule, rule));
      } else {
        // 添加新规则
        mergedMap.set(rule.id, rule);
      }
    });

    return Array.from(mergedMap.values());
  }

  /**
   * 创建规则
   */
  private createRule(params: {
    type: 'parameter' | 'context' | 'sequence';
    pattern: string;
    weight: number;
    confidence: number;
    source: 'pattern_analysis' | 'ai_analysis';
    timestamp: string;
  }): CompletionRule {
    const id = this.generateRuleId(params.type, params.pattern);
    
    const performance: RulePerformance = {
      usageCount: 0,
      successRate: 0,
      adoptionRate: 0,
      averageLatency: 0
    };

    const metadata: RuleMetadata = {
      source: params.source,
      createdAt: params.timestamp,
      updatedAt: params.timestamp,
      lastApplied: params.timestamp,
      performance
    };

    return {
      id,
      type: params.type,
      pattern: params.pattern,
      weight: params.weight,
      confidence: params.confidence,
      version: 1,
      metadata
    };
  }

  /**
   * 合并两个规则
   */
  private mergeRule(
    existing: CompletionRule,
    newRule: CompletionRule
  ): CompletionRule {
    const timestamp = new Date().toISOString();
    
    // 计算新的权重和置信度
    const weight = (existing.weight + newRule.weight) / 2;
    const confidence = Math.max(existing.confidence, newRule.confidence);

    return {
      ...existing,
      pattern: newRule.pattern,
      weight,
      confidence,
      version: existing.version + 1,
      metadata: {
        ...existing.metadata,
        updatedAt: timestamp,
        source: newRule.metadata.source,
        performance: {
          ...existing.metadata.performance,
          // 保留现有性能指标
        }
      }
    };
  }

  /**
   * 生成规则ID
   */
  private generateRuleId(type: string, pattern: string): string {
    return `${type}_${Buffer.from(pattern).toString('base64')}`;
  }

  /**
   * 推断规则类型
   */
  private inferRuleType(pattern: any): 'parameter' | 'context' | 'sequence' {
    if (typeof pattern === 'string') {
      return pattern.includes('&&') ? 'sequence' : 'parameter';
    }
    return 'context';
  }

  /**
   * 提取模式字符串
   */
  private extractPattern(pattern: any): string {
    if (typeof pattern === 'string') {
      return pattern;
    }
    return JSON.stringify(pattern);
  }
} 