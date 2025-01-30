import { Database } from 'better-sqlite3';

export async function up(db: Database): Promise<void> {
  // 创建命令历史表
  db.exec(`
    CREATE TABLE IF NOT EXISTS command_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      command TEXT NOT NULL,
      context TEXT,
      frequency INTEGER NOT NULL DEFAULT 1,
      last_used DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      success INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_command_history_command ON command_history(command);
    CREATE INDEX IF NOT EXISTS idx_command_history_frequency ON command_history(frequency DESC);
    CREATE INDEX IF NOT EXISTS idx_command_history_last_used ON command_history(last_used DESC);
  `);

  // 创建命令关系表
  db.exec(`
    CREATE TABLE IF NOT EXISTS command_relation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL,
      target_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL,
      frequency INTEGER NOT NULL DEFAULT 1,
      last_used DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES command_history(id),
      FOREIGN KEY (target_id) REFERENCES command_history(id)
    );

    CREATE INDEX IF NOT EXISTS idx_command_relation_source ON command_relation(source_id);
    CREATE INDEX IF NOT EXISTS idx_command_relation_target ON command_relation(target_id);
    CREATE INDEX IF NOT EXISTS idx_command_relation_type ON command_relation(relation_type);
  `);
}

export async function down(db: Database): Promise<void> {
  // 删除命令关系表
  db.exec(`
    DROP TABLE IF EXISTS command_relation;
  `);

  // 删除命令历史表
  db.exec(`
    DROP TABLE IF EXISTS command_history;
  `);
} 