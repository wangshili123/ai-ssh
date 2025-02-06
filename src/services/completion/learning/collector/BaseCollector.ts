import { Collector, CollectorOptions } from './types';

/**
 * 基础数据收集器
 * 提供数据缓存和批量处理功能
 */
export abstract class BaseCollector implements Collector {
  protected cache: Map<string, any>;
  protected batchSize: number;
  protected flushInterval: number;
  protected flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: CollectorOptions) {
    this.cache = new Map();
    this.batchSize = options.batchSize;
    this.flushInterval = options.flushInterval;
    this.setupAutoFlush();
  }

  /**
   * 收集数据
   * @param data 要收集的数据
   */
  abstract collect(data: any): Promise<void>;

  /**
   * 将缓存数据写入数据库
   */
  protected abstract flush(): Promise<void>;

  /**
   * 设置自动刷新定时器
   */
  private setupAutoFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      try {
        if (this.cache.size > 0) {
          await this.flush();
        }
      } catch (error) {
        console.error('Auto flush failed:', error);
      }
    }, this.flushInterval);
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
} 
