interface CacheOptions {
  expiration?: number;    // 过期时间(毫秒)
  maxSize?: number;       // 最大缓存条目数
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiration: number;
}

/**
 * 数据缓存服务
 * 负责管理监控数据的缓存
 */
export class CacheService {
  private static instance: CacheService;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: number;

  private constructor() {
    // 每分钟清理一次过期数据
    this.cleanupInterval = window.setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * 获取单例实例
   */
  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * 设置缓存
   * @param key 缓存键
   * @param data 缓存数据
   * @param options 缓存选项
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const {
      expiration = 30000,  // 默认30秒过期
      maxSize = 1000      // 默认最多1000条
    } = options;

    // 检查缓存大小
    if (this.cache.size >= maxSize) {
      // 删除最旧的数据
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
      this.cache.delete(oldestKey);
    }

    // 设置缓存
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiration
    });
  }

  /**
   * 获取缓存
   * @param key 缓存键
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.expiration) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.expiration) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): {
    size: number;
    oldestTimestamp: number;
    newestTimestamp: number;
  } {
    const entries = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      oldestTimestamp: Math.min(...entries.map(e => e.timestamp)),
      newestTimestamp: Math.max(...entries.map(e => e.timestamp))
    };
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.cache.clear();
    CacheService.instance = null as any;
  }
}

// 导出单例
export const cacheService = CacheService.getInstance(); 