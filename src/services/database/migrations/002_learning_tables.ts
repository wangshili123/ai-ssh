import { Database } from 'better-sqlite3';

export async function up(db: Database): Promise<void> {
  // 创建命令使用表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS command_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      context TEXT,
      frequency INTEGER DEFAULT 1,
      success_count INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(command)
    );

    CREATE INDEX IF NOT EXISTS idx_command_usage_command ON command_usage(command);
    CREATE INDEX IF NOT EXISTS idx_command_usage_frequency ON command_usage(frequency DESC);
  `);

  // 创建补全使用表
  await db.exec(`
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
  `);
}

export async function down(db: Database): Promise<void> {
  await db.exec(`
    DROP INDEX IF EXISTS idx_completion_usage_input;
    DROP INDEX IF EXISTS idx_completion_usage_suggestion;
    DROP TABLE IF EXISTS completion_usage;
    
    DROP INDEX IF EXISTS idx_command_usage_command;
    DROP INDEX IF EXISTS idx_command_usage_frequency;
    DROP TABLE IF EXISTS command_usage;
  `);
} 