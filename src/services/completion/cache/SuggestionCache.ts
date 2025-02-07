import { LRUCache } from './LRUCache';
import { CompletionSuggestion } from '../types/completion.types';
import { EnhancedContext } from '../core/types/context.types';

interface CacheItem {
  suggestions: CompletionSuggestion[];
  context: string;
  timestamp: number;
}

/**
 * 补全建议缓存
 * 使用 LRU 策略缓存补全建议，提高响应速度
 */
export class SuggestionCache extends LRUCache<string, CacheItem> {
  private static instance: SuggestionCache;

  private constructor() {
    // 1000条缓存，5分钟过期
    super(1000, 5 * 60 * 1000);
    this.startCleanupInterval();
  }

  public static getInstance(): SuggestionCache {
    if (!SuggestionCache.instance) {
      SuggestionCache.instance = new SuggestionCache();
    }
    return SuggestionCache.instance;
  }

  /**
   * 获取补全建议
   */
  public getSuggestions(
    input: string,
    context: EnhancedContext
  ): CompletionSuggestion[] | null {
    const key = this.getCacheKey(input, context);
    const item = this.get(key);
    
    if (item && this.isContextValid(item.context, context)) {
      return item.suggestions;
    }
    return null;
  }

  /**
   * 设置补全建议
   */
  public setSuggestions(
    input: string,
    context: EnhancedContext,
    suggestions: CompletionSuggestion[]
  ): void {
    const key = this.getCacheKey(input, context);
    const item: CacheItem = {
      suggestions,
      context: this.serializeContext(context),
      timestamp: Date.now()
    };
    this.set(key, item);
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(input: string, context: EnhancedContext): string {
    const contextKey = this.serializeContext(context);
    return `${input}:${contextKey}`;
  }

  /**
   * 序列化上下文
   * 只保留影响补全结果的关键信息
   */
  private serializeContext(context: EnhancedContext): string {
    return JSON.stringify({
      currentDirectory: context.currentDirectory,
      shellType: context.shellType
    });
  }

  /**
   * 验证上下文是否仍然有效
   */
  private isContextValid(
    cachedContext: string,
    currentContext: EnhancedContext
  ): boolean {
    const cached = JSON.parse(cachedContext);
    return (
      cached.currentDirectory === currentContext.currentDirectory &&
      cached.shellType === currentContext.shellType
    );
  }

  /**
   * 启动定期清理
   */
  private startCleanupInterval(): void {
    setInterval(() => this.cleanup(), 60 * 1000); // 每分钟清理一次
  }
} 