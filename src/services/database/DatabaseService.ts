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
    try {
      console.log('[DatabaseService] 开始初始化数据库...');
      const dbPath = await this.getDatabasePath();
      console.log('[DatabaseService] 数据库路径:', dbPath);
      
      // 确保数据库目录存在
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      
      // 使用 better-sqlite3 初始化数据库
      this.db = new Database(dbPath, { verbose: console.log });
      
      // 创建必要的数据表
      await this.createTables();
      
      this.initialized = true;
      console.log('[DatabaseService] 数据库初始化完成');
    } catch (error) {
      console.error('[DatabaseService] 数据库初始化失败:', error);
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

  private async createTables(): Promise<void> {
    console.log('[DatabaseService] 开始创建数据表...');
    try {
      if (!this.db) {
        throw new Error('数据库未初始化');
      }
      
      await this.db.exec(`
        -- 命令历史表
        CREATE TABLE IF NOT EXISTS command_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          command TEXT NOT NULL,
          context TEXT,
          frequency INTEGER DEFAULT 1,
          last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
          success BOOLEAN DEFAULT 1,
          outputs TEXT
        );

        -- 命令关系表
        CREATE TABLE IF NOT EXISTS command_relations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          prev_command_id INTEGER NOT NULL,
          next_command_id INTEGER NOT NULL,
          relation_type TEXT NOT NULL,
          frequency INTEGER DEFAULT 1,
          last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (prev_command_id) REFERENCES command_history(id),
          FOREIGN KEY (next_command_id) REFERENCES command_history(id)
        );

        -- 命令历史索引
        CREATE INDEX IF NOT EXISTS idx_command_history_command ON command_history(command);
        CREATE INDEX IF NOT EXISTS idx_command_history_last_used ON command_history(last_used);
        CREATE INDEX IF NOT EXISTS idx_command_history_frequency ON command_history(frequency);

        -- 命令关系索引
        CREATE INDEX IF NOT EXISTS idx_command_relations_prev ON command_relations(prev_command_id);
        CREATE INDEX IF NOT EXISTS idx_command_relations_next ON command_relations(next_command_id);
        CREATE INDEX IF NOT EXISTS idx_command_relations_type ON command_relations(relation_type);
      `);
      console.log('[DatabaseService] 数据表创建完成');
    } catch (error) {
      console.error('[DatabaseService] 创建数据表失败:', error);
      throw error;
    }
  }
} 