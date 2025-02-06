import { Database } from 'better-sqlite3';
import { DatabaseService } from '../DatabaseService';

export interface CompletionRuleData {
  id: string;
  type: 'parameter' | 'context' | 'sequence';
  pattern: string;
  weight: number;
  confidence: number;
  version: number;
  metadata: {
    createdAt: string;
    updatedAt: string;
    performance: {
      usageCount: number;
      successRate: number;
      adoptionRate: number;
      averageLatency: number;
    };
  };
}

/**
 * 完成规则模型
 * 负责管理命令补全规则的增删改查
 */
export class CompletionRule {
  private db: Database;

  constructor() {
    this.db = DatabaseService.getInstance().getDatabase();
  }

  async createTable(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS completion_rules (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('parameter', 'context', 'sequence')),
        pattern TEXT NOT NULL,
        weight REAL NOT NULL CHECK (weight >= 0 AND weight <= 1),
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        version INTEGER NOT NULL,
        metadata JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_completion_rules_type ON completion_rules(type);
      CREATE INDEX IF NOT EXISTS idx_completion_rules_weight ON completion_rules(weight DESC);
    `);
  }

  async create(data: CompletionRuleData): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO completion_rules (
        id, type, pattern, weight, confidence, version, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      data.id,
      data.type,
      data.pattern,
      data.weight,
      data.confidence,
      data.version,
      JSON.stringify(data.metadata),
      data.metadata.createdAt,
      data.metadata.updatedAt
    );
  }

  async update(id: string, data: Partial<CompletionRuleData>): Promise<void> {
    const sets: string[] = [];
    const params: any[] = [];

    if (data.pattern) {
      sets.push('pattern = ?');
      params.push(data.pattern);
    }
    if (data.weight !== undefined) {
      sets.push('weight = ?');
      params.push(data.weight);
    }
    if (data.confidence !== undefined) {
      sets.push('confidence = ?');
      params.push(data.confidence);
    }
    if (data.version !== undefined) {
      sets.push('version = ?');
      params.push(data.version);
    }
    if (data.metadata) {
      sets.push('metadata = ?');
      params.push(JSON.stringify(data.metadata));
    }

    if (sets.length > 0) {
      sets.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);

      const stmt = this.db.prepare(`
        UPDATE completion_rules
        SET ${sets.join(', ')}
        WHERE id = ?
      `);
      
      stmt.run(...params);
    }
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM completion_rules WHERE id = ?');
    stmt.run(id);
  }

  async findById(id: string): Promise<CompletionRuleData | null> {
    const stmt = this.db.prepare(`
      SELECT r.*, p.usage_count, p.success_count, p.adoption_count, p.total_latency
      FROM completion_rules r
      LEFT JOIN rule_performance p ON r.id = p.rule_id
      WHERE r.id = ?
    `);

    const rule = stmt.get(id) as any;
    return rule ? this.mapToData(rule) : null;
  }

  async findAll(): Promise<CompletionRuleData[]> {
    const stmt = this.db.prepare(`
      SELECT r.*, p.usage_count, p.success_count, p.adoption_count, p.total_latency
      FROM completion_rules r
      LEFT JOIN rule_performance p ON r.id = p.rule_id
      ORDER BY r.weight DESC
    `);

    const rules = stmt.all() as any[];
    return rules.map(this.mapToData);
  }

  private mapToData(record: any): CompletionRuleData {
    const metadata = JSON.parse(record.metadata);
    
    const performance = {
      usageCount: record.usage_count || 0,
      successRate: record.usage_count ? (record.success_count / record.usage_count) : 0,
      adoptionRate: record.usage_count ? (record.adoption_count / record.usage_count) : 0,
      averageLatency: record.usage_count ? (record.total_latency / record.usage_count) : 0
    };

    return {
      id: record.id,
      type: record.type,
      pattern: record.pattern,
      weight: record.weight,
      confidence: record.confidence,
      version: record.version,
      metadata: {
        ...metadata,
        performance
      }
    };
  }
} 