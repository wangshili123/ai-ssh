import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationRecord {
  name: string;
  executed_at: string;
}

export class MigrationManager {
  private db: Database.Database;
  private migrationsPath: string;

  constructor(db: Database.Database, migrationsPath: string) {
    this.db = db;
    this.migrationsPath = migrationsPath;
  }

  public async initialize(): Promise<void> {
    // 创建迁移记录表
    this.createMigrationsTable();

    // 执行所有待执行的迁移
    await this.runPendingMigrations();
  }

  private createMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private getExecutedMigrations(): string[] {
    const stmt = this.db.prepare('SELECT name FROM migrations');
    const rows = stmt.all() as MigrationRecord[];
    return rows.map(row => row.name);
  }

  private async runPendingMigrations(): Promise<void> {
    console.log('[MigrationManager] 检查待执行的迁移...');

    // 获取已执行的迁移
    const executedMigrations = this.getExecutedMigrations();

    // 读取迁移文件
    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // 执行未执行的迁移
    for (const file of files) {
      if (!executedMigrations.includes(file)) {
        console.log(`[MigrationManager] 执行迁移: ${file}`);

        try {
          // 读取迁移文件内容
          const sql = fs.readFileSync(
            path.join(this.migrationsPath, file),
            'utf-8'
          );

          // 在事务中执行迁移
          this.executeInTransaction(() => {
            // 执行迁移SQL
            this.executeSql(sql);

            // 记录迁移执行
            this.recordMigration(file);
          });

          console.log(`[MigrationManager] 迁移完成: ${file}`);
        } catch (error) {
          console.error(`[MigrationManager] 迁移失败: ${file}`, error);
          throw error;
        }
      }
    }
  }

  private executeInTransaction(operation: () => void): void {
    const transaction = this.db.transaction(operation);
    transaction();
  }

  private executeSql(sql: string): void {
    this.db.exec(sql);
  }

  private recordMigration(name: string): void {
    const stmt = this.db.prepare('INSERT INTO migrations (name) VALUES (?)');
    stmt.run(name);
  }
} 