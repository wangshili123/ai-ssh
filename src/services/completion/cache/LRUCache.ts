/**
 * LRU (Least Recently Used) 缓存基类
 * 提供基础的缓存功能，包括：
 * - 最近最少使用淘汰策略
 * - TTL (Time To Live) 过期机制
 * - 容量控制
 */
export abstract class LRUCache<K, V> {
  private cache: Map<K, V>;
  private keyTimestamps: Map<K, number>;
  private readonly capacity: number;
  private readonly ttl: number;  // 缓存生存时间（毫秒）

  constructor(capacity: number = 1000, ttl: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.keyTimestamps = new Map();
    this.capacity = capacity;
    this.ttl = ttl;
  }

  /**
   * 设置缓存项
   */
  protected set(key: K, value: V): void {
    if (this.cache.size >= this.capacity) {
      this.removeLeastRecentlyUsed();
    }
    this.cache.set(key, value);
    this.keyTimestamps.set(key, Date.now());
  }

  /**
   * 获取缓存项
   */
  protected get(key: K): V | null {
    const value = this.cache.get(key);
    const timestamp = this.keyTimestamps.get(key);
    
    if (!value || !timestamp) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - timestamp > this.ttl) {
      this.cache.delete(key);
      this.keyTimestamps.delete(key);
      return null;
    }

    // 更新访问时间
    this.keyTimestamps.set(key, Date.now());
    return value;
  }

  /**
   * 删除最久未使用的缓存项
   */
  private removeLeastRecentlyUsed(): void {
    let oldestKey: K | null = null;
    let oldestTime = Date.now();

    for (const [key, timestamp] of this.keyTimestamps.entries()) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.keyTimestamps.delete(oldestKey);
    }
  }

  /**
   * 清理过期的缓存项
   */
  protected cleanup(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.keyTimestamps.entries()) {
      if (now - timestamp > this.ttl) {
        this.cache.delete(key);
        this.keyTimestamps.delete(key);
      }
    }
  }

  /**
   * 获取缓存大小
   */
  protected size(): number {
    return this.cache.size;
  }

  /**
   * 清空缓存
   */
  protected clear(): void {
    this.cache.clear();
    this.keyTimestamps.clear();
  }

  /**
   * 检查键是否存在
   */
  protected has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * 删除指定的缓存项
   */
  protected delete(key: K): void {
    this.cache.delete(key);
    this.keyTimestamps.delete(key);
  }
} 