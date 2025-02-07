import { CompletionRule } from '../analyzer/optimizer/types/rule-optimizer.types';
import { EnhancedContext } from '../../core/types/context.types';
import { RuleEvaluator } from '../../rules/RuleEvaluator';

interface MatchCacheItem {
  matchedRules: CompletionRule[];
  scores: Map<string, number>;
  timestamp: number;
}

/**
 * 规则缓存管理器
 * 负责管理补全规则的缓存
 */
export class RuleCache {
  private static instance: RuleCache;
  private rules: Map<string, CompletionRule>;
  private matchCache: Map<string, MatchCacheItem>;
  private ruleEvaluator: RuleEvaluator;

  // 缓存配置
  private readonly RULE_CACHE_TTL = 60 * 60 * 1000;     // 1小时
  private readonly RULE_CACHE_CAPACITY = 1000;          // 1000条规则
  private readonly MATCH_CACHE_TTL = 10 * 60 * 1000;    // 10分钟
  private readonly MATCH_CACHE_CAPACITY = 500;          // 500条匹配结果

  private constructor() {
    this.rules = new Map();
    this.matchCache = new Map();
    this.ruleEvaluator = RuleEvaluator.getInstance();
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
  public updateRules(newRules: CompletionRule[]): void {
    // 清空匹配缓存，因为规则已更新
    this.matchCache.clear();
    
    // 更新规则
    this.rules.clear();
    for (const rule of newRules) {
      this.rules.set(rule.id, rule);
    }

    // 如果超出容量限制，删除最旧的规则
    if (this.rules.size > this.RULE_CACHE_CAPACITY) {
      this.removeOldestRules();
    }
  }

  /**
   * 获取所有规则
   */
  public getRules(): CompletionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取匹配的规则（带缓存）
   */
  public getMatchingRules(
    input: string,
    context: EnhancedContext
  ): { rules: CompletionRule[]; scores: Map<string, number> } {
    // 1. 检查缓存
    const cacheKey = this.getCacheKey(input, context);
    const cached = this.getFromMatchCache(cacheKey);
    if (cached) {
      return {
        rules: cached.matchedRules,
        scores: cached.scores
      };
    }

    // 2. 计算匹配
    const result = this.computeMatchingRules(input, context);

    // 3. 更新缓存
    this.updateMatchCache(cacheKey, result);

    return result;
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(input: string, context: EnhancedContext): string {
    return `${input}:${context.currentDirectory}:${context.shellType}`;
  }

  /**
   * 从缓存获取匹配结果
   */
  private getFromMatchCache(key: string): MatchCacheItem | null {
    const cached = this.matchCache.get(key);
    if (!cached) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - cached.timestamp > this.MATCH_CACHE_TTL) {
      this.matchCache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * 计算规则匹配
   */
  private computeMatchingRules(
    input: string,
    context: EnhancedContext
  ): { rules: CompletionRule[]; scores: Map<string, number> } {
    const scores = new Map<string, number>();
    const matchedRules: CompletionRule[] = [];

    // 评估每个规则
    for (const rule of this.rules.values()) {
      const score = this.ruleEvaluator.evaluateRule(rule, input, context);
      if (score > 0) {
        matchedRules.push(rule);
        scores.set(rule.id, score);
      }
    }

    return { rules: matchedRules, scores };
  }

  /**
   * 更新匹配缓存
   */
  private updateMatchCache(
    key: string,
    result: { rules: CompletionRule[]; scores: Map<string, number> }
  ): void {
    // 检查缓存容量
    if (this.matchCache.size >= this.MATCH_CACHE_CAPACITY) {
      this.removeOldestMatchCache();
    }

    this.matchCache.set(key, {
      matchedRules: result.rules,
      scores: result.scores,
      timestamp: Date.now()
    });
  }

  /**
   * 移除最旧的匹配缓存
   */
  private removeOldestMatchCache(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.matchCache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.matchCache.delete(oldestKey);
    }
  }

  /**
   * 移除最旧的规则
   */
  private removeOldestRules(): void {
    const rulesArray = Array.from(this.rules.entries());
    const numberOfRulesToRemove = Math.ceil(this.RULE_CACHE_CAPACITY * 0.2); // 删除20%的规则
    
    rulesArray.slice(0, numberOfRulesToRemove).forEach(([id]) => {
      this.rules.delete(id);
    });
  }

  /**
   * 启动清理定时器
   */
  private startCleanupInterval(): void {
    // 每15分钟清理一次过期的匹配缓存
    setInterval(() => {
      const now = Date.now();
      
      // 清理过期的匹配缓存
      for (const [key, item] of this.matchCache.entries()) {
        if (now - item.timestamp > this.MATCH_CACHE_TTL) {
          this.matchCache.delete(key);
        }
      }
    }, 15 * 60 * 1000);
  }
} 