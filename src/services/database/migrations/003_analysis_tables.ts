import { Database } from 'better-sqlite3';

export async function up(db: Database): Promise<void> {
  // 创建分析状态表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS analysis_state (
      id INTEGER PRIMARY KEY,
      component TEXT NOT NULL,
      last_processed_id INTEGER,
      last_analysis_time TIMESTAMP,
      processed_count INTEGER,
      analysis_metrics TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      UNIQUE(component)
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_state_component ON analysis_state(component);
  `);

  // 创建AI补全结果表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS ai_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      parts TEXT,
      frequency INTEGER NOT NULL,
      confidence REAL NOT NULL,
      context TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_ai_completions_command ON ai_completions(command);
    CREATE INDEX IF NOT EXISTS idx_ai_completions_confidence ON ai_completions(confidence);
  `);
}

export async function down(db: Database): Promise<void> {
  await db.exec(`
    
    DROP INDEX IF EXISTS idx_ai_completions_confidence;
    DROP INDEX IF EXISTS idx_ai_completions_command;
    DROP TABLE IF EXISTS ai_completions;
    
    DROP INDEX IF EXISTS idx_analysis_state_component;
    DROP TABLE IF EXISTS analysis_state;
  `);
} 