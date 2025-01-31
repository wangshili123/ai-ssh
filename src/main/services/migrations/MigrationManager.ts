import { Database } from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationRecord {
  name: string;
  executed_at: string;
}

export class MigrationManager {
  private db: Database;
  private migrationsPath: string;

  constructor(db: Database, migrationsPath: string) {
    this.db = db;
    this.migrationsPath = migrationsPath;
  }

  public async initialize(): Promise<void> {
    // 创建迁移记录表
    await this.createMigrationsTable();
    
    // 执行所有待执行的迁移
    await this.runPendingMigrations();
  }

  private async createMigrationsTable(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async getExecutedMigrations(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      this.db.all<MigrationRecord>(
        'SELECT name FROM migrations', 
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.name));
        }
      );
    });
  }

  private async runPendingMigrations(): Promise<void> {
    console.log('[MigrationManager] 检查待执行的迁移...');
    
    // 获取已执行的迁移
    const executedMigrations = await this.getExecutedMigrations();
    
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
          await this.executeInTransaction(async () => {
            // 执行迁移SQL
            await this.executeSql(sql);
            
            // 记录迁移执行
            await this.recordMigration(file);
          });
          
          console.log(`[MigrationManager] 迁移完成: ${file}`);
        } catch (error) {
          console.error(`[MigrationManager] 迁移失败: ${file}`, error);
          throw error;
        }
      }
    }
  }

  private async executeInTransaction(operation: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run('BEGIN TRANSACTION', async (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        try {
          await operation();
          
          this.db.run('COMMIT', (err) => {
            if (err) reject(err);
            else resolve();
          });
        } catch (error) {
          this.db.run('ROLLBACK', () => {
            reject(error);
          });
        }
      });
    });
  }

  private async executeSql(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async recordMigration(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO migrations (name) VALUES (?)',
        [name],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
} 