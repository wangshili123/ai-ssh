import { Database } from 'better-sqlite3';
import { CompletionUsageData } from './types';

interface CollectorOptions {
  batchSize: number;
  flushInterval: number;
}

/**
 * 补全使用数据收集器
 */
export class CompletionUsageCollector {
  private db: Database;
  private options: CollectorOptions;

  constructor(db: Database, options: CollectorOptions) {
    this.db = db;
    this.options = options;
  }

  /**
   * 收集单条补全使用数据
   */
  public async collect(data: CompletionUsageData): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO completion_usage (
          input,
          suggestion,
          is_selected,
          created_at
        ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(
        data.input,
        data.suggestion,
        data.isSelected ? 1 : 0
      );
    } catch (error) {
      console.error('[CompletionUsageCollector] 收集补全使用数据失败:', error);
      throw error;
    }
  }

  /**
   * 批量收集补全使用数据
   */
  public async batchCollect(dataList: CompletionUsageData[]): Promise<void> {
    if (dataList.length === 0) {
      return;
    }

    try {
      // 开始事务
      const transaction = this.db.transaction((data: CompletionUsageData[]) => {
        const stmt = this.db.prepare(`
          INSERT INTO completion_usage (
            input,
            suggestion,
            is_selected,
            created_at
          ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);

        for (const item of data) {
          stmt.run(
            item.input,
            item.suggestion,
            item.isSelected ? 1 : 0
          );
        }
      });

      // 执行事务
      transaction(dataList);
      console.log('[CompletionUsageCollector] 批量处理完成:', dataList.length);
    } catch (error) {
      console.error('[CompletionUsageCollector] 批量处理失败:', error);
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