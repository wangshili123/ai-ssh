import { Database } from 'better-sqlite3';
import { DatabaseService } from '../DatabaseService';
import { RuleUpdate } from '../../completion/learning/analyzer/optimizer/types/rule-optimizer.types';

export interface RuleVersionData {
  version: number;
  changes: RuleUpdate[];
  status: 'active' | 'rollback' | 'deprecated';
  createdAt: string;
}

/**
 * 规则版本模型
 * 负责管理规则版本的增删改查
 */
export class RuleVersion {
  private db: Database;

  constructor() {
    this.db = DatabaseService.getInstance().getDatabase();
  }

  async createTable(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS rule_versions (
        version INTEGER PRIMARY KEY,
        changes JSON NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'rollback', 'deprecated')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_rule_versions_status ON rule_versions(status);
    `);
  }

  async create(data: RuleVersionData): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO rule_versions (version, changes, status)
      VALUES (?, ?, ?)
    `);

    stmt.run(
      data.version,
      JSON.stringify(data.changes),
      data.status
    );
  }

  async updateStatus(version: number, status: RuleVersionData['status']): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE rule_versions
      SET status = ?
      WHERE version = ?
    `);

    stmt.run(status, version);
  }

  async findAll(): Promise<RuleVersionData[]> {
    const stmt = this.db.prepare(`
      SELECT *
      FROM rule_versions
      ORDER BY version DESC
    `);

    const versions = stmt.all() as any[];
    return versions.map(this.mapToData);
  }

  async findByVersion(version: number): Promise<RuleVersionData | null> {
    const stmt = this.db.prepare(`
      SELECT *
      FROM rule_versions
      WHERE version = ?
    `);

    const result = stmt.get(version) as any;
    return result ? this.mapToData(result) : null;
  }

  private mapToData(record: any): RuleVersionData {
    return {
      version: record.version,
      changes: JSON.parse(record.changes),
      status: record.status,
      createdAt: record.created_at
    };
  }
} 