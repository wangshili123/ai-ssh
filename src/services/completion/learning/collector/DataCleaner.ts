import { Database } from 'better-sqlite3';

interface CleanerConfig {
  maxDataAge: number;         // 数据最大保留时间（毫秒）
  cleanupInterval: number;    // 清理间隔（毫秒）
  maxRecords: number;         // 每个表保留的最大记录数
  compressionThreshold: number; // 触发压缩的阈值
}

/**
 * 数据清理器
 * 负责定期清理过期数据和压缩历史数据
 */
export class DataCleaner {
  private db: Database;
  private config: CleanerConfig;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(db: Database, config: Partial<CleanerConfig> = {}) {
    this.db = db;
    this.config = {
      maxDataAge: 30 * 24 * 60 * 60 * 1000,  // 30天
      cleanupInterval: 24 * 60 * 60 * 1000,   // 1天
      maxRecords: 100000,                     // 10万条记录
      compressionThreshold: 50000,            // 5万条记录
      ...config
    };
  }

  /**
   * 启动清理任务
   */
  public start(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanup();
      } catch (error) {
        console.error('[DataCleaner] 清理任务执行失败:', error);
      }
    }, this.config.cleanupInterval);

    console.log('[DataCleaner] 清理任务已启动');
  }

  /**
   * 停止清理任务
   */
  public stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    console.log('[DataCleaner] 清理任务已停止');
  }

  /**
   * 执行清理任务
   */
  private async cleanup(): Promise<void> {
    console.log('[DataCleaner] 开始执行清理任务');
    
    try {
      // 开始事务
      this.db.transaction(() => {
        // 1. 清理过期数据
        this.cleanExpiredData();
        
        // 2. 检查是否需要压缩
        this.checkAndCompress();
        
        // 3. 维护索引
        this.maintainIndexes();
      })();

      console.log('[DataCleaner] 清理任务完成');
    } catch (error) {
      console.error('[DataCleaner] 清理任务失败:', error);
      throw error;
    }
  }

  /**
   * 清理过期数据
   */
  private cleanExpiredData(): void {
    const cutoffTime = new Date(Date.now() - this.config.maxDataAge);
    
    // 清理命令使用数据
    const cmdResult = this.db.prepare(`
      DELETE FROM command_usage 
      WHERE last_used < ?
    `).run(cutoffTime);

    // 清理补全使用数据
    const completionResult = this.db.prepare(`
      DELETE FROM completion_usage 
      WHERE timestamp < ?
    `).run(cutoffTime);

    console.log('[DataCleaner] 清理结果:', {
      commandRecords: cmdResult.changes,
      completionRecords: completionResult.changes
    });
  }

  /**
   * 检查并执行数据压缩
   */
  private checkAndCompress(): void {
    // 获取表记录数
    const cmdCount = this.db.prepare('SELECT COUNT(*) as count FROM command_usage').get() as { count: number };
    const completionCount = this.db.prepare('SELECT COUNT(*) as count FROM completion_usage').get() as { count: number };

    // 检查是否需要压缩
    if (cmdCount.count > this.config.compressionThreshold) {
      this.compressCommandData();
    }
    if (completionCount.count > this.config.compressionThreshold) {
      this.compressCompletionData();
    }
  }

  /**
   * 压缩命令使用数据
   */
  private compressCommandData(): void {
    // 1. 创建临时表存储聚合数据
    this.db.prepare(`
      CREATE TEMP TABLE IF NOT EXISTS temp_command_stats AS
      SELECT 
        command,
        COUNT(*) as frequency,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as fail_count,
        MAX(last_used) as last_used
      FROM command_usage
      GROUP BY command
    `).run();

    // 2. 清空原表
    this.db.prepare('DELETE FROM command_usage').run();

    // 3. 插入聚合数据
    this.db.prepare(`
      INSERT INTO command_usage (command, frequency, success_count, fail_count, last_used)
      SELECT * FROM temp_command_stats
    `).run();

    // 4. 删除临时表
    this.db.prepare('DROP TABLE temp_command_stats').run();

    console.log('[DataCleaner] 命令使用数据压缩完成');
  }

  /**
   * 压缩补全使用数据
   */
  private compressCompletionData(): void {
    // 保留最近的数据
    const keepRecords = Math.floor(this.config.maxRecords * 0.8); // 保留80%的最新记录
    
    this.db.prepare(`
      DELETE FROM completion_usage 
      WHERE id NOT IN (
        SELECT id FROM completion_usage 
        ORDER BY timestamp DESC 
        LIMIT ?
      )
    `).run(keepRecords);

    console.log('[DataCleaner] 补全使用数据压缩完成');
  }

  /**
   * 维护数据库索引
   */
  private maintainIndexes(): void {
    try {
      // 重建索引
      this.db.prepare('REINDEX idx_command_usage_command').run();
      this.db.prepare('REINDEX idx_command_usage_frequency').run();
      this.db.prepare('REINDEX idx_completion_usage_input').run();
      this.db.prepare('REINDEX idx_completion_usage_suggestion').run();

      // 更新统计信息
      this.db.prepare('ANALYZE command_usage').run();
      this.db.prepare('ANALYZE completion_usage').run();

      console.log('[DataCleaner] 索引维护完成');
    } catch (error) {
      console.error('[DataCleaner] 索引维护失败:', error);
    }
  }
} 