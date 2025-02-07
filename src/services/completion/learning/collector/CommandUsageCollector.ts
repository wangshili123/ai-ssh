import { Database } from 'better-sqlite3';
import { CommandUsageData } from './types';

interface CollectorOptions {
  batchSize: number;
  flushInterval: number;
}

/**
 * 命令使用数据收集器
 */
export class CommandUsageCollector {
  private db: Database;
  private options: CollectorOptions;

  constructor(db: Database, options: CollectorOptions) {
    this.db = db;
    this.options = options;
  }

  /**
   * 收集单条命令使用数据
   */
  public async collect(data: CommandUsageData): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO command_usage (command, success, last_used)
        VALUES (?, ?, ?)
        ON CONFLICT(command) DO UPDATE SET
          frequency = frequency + 1,
          success_count = success_count + CASE WHEN ? THEN 1 ELSE 0 END,
          fail_count = fail_count + CASE WHEN ? THEN 0 ELSE 1 END,
          last_used = ?
      `);

      stmt.run(
        data.command,
        data.success,
        data.timestamp,
        data.success,
        data.success,
        data.timestamp
      );
    } catch (error) {
      console.error('[CommandUsageCollector] 收集命令使用数据失败:', error);
      throw error;
    }
  }

  /**
   * 批量收集命令使用数据
   */
  public async batchCollect(dataList: CommandUsageData[]): Promise<void> {
    if (dataList.length === 0) {
      return;
    }

    try {
      // 开始事务
      const transaction = this.db.transaction((data: CommandUsageData[]) => {
        const stmt = this.db.prepare(`
          INSERT INTO command_usage (command, success, last_used)
          VALUES (?, ?, ?)
          ON CONFLICT(command) DO UPDATE SET
            frequency = frequency + 1,
            success_count = success_count + CASE WHEN ? THEN 1 ELSE 0 END,
            fail_count = fail_count + CASE WHEN ? THEN 0 ELSE 1 END,
            last_used = ?
        `);

        for (const item of data) {
          stmt.run(
            item.command,
            item.success,
            item.timestamp,
            item.success,
            item.success,
            item.timestamp
          );
        }
      });

      // 执行事务
      transaction(dataList);
      console.log('[CommandUsageCollector] 批量处理完成:', dataList.length);
    } catch (error) {
      console.error('[CommandUsageCollector] 批量处理失败:', error);
      throw error;
    }
  }

  /**
   * 清理资源
   */
  public async dispose(): Promise<void> {
    // 目前没有需要清理的资源
  }
} 