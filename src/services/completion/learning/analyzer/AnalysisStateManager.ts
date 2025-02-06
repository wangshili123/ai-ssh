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

/**
 * 分析状态管理器
 * 负责管理各个分析组件的状态
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
} 