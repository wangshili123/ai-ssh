import { Database } from 'better-sqlite3';

export async function up(db: Database): Promise<void> {
  // 添加 outputs 列
  db.exec(`
    ALTER TABLE command_history
    ADD COLUMN outputs TEXT;
  `);

  // 更新现有记录的 outputs 为空数组
  db.exec(`
    UPDATE command_history
    SET outputs = '[]'
    WHERE outputs IS NULL;
  `);
}

export async function down(db: Database): Promise<void> {
  // 删除 outputs 列
  db.exec(`
    ALTER TABLE command_history
    DROP COLUMN outputs;
  `);
} 