import { AIAnalysisResult } from '../ai/types/ai-analysis.types';
import { PatternAnalysisResult } from '../types';
import { RuleGenerator } from './RuleGenerator';
import { RuleApplier } from './RuleApplier';
import { RuleVersionManager } from './RuleVersionManager';
import {
  CompletionRule,
  RuleUpdate,
  RuleOptimizerConfig,
  OptimizationResult,
  RuleVersion
} from './types/rule-optimizer.types';

/**
 * 规则优化器
 * 负责根据分析结果更新和优化补全规则
 */
export class RuleOptimizer {
  private static instance: RuleOptimizer;
  private ruleGenerator: RuleGenerator;
  private ruleApplier: RuleApplier;
  private versionManager: RuleVersionManager;
  private isOptimizing: boolean = false;

  private config: RuleOptimizerConfig = {
    minConfidenceThreshold: 0.7,
    maxWeightAdjustment: 0.3,
    maxVersionsToKeep: 10,
    performanceCheckInterval: 24 * 60 * 60 * 1000, // 24小时
    minPerformanceThreshold: 0.6,
    batchSize: 100,
    updateInterval: 60 * 60 * 1000 // 1小时
  };

  private constructor() {
    this.ruleGenerator = new RuleGenerator();
    this.ruleApplier = new RuleApplier();
    this.versionManager = RuleVersionManager.getInstance();
  }

  /**
   * 获取规则优化器实例
   */
  public static getInstance(): RuleOptimizer {
    if (!RuleOptimizer.instance) {
      RuleOptimizer.instance = new RuleOptimizer();
    }
    return RuleOptimizer.instance;
  }

  /**
   * 优化规则
   */
  public async optimizeRules(
    patternResults: PatternAnalysisResult,
    aiResults: AIAnalysisResult
  ): Promise<OptimizationResult | null> {
    if (this.isOptimizing) {
      console.log('[RuleOptimizer] Optimization already in progress');
      return null;
    }

    try {
      this.isOptimizing = true;
      console.log('[RuleOptimizer] Starting rule optimization');

      // 1. 从分析结果生成规则
      const patternRules = this.ruleGenerator.generateFromPatterns(patternResults);
      const aiRules = this.ruleGenerator.generateFromAIInsights(aiResults);

      // 2. 获取现有规则
      const existingRules = await this.ruleApplier.getCurrentRules();

      // 3. 合并规则
      const mergedRules = this.ruleGenerator.mergeRules(existingRules, [...patternRules, ...aiRules]);

      // 4. 验证规则一致性
      if (!this.ruleApplier.validateRuleConsistency(mergedRules)) {
        throw new Error('Rule consistency validation failed');
      }

      // 5. 生成规则更新
      const updates = this.generateUpdates(existingRules, mergedRules);

      // 6. 创建新版本
      const version = await this.versionManager.createVersion(updates);

      // 7. 应用更新
      await this.applyRuleUpdates(updates);

      // 8. 生成优化结果
      const result = this.generateOptimizationResult(updates, version);

      console.log('[RuleOptimizer] Rule optimization completed');
      return result;

    } catch (error) {
      console.error('[RuleOptimizer] Optimization failed:', error);
      await this.handleOptimizationError(error as Error);
      return null;
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 应用规则更新
   */
  public async applyRuleUpdates(updates: RuleUpdate[]): Promise<void> {
    try {
      // 1. 按批次处理更新
      const batches = this.splitIntoBatches(updates, this.config.batchSize);
      
      for (const batch of batches) {
        // 2. 应用更新批次
        await this.ruleApplier.applyUpdates(batch);
        
        // 3. 更新规则权重
        const updatedRules = await this.ruleApplier.getCurrentRules();
        this.ruleApplier.updateRuleWeights(updatedRules);
      }
    } catch (error) {
      console.error('[RuleOptimizer] Failed to apply updates:', error);
      throw error;
    }
  }

  /**
   * 回滚规则版本
   */
  public async rollbackVersion(version: number): Promise<void> {
    try {
      await this.versionManager.rollback(version);
    } catch (error) {
      console.error('[RuleOptimizer] Failed to rollback version:', error);
      throw error;
    }
  }

  /**
   * 生成规则更新
   */
  private generateUpdates(
    existing: CompletionRule[],
    merged: CompletionRule[]
  ): RuleUpdate[] {
    const updates: RuleUpdate[] = [];
    const existingMap = new Map(existing.map(rule => [rule.id, rule]));

    for (const rule of merged) {
      const existingRule = existingMap.get(rule.id);
      
      if (!existingRule) {
        // 新规则
        updates.push({
          ruleId: rule.id,
          changes: rule,
          reason: 'New rule added',
          confidence: rule.confidence
        });
      } else if (this.hasSignificantChanges(existingRule, rule)) {
        // 更新现有规则
        updates.push({
          ruleId: rule.id,
          changes: this.getChanges(existingRule, rule),
          reason: 'Rule updated based on new analysis',
          confidence: rule.confidence
        });
      }
    }

    return updates;
  }

  /**
   * 检查规则是否有显著变化
   */
  private hasSignificantChanges(
    existing: CompletionRule,
    updated: CompletionRule
  ): boolean {
    return (
      Math.abs(existing.weight - updated.weight) > this.config.maxWeightAdjustment ||
      existing.confidence !== updated.confidence ||
      existing.pattern !== updated.pattern
    );
  }

  /**
   * 获取规则变更
   */
  private getChanges(
    existing: CompletionRule,
    updated: CompletionRule
  ): Partial<CompletionRule> {
    const changes: Partial<CompletionRule> = {};

    if (existing.pattern !== updated.pattern) changes.pattern = updated.pattern;
    if (existing.weight !== updated.weight) changes.weight = updated.weight;
    if (existing.confidence !== updated.confidence) changes.confidence = updated.confidence;
    if (existing.version !== updated.version) changes.version = updated.version;

    return changes;
  }

  /**
   * 生成优化结果
   */
  private generateOptimizationResult(
    updates: RuleUpdate[],
    version: RuleVersion
  ): OptimizationResult {
    const baseRuleKeys = ['id', 'type', 'pattern', 'weight', 'confidence', 'version', 'metadata'];
    const newRules = updates
      .filter(update => Object.keys(update.changes).length === baseRuleKeys.length)
      .map(update => update.changes as CompletionRule);

    const updatedRules = updates
      .filter(update => Object.keys(update.changes).length < baseRuleKeys.length)
      .map(update => update.changes as CompletionRule);

    const removedRules = updates
      .filter(update => update.changes.weight === 0)
      .map(update => update.ruleId);

    return {
      updatedRules,
      removedRules,
      newRules,
      version,
      performance: {
        totalRules: newRules.length + updatedRules.length,
        updatedCount: updatedRules.length,
        addedCount: newRules.length,
        removedCount: removedRules.length,
        averageConfidence: this.calculateAverageConfidence([...newRules, ...updatedRules])
      }
    };
  }

  /**
   * 计算平均置信度
   */
  private calculateAverageConfidence(rules: CompletionRule[]): number {
    if (rules.length === 0) return 0;
    const sum = rules.reduce((acc, rule) => acc + rule.confidence, 0);
    return sum / rules.length;
  }

  /**
   * 将更新分批
   */
  private splitIntoBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 处理优化错误
   */
  private async handleOptimizationError(error: Error): Promise<void> {
    console.error('[RuleOptimizer] Error during optimization:', {
      message: error.message,
      stack: error.stack
    });
  }
} 