import { CompletionRule, RuleUpdate } from './types/rule-optimizer.types';

/**
 * 规则应用器
 * 负责将规则更新应用到数据库
 */
export class RuleApplier {
  /**
   * 获取当前规则
   */
  public async getCurrentRules(): Promise<CompletionRule[]> {
    try {
      // TODO: 从数据库获取当前规则
      return [];
    } catch (error) {
      console.error('[RuleApplier] Failed to get current rules:', error);
      throw error;
    }
  }

  /**
   * 应用规则更新
   */
  public async applyUpdates(updates: RuleUpdate[]): Promise<void> {
    try {
      // TODO: 实现数据库事务
      for (const update of updates) {
        await this.applyUpdate(update);
      }
    } catch (error) {
      console.error('[RuleApplier] Failed to apply updates:', error);
      throw error;
    }
  }

  /**
   * 验证规则一致性
   */
  public validateRuleConsistency(rules: CompletionRule[]): boolean {
    try {
      // 1. 检查规则ID唯一性
      const ids = new Set<string>();
      for (const rule of rules) {
        if (ids.has(rule.id)) {
          console.error(`[RuleApplier] Duplicate rule ID: ${rule.id}`);
          return false;
        }
        ids.add(rule.id);
      }

      // 2. 检查权重范围
      for (const rule of rules) {
        if (rule.weight < 0 || rule.weight > 1) {
          console.error(`[RuleApplier] Invalid weight for rule ${rule.id}: ${rule.weight}`);
          return false;
        }
      }

      // 3. 检查置信度范围
      for (const rule of rules) {
        if (rule.confidence < 0 || rule.confidence > 1) {
          console.error(`[RuleApplier] Invalid confidence for rule ${rule.id}: ${rule.confidence}`);
          return false;
        }
      }

      // 4. 检查版本号递增
      const versionMap = new Map<string, number>();
      for (const rule of rules) {
        const currentVersion = versionMap.get(rule.id);
        if (currentVersion && rule.version <= currentVersion) {
          console.error(`[RuleApplier] Invalid version for rule ${rule.id}: ${rule.version}`);
          return false;
        }
        versionMap.set(rule.id, rule.version);
      }

      // 5. 检查元数据完整性
      for (const rule of rules) {
        if (!this.validateMetadata(rule)) {
          console.error(`[RuleApplier] Invalid metadata for rule ${rule.id}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('[RuleApplier] Rule consistency validation failed:', error);
      return false;
    }
  }

  /**
   * 更新规则权重
   */
  public updateRuleWeights(rules: CompletionRule[]): void {
    try {
      for (const rule of rules) {
        const performance = rule.metadata.performance;
        
        // 基于使用情况调整权重
        if (performance.usageCount > 0) {
          const successFactor = performance.successRate;
          const adoptionFactor = performance.adoptionRate;
          const latencyFactor = Math.max(0, 1 - (performance.averageLatency / 1000));
          
          // 综合评分
          const score = (successFactor + adoptionFactor + latencyFactor) / 3;
          
          // 更新权重
          rule.weight = (rule.weight * 0.7) + (score * 0.3);
        }
      }
    } catch (error) {
      console.error('[RuleApplier] Failed to update rule weights:', error);
      throw error;
    }
  }

  /**
   * 应用单个更新
   */
  private async applyUpdate(update: RuleUpdate): Promise<void> {
    try {
      // TODO: 实现数据库更新
      console.log(`[RuleApplier] Applying update for rule ${update.ruleId}`);
    } catch (error) {
      console.error(`[RuleApplier] Failed to apply update for rule ${update.ruleId}:`, error);
      throw error;
    }
  }

  /**
   * 验证规则元数据
   */
  private validateMetadata(rule: CompletionRule): boolean {
    const { metadata } = rule;
    
    // 检查必需字段
    if (!metadata.source || !metadata.createdAt || !metadata.updatedAt || !metadata.lastApplied) {
      return false;
    }

    // 检查时间戳格式
    const timestamps = [metadata.createdAt, metadata.updatedAt, metadata.lastApplied];
    for (const timestamp of timestamps) {
      if (isNaN(Date.parse(timestamp))) {
        return false;
      }
    }

    // 检查性能指标
    const { performance } = metadata;
    if (
      typeof performance.usageCount !== 'number' ||
      typeof performance.successRate !== 'number' ||
      typeof performance.adoptionRate !== 'number' ||
      typeof performance.averageLatency !== 'number'
    ) {
      return false;
    }

    // 检查性能指标范围
    if (
      performance.successRate < 0 || performance.successRate > 1 ||
      performance.adoptionRate < 0 || performance.adoptionRate > 1 ||
      performance.averageLatency < 0
    ) {
      return false;
    }

    return true;
  }
} 