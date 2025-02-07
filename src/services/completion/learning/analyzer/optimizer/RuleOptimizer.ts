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
import { Database } from 'better-sqlite3';
import { DatabaseService } from '../../../../database/DatabaseService';
import { RuleCache } from '../../cache/RuleCache';

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
  private db: Database;
  private ruleCache: RuleCache;

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
    this.db = DatabaseService.getInstance().getDatabase();
    this.ruleCache = RuleCache.getInstance();
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
      const existingRules = await this.getCurrentRules();

      // 3. 合并规则
      const mergedRules = this.ruleGenerator.mergeRules(existingRules, [...patternRules, ...aiRules]);

      // 4. 验证规则一致性
      if (!this.ruleApplier.validateRuleConsistency(mergedRules)) {
        throw new Error('Rule consistency validation failed');
      }

      // 5. 生成规则更新
      const updates = this.generateUpdates(existingRules, mergedRules);

      // 6. 创建新版本并应用更新
      await this.applyRuleUpdates(updates);

      // 7. 获取当前版本信息
      const currentVersion = await this.versionManager.getCurrentVersion();
      const versionInfo: RuleVersion = {
        version: currentVersion,
        timestamp: new Date().toISOString(),
        changes: updates,
        status: 'active'
      };

      // 8. 生成优化结果
      const result: OptimizationResult = {
        updatedRules: mergedRules,
        removedRules: updates
          .filter(u => u.changes.weight === 0)
          .map(u => u.ruleId),
        newRules: updates
          .filter(u => !existingRules.find(r => r.id === u.ruleId))
          .map(u => u.changes as CompletionRule),
        version: versionInfo,
        performance: {
          totalRules: mergedRules.length,
          updatedCount: updates.length,
          addedCount: updates.filter(u => !existingRules.find(r => r.id === u.ruleId)).length,
          removedCount: updates.filter(u => u.changes.weight === 0).length,
          averageConfidence: this.calculateAverageConfidence(mergedRules)
        }
      };

      console.log('[RuleOptimizer] Rule optimization completed:', {
        totalRules: result.performance.totalRules,
        updatedCount: result.performance.updatedCount,
        addedCount: result.performance.addedCount,
        removedCount: result.performance.removedCount
      });

      return result;

    } catch (error) {
      console.error('[RuleOptimizer] Optimization failed:', error);
      throw error;
    } finally {
      this.isOptimizing = false;
    }
  }

  /**
   * 应用规则更新
   */
  public async applyRuleUpdates(updates: RuleUpdate[]): Promise<void> {
    try {
      // 开始事务
      this.db.exec('BEGIN TRANSACTION');

      // 1. 更新规则版本
      const version = await this.versionManager.createVersion(updates);

      // 2. 批量更新规则
      for (const update of updates) {
        if (Object.keys(update.changes).length === 0) continue;

        // 如果是新规则
        if (update.changes.id) {
          const stmt = this.db.prepare(`
            INSERT INTO completion_rules (
              id, type, pattern, weight, confidence, version, metadata,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `);

          const metadata = {
            ...update.changes.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastApplied: new Date().toISOString()
          };

          stmt.run(
            update.changes.id,
            update.changes.type,
            update.changes.pattern,
            update.changes.weight,
            update.changes.confidence,
            version,
            JSON.stringify(metadata)
          );

          // 创建性能记录
          const perfStmt = this.db.prepare(`
            INSERT INTO rule_performance (
              rule_id, usage_count, success_count, adoption_count, total_latency
            ) VALUES (?, ?, ?, ?, ?)
          `);
          perfStmt.run(
            update.changes.id,
            0, // usage_count
            0, // success_count
            0, // adoption_count
            0  // total_latency
          );
        } 
        // 更新现有规则
        else {
          const sets: string[] = [];
          const params: any[] = [];

          if (update.changes.pattern) {
            sets.push('pattern = ?');
            params.push(update.changes.pattern);
          }
          if (update.changes.weight !== undefined) {
            sets.push('weight = ?');
            params.push(update.changes.weight);
          }
          if (update.changes.confidence !== undefined) {
            sets.push('confidence = ?');
            params.push(update.changes.confidence);
          }
          if (update.changes.version !== undefined) {
            sets.push('version = ?');
            params.push(version);
          }
          if (update.changes.metadata) {
            const metadata = {
              ...update.changes.metadata,
              updatedAt: new Date().toISOString(),
              lastApplied: new Date().toISOString()
            };
            sets.push('metadata = ?');
            params.push(JSON.stringify(metadata));
          }

          if (sets.length > 0) {
            sets.push('updated_at = CURRENT_TIMESTAMP');
            params.push(update.ruleId);

            const stmt = this.db.prepare(`
              UPDATE completion_rules
              SET ${sets.join(', ')}
              WHERE id = ?
            `);
            stmt.run(...params);
          }
        }
      }

      // 3. 更新规则性能指标
      for (const update of updates) {
        if (update.changes.metadata?.performance) {
          const perf = update.changes.metadata.performance;
          const stmt = this.db.prepare(`
            UPDATE rule_performance
            SET 
              usage_count = usage_count + ?,
              success_count = success_count + ?,
              adoption_count = adoption_count + ?,
              total_latency = total_latency + ?,
              last_used_at = CURRENT_TIMESTAMP
            WHERE rule_id = ?
          `);

          stmt.run(
            1, // 增加使用次数
            perf.successRate ? 1 : 0,
            perf.adoptionRate ? 1 : 0,
            perf.averageLatency || 0,
            update.ruleId
          );
        }
      }

      // 提交事务
      this.db.exec('COMMIT');

      // 更新缓存
      this.ruleCache.updateRules(updates.map(u => ({
        ...u.changes,
        id: u.ruleId
      })) as CompletionRule[]);

    } catch (error) {
      // 回滚事务
      this.db.exec('ROLLBACK');
      console.error('[RuleOptimizer] Failed to apply updates:', error);
      throw error;
    }
  }

  /**
   * 获取当前规则
   */
  public async getCurrentRules(): Promise<CompletionRule[]> {
    try {
      const stmt = this.db.prepare(`
        SELECT r.*, p.usage_count, p.success_count, p.adoption_count, p.total_latency
        FROM completion_rules r
        LEFT JOIN rule_performance p ON r.id = p.rule_id
        WHERE r.version = (
          SELECT MAX(version)
          FROM rule_versions
          WHERE status = 'active'
        )
      `);

      interface RuleRow {
        id: string;
        type: string;
        pattern: string;
        weight: number;
        confidence: number;
        version: number;
        metadata: string;
        usage_count: number;
        success_count: number;
        adoption_count: number;
        total_latency: number;
      }

      const rules = stmt.all() as RuleRow[];

      return rules.map(rule => ({
        id: rule.id,
        type: rule.type as 'parameter' | 'context' | 'sequence',
        pattern: rule.pattern,
        weight: rule.weight,
        confidence: rule.confidence,
        version: rule.version,
        metadata: {
          ...JSON.parse(rule.metadata),
          performance: {
            usageCount: rule.usage_count || 0,
            successRate: rule.success_count / (rule.usage_count || 1),
            adoptionRate: rule.adoption_count / (rule.usage_count || 1),
            averageLatency: rule.total_latency / (rule.usage_count || 1)
          }
        }
      }));
    } catch (error) {
      console.error('[RuleOptimizer] Failed to get current rules:', error);
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