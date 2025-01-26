import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { ipcRenderer } from 'electron';

/**
 * 数据库服务
 * 负责管理SQLite数据库连接和基础操作
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database.Database | null = null;
  private readonly dbPath: string;
  private readonly dbDir: string;
  private initialized = false;

  private constructor() {
    try {
      console.log('DatabaseService constructor called');
      // 从主进程获取用户数据目录
      console.log('Getting user data path from main process...');
      const userDataPath = ipcRenderer.sendSync('get-user-data-path');
      console.log('Received user data path:', userDataPath);
      
      this.dbDir = path.join(userDataPath, 'db');
      this.dbPath = path.join(this.dbDir, 'command-history.db');
      console.log('Database paths initialized:', { dbDir: this.dbDir, dbPath: this.dbPath });
    } catch (error) {
      console.error('Error in DatabaseService constructor:', error);
      throw error;
    }
  }

  /**
   * 获取数据库服务单例
   */
  public static getInstance(): DatabaseService {
    console.log('DatabaseService.getInstance called');
    if (!DatabaseService.instance) {
      console.log('Creating new DatabaseService instance');
      DatabaseService.instance = new DatabaseService();
      console.log('DatabaseService instance created');
    }
    return DatabaseService.instance;
  }

  /**
   * 初始化数据库
   * 创建必要的表和索引
   */
  public async init(): Promise<void> {
    console.log('DatabaseService.init called');
    
    try {
      // 确保数据库目录存在
      if (!fs.existsSync(this.dbDir)) {
        console.log('Creating database directory:', this.dbDir);
        fs.mkdirSync(this.dbDir, { recursive: true });
      }

      console.log('Opening database at:', this.dbPath);
      this.db = new Database(this.dbPath);
      console.log('Database opened successfully');

      if (!this.db) {
        throw new Error('Failed to create database instance');
      }

      // 创建命令历史表
      console.log('Creating command_history table');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS command_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          command TEXT UNIQUE NOT NULL,
          context TEXT,
          frequency INTEGER DEFAULT 1,
          last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
          success INTEGER DEFAULT 1
        )
      `);
      console.log('command_history table created successfully');

      // 创建命令关系表
      console.log('Creating command_relation table');
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS command_relation (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          command1_id INTEGER NOT NULL,
          command2_id INTEGER NOT NULL,
          relation_type TEXT NOT NULL,
          frequency INTEGER DEFAULT 1,
          FOREIGN KEY (command1_id) REFERENCES command_history(id),
          FOREIGN KEY (command2_id) REFERENCES command_history(id),
          UNIQUE(command1_id, command2_id, relation_type)
        )
      `);
      console.log('command_relation table created successfully');

      this.initialized = true;
      console.log('Database initialization completed successfully');
    } catch (error) {
      console.error('Error in database initialization:', error);
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
    }
  }
} 