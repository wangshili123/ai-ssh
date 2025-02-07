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
        INSERT INTO command_usage (
          command,
          frequency,
          success_count,
          fail_count,
          last_used
        ) VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(command) DO UPDATE SET
          frequency = frequency + 1,
          success_count = success_count + ?,
          fail_count = fail_count + ?,
          last_used = CURRENT_TIMESTAMP
      `);

      const successCount = data.success ? 1 : 0;
      const failCount = data.success ? 0 : 1;

      stmt.run(
        data.command,
        successCount,
        failCount,
        successCount,
        failCount
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
          INSERT INTO command_usage (
            command,
            frequency,
            success_count,
            fail_count,
            last_used
          ) VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(command) DO UPDATE SET
            frequency = frequency + 1,
            success_count = success_count + ?,
            fail_count = fail_count + ?,
            last_used = CURRENT_TIMESTAMP
        `);

        for (const item of data) {
          const successCount = item.success ? 1 : 0;
          const failCount = item.success ? 0 : 1;

          stmt.run(
            item.command,
            successCount,
            failCount,
            successCount,
            failCount
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