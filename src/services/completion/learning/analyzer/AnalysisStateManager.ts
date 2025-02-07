import { Database } from 'better-sqlite3';
import { DatabaseService } from '../../../database/DatabaseService';

/**
 * 分析状态数据接口
 */
export interface AnalysisState {
  lastProcessedId: number;
  lastAnalysisTime: Date;
  processedCount: number;
  metrics: {
    // PatternAnalyzer 指标
    totalCommands?: number;
    uniqueCommands?: number;
    averageConfidence?: number;
    
    // AIAnalyzer 指标
    insightCount?: number;
    processingTime?: number;
    
    // RuleOptimizer 指标
    totalRules?: number;
    updatedRules?: number;
    averageRuleConfidence?: number;
  };
}

export interface DataCheckResult {
  hasEnoughData: boolean;
  metrics: {
    newCommandCount: number;    // 新增命令数
    newCompletionCount: number; // 新增补全数
    lastAnalysisTime: Date;     // 上次分析时间
    dataChangeRate: number;     // 数据变化率
  };
}

/**
 * 分析状态管理器
 * 负责管理各个分析组件的状态和检查数据充分性
 */
export class AnalysisStateManager {
  private static instance: AnalysisStateManager;
  private db: Database;

  private constructor() {
    this.db = DatabaseService.getInstance().getDatabase();
  }

  public static getInstance(): AnalysisStateManager {
    if (!AnalysisStateManager.instance) {
      AnalysisStateManager.instance = new AnalysisStateManager();
    }
    return AnalysisStateManager.instance;
  }

  /**
   * 获取组件状态
   */
  public async getState(component: string): Promise<AnalysisState | null> {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          last_processed_id,
          last_analysis_time,
          processed_count,
          analysis_metrics
        FROM analysis_state
        WHERE component = ?
      `);

      const result = stmt.get(component) as any;

      if (!result) {
        return null;
      }

      return {
        lastProcessedId: result.last_processed_id,
        lastAnalysisTime: new Date(result.last_analysis_time),
        processedCount: result.processed_count,
        metrics: JSON.parse(result.analysis_metrics || '{}')
      };
    } catch (error) {
      console.error(`[AnalysisStateManager] Failed to get state for ${component}:`, error);
      throw error;
    }
  }

  /**
   * 更新组件状态
   */
  public async updateState(
    component: string,
    state: {
      lastProcessedId: number;
      processedCount: number;
      metrics: any;
    }
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO analysis_state (
          component,
          last_processed_id,
          last_analysis_time,
          processed_count,
          analysis_metrics,
          updated_at
        ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(component) DO UPDATE SET
          last_processed_id = excluded.last_processed_id,
          last_analysis_time = excluded.last_analysis_time,
          processed_count = excluded.processed_count,
          analysis_metrics = excluded.analysis_metrics,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        component,
        state.lastProcessedId,
        state.processedCount,
        JSON.stringify(state.metrics)
      );
    } catch (error) {
      console.error(`[AnalysisStateManager] Failed to update state for ${component}:`, error);
      throw error;
    }
  }

  /**
   * 删除组件状态
   */
  public async deleteState(component: string): Promise<void> {
    try {
      const stmt = this.db.prepare('DELETE FROM analysis_state WHERE component = ?');
      stmt.run(component);
    } catch (error) {
      console.error(`[AnalysisStateManager] Failed to delete state for ${component}:`, error);
      throw error;
    }
  }

  /**
   * 获取所有组件状态
   */
  public async getAllStates(): Promise<Record<string, AnalysisState>> {
    try {
      const stmt = this.db.prepare('SELECT * FROM analysis_state');
      const results = stmt.all() as any[];

      return results.reduce((acc, result) => {
        acc[result.component] = {
          lastProcessedId: result.last_processed_id,
          lastAnalysisTime: new Date(result.last_analysis_time),
          processedCount: result.processed_count,
          metrics: JSON.parse(result.analysis_metrics || '{}')
        };
        return acc;
      }, {});
    } catch (error) {
      console.error('[AnalysisStateManager] Failed to get all states:', error);
      throw error;
    }
  }

  /**
   * 检查是否有足够的新数据进行分析
   */
  public async checkDataSufficiency(): Promise<DataCheckResult> {
    try {
      // 1. 获取上次分析状态
      const lastState = await this.getLastAnalysisState();
      const lastProcessedId = lastState?.last_processed_id || 0;
      const lastAnalysisTime = lastState?.last_analysis_time ? new Date(lastState.last_analysis_time) : new Date(0);

      // 2. 获取新增数据量
      const newDataCounts = await this.getNewDataCounts(lastProcessedId);

      // 3. 计算数据变化率
      const dataChangeRate = await this.calculateDataChangeRate(lastProcessedId);

      const result: DataCheckResult = {
        hasEnoughData: this.checkDataThresholds(newDataCounts, dataChangeRate),
        metrics: {
          newCommandCount: newDataCounts.commandCount,
          newCompletionCount: newDataCounts.completionCount,
          lastAnalysisTime,
          dataChangeRate
        }
      };

      console.log('[AnalysisStateManager] 数据充分性检查结果:', result);
      return result;

    } catch (error) {
      console.error('[AnalysisStateManager] 数据充分性检查失败:', error);
      throw error;
    }
  }

  /**
   * 获取上次分析状态
   */
  private async getLastAnalysisState(): Promise<{
    last_processed_id: number;
    last_analysis_time: string;
    processed_count: number;
    analysis_metrics: string;
  } | undefined> {
    const stmt = this.db.prepare(`
      SELECT last_processed_id, last_analysis_time, processed_count, analysis_metrics
      FROM analysis_state
      WHERE component = 'PatternAnalyzer'
    `);
    return stmt.get() as any;
  }

  /**
   * 获取新增数据量
   */
  private async getNewDataCounts(lastProcessedId: number) {
    // 获取新增命令数
    const commandStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM command_usage
      WHERE id > ?
    `);
    const { count: commandCount } = commandStmt.get(lastProcessedId) as { count: number };

    // 获取新增补全数
    const completionStmt = this.db.prepare(`
      SELECT COUNT(*) as count
      FROM completion_usage
      WHERE id > ?
    `);
    const { count: completionCount } = completionStmt.get(lastProcessedId) as { count: number };

    return { commandCount, completionCount };
  }

  /**
   * 计算数据变化率
   */
  private async calculateDataChangeRate(lastProcessedId: number): Promise<number> {
    try {
      // 获取总数据量
      const totalStmt = this.db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM command_usage) as totalCommands,
          (SELECT COUNT(*) FROM completion_usage) as totalCompletions
      `);
      const { totalCommands, totalCompletions } = totalStmt.get() as { 
        totalCommands: number;
        totalCompletions: number;
      };

      // 获取新增数据量
      const { commandCount, completionCount } = await this.getNewDataCounts(lastProcessedId);

      // 如果总数据量为0，返回1表示100%变化
      if (totalCommands === 0 && totalCompletions === 0) {
        return 1;
      }

      // 计算变化率
      const commandChangeRate = totalCommands > 0 ? commandCount / totalCommands : 0;
      const completionChangeRate = totalCompletions > 0 ? completionCount / totalCompletions : 0;

      // 返回较大的变化率
      return Math.max(commandChangeRate, completionChangeRate);

    } catch (error) {
      console.error('[AnalysisStateManager] 计算数据变化率失败:', error);
      return 0;
    }
  }

  /**
   * 检查数据是否达到阈值
   */
  private checkDataThresholds(
    counts: { commandCount: number; completionCount: number },
    changeRate: number
  ): boolean {
    const minCommandCount = 10;
    const minCompletionCount = 2;
    const minChangeRate = 0.2;
    console.log('[AnalysisStateManager] 数据检查结果:', {
      commandCount: counts.commandCount,
      completionCount: counts.completionCount,
      changeRate,
      minCommandCount,
      minCompletionCount,
      minChangeRate
    });
    return counts.commandCount >= minCommandCount &&
           counts.completionCount >= minCompletionCount &&
           changeRate >= minChangeRate;

  }

  /**
   * 更新分析状态
   */
  public async updateAnalysisState(
    lastProcessedId: number,
    processedCount: number,
    metrics: any
  ): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE analysis_state
        SET last_processed_id = ?,
            last_analysis_time = CURRENT_TIMESTAMP,
            processed_count = processed_count + ?,
            analysis_metrics = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE component = 'PatternAnalyzer'
      `);

      stmt.run(
        lastProcessedId,
        processedCount,
        JSON.stringify(metrics)
      );

      console.log('[AnalysisStateManager] 分析状态已更新:', {
        lastProcessedId,
        processedCount,
        metrics
      });
    } catch (error) {
      console.error('[AnalysisStateManager] 更新分析状态失败:', error);
      throw error;
    }
  }
} 