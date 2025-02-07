import { Database } from 'better-sqlite3';

export async function up(db: Database): Promise<void> {
  // 创建命令历史表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS command_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      context TEXT,
      frequency INTEGER DEFAULT 1,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN DEFAULT 1,
      outputs TEXT
    );

    -- 命令历史索引
    CREATE INDEX IF NOT EXISTS idx_command_history_command ON command_history(command);
    CREATE INDEX IF NOT EXISTS idx_command_history_last_used ON command_history(last_used);
    CREATE INDEX IF NOT EXISTS idx_command_history_frequency ON command_history(frequency);
  `);

  // 创建命令关系表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS command_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command1_id INTEGER NOT NULL,
      command2_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL,
      frequency INTEGER DEFAULT 0,
      last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
      success_rate REAL DEFAULT 0,
      avg_time_gap INTEGER DEFAULT 0,
      FOREIGN KEY (command1_id) REFERENCES command_history(id),
      FOREIGN KEY (command2_id) REFERENCES command_history(id),
      UNIQUE(command1_id, command2_id)
    );

    -- 命令关系索引
    CREATE INDEX IF NOT EXISTS idx_command_relations_prev ON command_relations(command1_id);
    CREATE INDEX IF NOT EXISTS idx_command_relations_next ON command_relations(command2_id);
    CREATE INDEX IF NOT EXISTS idx_command_relations_type ON command_relations(relation_type);
  `);
}

export async function down(db: Database): Promise<void> {
  await db.exec(`
    DROP INDEX IF EXISTS idx_command_relations_prev;
    DROP INDEX IF EXISTS idx_command_relations_next;
    DROP INDEX IF EXISTS idx_command_relations_type;
    DROP TABLE IF EXISTS command_relations;
    
    DROP INDEX IF EXISTS idx_command_history_command;
    DROP INDEX IF EXISTS idx_command_history_last_used;
    DROP INDEX IF EXISTS idx_command_history_frequency;
    DROP TABLE IF EXISTS command_history;
  `);
} 