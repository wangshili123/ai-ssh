import { Database } from 'sqlite3';
import * as path from 'path';
import { app } from 'electron';
import { MigrationManager } from './migrations/MigrationManager';

class DatabaseService {
  private static instance: DatabaseService;
  private db: Database | null = null;
  private migrationManager: MigrationManager | null = null;
  
  private constructor() {}
  
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }
  
  public async initialize(): Promise<void> {
    if (this.db) return;
    
    try {
      console.log('[DatabaseService] 初始化数据库服务');
      const dbPath = path.join(app.getPath('userData'), 'ai-ssh.db');
      
      // 创建数据库连接
      this.db = await this.createConnection(dbPath);
      
      // 初始化迁移管理器
      const migrationsPath = path.join(__dirname, 'migrations');
      this.migrationManager = new MigrationManager(this.db, migrationsPath);
      await this.migrationManager.initialize();
      
      console.log('[DatabaseService] 数据库服务初始化完成');
    } catch (error) {
      console.error('[DatabaseService] 数据库初始化失败:', error);
      throw error;
    }
  }
  
  private createConnection(dbPath: string): Promise<Database> {
    return new Promise((resolve, reject) => {
      const db = new Database(dbPath, (err) => {
        if (err) {
          console.error('[DatabaseService] 数据库连接失败:', err);
          reject(err);
          return;
        }
        
        console.log('[DatabaseService] 数据库连接成功');
        resolve(db);
      });
    });
  }
  
  public getDatabase(): Database {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }
    return this.db;
  }
  
  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }
      
      this.db.close((err) => {
        if (err) {
          console.error('[DatabaseService] 关闭数据库失败:', err);
          reject(err);
          return;
        }
        
        console.log('[DatabaseService] 数据库已关闭');
        this.db = null;
        resolve();
      });
    });
  }
}

export const databaseService = DatabaseService.getInstance(); 