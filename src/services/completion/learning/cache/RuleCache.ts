import { CompletionRule } from '../analyzer/optimizer/types/rule-optimizer.types';

interface CacheEntry {
  rule: CompletionRule;
  expiresAt: number;
  lastUsed: number;
}

/**
 * 规则缓存管理器
 * 负责管理补全规则的缓存
 */
export class RuleCache {
  private static instance: RuleCache;
  private rules: Map<string, CacheEntry> = new Map();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1小时
  private readonly MAX_CACHE_SIZE = 1000;

  private constructor() {
    this.startCleanupInterval();
  }

  public static getInstance(): RuleCache {
    if (!RuleCache.instance) {
      RuleCache.instance = new RuleCache();
    }
    return RuleCache.instance;
  }

  /**
   * 更新规则缓存
   */
  public async updateRules(newRules: CompletionRule[]): Promise<void> {
    const now = Date.now();
    
    // 更新或添加新规则
    for (const rule of newRules) {
      this.rules.set(rule.id, {
        rule,
        expiresAt: now + this.CACHE_DURATION,
        lastUsed: now
      });
    }

    // 如果缓存超出大小限制，删除最旧的规则
    if (this.rules.size > this.MAX_CACHE_SIZE) {
      this.removeOldestRules();
    }
  }

  /**
   * 获取所有规则
   */
  public getRules(): CompletionRule[] {
    const now = Date.now();
    const validRules: CompletionRule[] = [];

    for (const [id, entry] of this.rules.entries()) {
      if (entry.expiresAt > now) {
        entry.lastUsed = now;
        validRules.push(entry.rule);
      } else {
        this.rules.delete(id);
      }
    }

    return validRules;
  }

  /**
   * 获取单个规则
   */
  public getRule(ruleId: string): CompletionRule | null {
    const entry = this.rules.get(ruleId);
    const now = Date.now();

    if (entry && entry.expiresAt > now) {
      entry.lastUsed = now;
      return entry.rule;
    }

    if (entry) {
      this.rules.delete(ruleId);
    }

    return null;
  }

  /**
   * 清理过期规则
   */
  private cleanExpiredRules(): void {
    const now = Date.now();
    for (const [id, entry] of this.rules.entries()) {
      if (entry.expiresAt <= now) {
        this.rules.delete(id);
      }
    }
  }

  /**
   * 删除最旧的规则
   */
  private removeOldestRules(): void {
    const entries = Array.from(this.rules.entries())
      .sort(([, a], [, b]) => a.lastUsed - b.lastUsed);

    const numberOfRulesToRemove = Math.ceil(this.MAX_CACHE_SIZE * 0.2); // 删除20%的规则
    entries.slice(0, numberOfRulesToRemove).forEach(([id]) => {
      this.rules.delete(id);
    });
  }

  /**
   * 启动清理定时器
   */
  private startCleanupInterval(): void {
    setInterval(() => {
      this.cleanExpiredRules();
    }, 15 * 60 * 1000); // 每15分钟清理一次
  }

  /**
   * 获取缓存统计信息
   */
  public getCacheStats(): {
    totalRules: number;
    activeRules: number;
    expiredRules: number;
  } {
    const now = Date.now();
    let activeRules = 0;
    let expiredRules = 0;

    for (const entry of this.rules.values()) {
      if (entry.expiresAt > now) {
        activeRules++;
      } else {
        expiredRules++;
      }
    }

    return {
      totalRules: this.rules.size,
      activeRules,
      expiredRules
    };
  }
} 