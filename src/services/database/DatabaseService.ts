import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { ipcRenderer } from 'electron';
import * as migration001 from '../../services/database/migrations/001_initial_schema';
import * as migration002 from '../../services/database/migrations/002_add_outputs_column';

/**
 * 数据库服务
 * 负责管理SQLite数据库连接和基础操作
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database.Database | null = null;
  private initialized: boolean = false;

  private migrations = {
    migration001: {
      up: migration001.up,
      down: migration001.down
    },
    migration002: {
      up: migration002.up,
      down: migration002.down
    }
  };

  private constructor() {}

  /**
   * 获取数据库服务单例
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * 初始化数据库
   * 创建必要的表和索引
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 获取数据库路径
      const dbPath = this.getDatabasePath();
      
      // 确保数据库目录存在
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // 连接数据库
      this.db = new Database(dbPath);
      
      // 运行迁移
      await this.runMigrations();

      this.initialized = true;
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private getDatabasePath(): string {
    try {
      const userDataPath = ipcRenderer.sendSync('get-user-data-path');
      return path.join(userDataPath, 'ai-ssh.db');
    } catch (error) {
      console.error('Failed to get database path:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      // 创建迁移表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 获取已执行的迁移
      const executedMigrations = this.db.prepare('SELECT name FROM migrations').all() as { name: string }[];
      const executedNames = new Set(executedMigrations.map(m => m.name));

      // 迁移文件名映射
      const migrationNames = {
        migration001: '001_initial_schema',
        migration002: '002_add_outputs_column'
      };

      // 执行未运行的迁移
      for (const [key, migration] of Object.entries(this.migrations)) {
        const migrationName = migrationNames[key as keyof typeof migrationNames];
        if (!executedNames.has(migrationName)) {
          console.log(`Running migration: ${migrationName}`);
          
          // 开始事务
          this.db.exec('BEGIN TRANSACTION;');
          
          try {
            // 执行迁移
            await migration.up(this.db);
            
            // 记录迁移
            this.db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migrationName);
            
            // 提交事务
            this.db.exec('COMMIT;');
            console.log(`Migration completed: ${migrationName}`);
          } catch (error) {
            // 回滚事务
            this.db.exec('ROLLBACK;');
            console.error(`Migration failed: ${migrationName}`, error);
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Failed to run migrations:', error);
      throw error;
    }
  }

  /**
   * 获取数据库实例
   */
  public getDatabase(): Database.Database {
    if (!this.db || !this.initialized) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  /**
   * 关闭数据库连接
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
} 