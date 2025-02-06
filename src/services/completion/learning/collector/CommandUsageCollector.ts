import Database from 'better-sqlite3';
import { BaseCollector } from './BaseCollector';
import { CommandUsageData, CollectorOptions } from './types';
import { CommandUsage } from '../../../database/models';

/**
 * 命令使用数据收集器
 * 负责收集和记录用户命令使用情况
 */
export class CommandUsageCollector extends BaseCollector {
  private db: Database.Database;

  constructor(db: Database.Database, options: CollectorOptions = {
    batchSize: 50,
    flushInterval: 5000
  }) {
    super(options);
    this.db = db;
  }

  /**
   * 收集命令使用数据
   * @param data 命令使用数据
   */
  async collect(data: CommandUsageData): Promise<void> {
    const key = data.command;
    const existing = this.cache.get(key);

    if (existing) {
      existing.frequency++;
      if (data.success) {
        existing.successCount++;
      } else {
        existing.failCount++;
      }
    } else {
      this.cache.set(key, {
        command: data.command,
        frequency: 1,
        successCount: data.success ? 1 : 0,
        failCount: data.success ? 0 : 1
      });
    }

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
      INSERT INTO command_usage 
        (command, frequency, success_count, fail_count)
      VALUES 
        (@command, @frequency, @successCount, @failCount)
      ON CONFLICT(command) DO UPDATE SET
        frequency = frequency + excluded.frequency,
        success_count = success_count + excluded.success_count,
        fail_count = fail_count + excluded.fail_count,
        last_used = CURRENT_TIMESTAMP
    `);

    try {
      this.db.transaction(() => {
        for (const data of this.cache.values()) {
          stmt.run(data);
        }
      })();
      this.cache.clear();
    } catch (error) {
      console.error('Failed to flush command usage data:', error);
      throw error;
    }
  }
} 