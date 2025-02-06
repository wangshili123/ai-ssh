import Database from 'better-sqlite3';
import { BaseCollector } from './BaseCollector';
import { CompletionUsageData, CollectorOptions } from './types';
import { CompletionUsage } from '../../../database/models';

/**
 * 补全使用数据收集器
 * 负责收集和记录用户对补全建议的使用情况
 */
export class CompletionUsageCollector extends BaseCollector {
  private db: Database.Database;

  constructor(db: Database.Database, options: CollectorOptions = {
    batchSize: 50,
    flushInterval: 5000
  }) {
    super(options);
    this.db = db;
  }

  /**
   * 收集补全使用数据
   * @param data 补全使用数据
   */
  async collect(data: CompletionUsageData): Promise<void> {
    const key = `${data.input}:${data.suggestion}`;
    this.cache.set(key, {
      input: String(data.input),
      suggestion: String(data.suggestion),
      is_selected: data.isSelected ? 1 : 0
    });

    if (this.cache.size >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * 将缓存数据写入数据库
   */
  protected async flush(): Promise<void> {
    if (this.cache.size === 0) return;

    const stmt = this.db.prepare(`
      INSERT INTO completion_usage 
        (input, suggestion, is_selected)
      VALUES 
        (@input, @suggestion, @is_selected)
    `);

    try {
      this.db.transaction(() => {
        for (const data of this.cache.values()) {
          stmt.run({
            input: String(data.input),
            suggestion: String(data.suggestion),
            is_selected: Number(data.is_selected)
          });
        }
      })();
      this.cache.clear();
    } catch (error) {
      console.error('Failed to flush completion usage data:', error);
      throw error;
    }
  }
} 