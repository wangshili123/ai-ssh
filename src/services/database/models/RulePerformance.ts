import { Database } from 'better-sqlite3';
import { DatabaseService } from '../DatabaseService';

export interface RulePerformanceData {
  ruleId: string;
  usageCount: number;
  successCount: number;
  adoptionCount: number;
  totalLatency: number;
  lastUsedAt: string | null;
}

/**
 * 规则性能模型
 * 负责管理规则性能指标的增删改查
 */
export class RulePerformance {
  private db: Database;

  constructor() {
    this.db = DatabaseService.getInstance().getDatabase();
  }

  async createTable(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS rule_performance (
        rule_id TEXT PRIMARY KEY,
        usage_count INTEGER DEFAULT 0,
        success_count INTEGER DEFAULT 0,
        adoption_count INTEGER DEFAULT 0,
        total_latency INTEGER DEFAULT 0,
        last_used_at TIMESTAMP,
        FOREIGN KEY (rule_id) REFERENCES completion_rules(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_rule_performance_usage ON rule_performance(usage_count DESC);
    `);
  }

  async create(data: RulePerformanceData): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO rule_performance (
        rule_id, usage_count, success_count, adoption_count, total_latency, last_used_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.ruleId,
      data.usageCount,
      data.successCount,
      data.adoptionCount,
      data.totalLatency,
      data.lastUsedAt
    );
  }

  async update(
    ruleId: string,
    usage: number,
    success: number,
    adoption: number,
    latency: number
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE rule_performance
      SET 
        usage_count = usage_count + ?,
        success_count = success_count + ?,
        adoption_count = adoption_count + ?,
        total_latency = total_latency + ?,
        last_used_at = CURRENT_TIMESTAMP
      WHERE rule_id = ?
    `);

    stmt.run(usage, success, adoption, latency, ruleId);
  }

  async findByRuleId(ruleId: string): Promise<RulePerformanceData | null> {
    const stmt = this.db.prepare(`
      SELECT *
      FROM rule_performance
      WHERE rule_id = ?
    `);

    const result = stmt.get(ruleId) as any;
    return result ? this.mapToData(result) : null;
  }

  private mapToData(record: any): RulePerformanceData {
    return {
      ruleId: record.rule_id,
      usageCount: record.usage_count,
      successCount: record.success_count,
      adoptionCount: record.adoption_count,
      totalLatency: record.total_latency,
      lastUsedAt: record.last_used_at
    };
  }
} 