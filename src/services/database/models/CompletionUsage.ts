import { Database } from 'better-sqlite3';
import { DatabaseService } from '../DatabaseService';

/**
 * 补全使用记录模型
 */
export interface CompletionUsage {
  id?: number;
  input: string;
  suggestion: string;
  is_selected: boolean;
  context?: string;
  created_at?: string;
}

export const createCompletionUsageTable = `
  CREATE TABLE IF NOT EXISTS completion_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    input TEXT NOT NULL,
    suggestion TEXT NOT NULL,
    is_selected BOOLEAN DEFAULT 0,
    context TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_completion_usage_input ON completion_usage(input);
  CREATE INDEX IF NOT EXISTS idx_completion_usage_suggestion ON completion_usage(suggestion);
`;

/**
 * 补全使用记录模型
 */
export class CompletionUsageModel {
  private db: Database;

  constructor() {
    this.db = DatabaseService.getInstance().getDatabase();
    this.createTable();
  }

  private async createTable(): Promise<void> {
    await this.db.exec(createCompletionUsageTable);
  }

  public async create(data: CompletionUsage): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO completion_usage (input, suggestion, is_selected, context)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      data.input,
      data.suggestion,
      data.is_selected,
      data.context
    );
  }

  public async findAll(): Promise<CompletionUsage[]> {
    const stmt = this.db.prepare('SELECT * FROM completion_usage ORDER BY created_at DESC');
    return stmt.all() as CompletionUsage[];
  }

  public async findByInput(input: string): Promise<CompletionUsage[]> {
    const stmt = this.db.prepare('SELECT * FROM completion_usage WHERE input = ? ORDER BY created_at DESC');
    return stmt.all(input) as CompletionUsage[];
  }

  public async findAfterLastProcessedId(lastProcessedId: number, limit: number): Promise<CompletionUsage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM completion_usage 
      WHERE id > ? 
      ORDER BY id ASC 
      LIMIT ?
    `);
    return stmt.all(lastProcessedId, limit) as CompletionUsage[];
  }
} 