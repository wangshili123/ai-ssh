import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { ipcRenderer } from 'electron';
import * as migration001 from './migrations/001_initial_schema';
import * as learningTables from './migrations/002_learning_tables';
import * as analysisTables from './migrations/003_analysis_tables';
import { CollectorService } from '../completion/learning/collector/CollectorService';
import { AnalysisScheduler } from '../completion/learning/analyzer/AnalysisScheduler';

/**
 * 数据库服务
 * 负责管理SQLite数据库连接和基础操作
 */
export class DatabaseService {
  private static instance: DatabaseService;
  private db: Database.Database | null = null;
  private initialized: boolean = false;

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
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

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
      
      // 执行迁移
      console.log('[DatabaseService] Running migrations...');
      
      // 001 - 初始架构（命令历史和关系表）
      await migration001.up(this.db);
      console.log('[DatabaseService] Initial schema migration completed');
      
      // 002 - 学习相关表（命令使用和补全使用表）
      await learningTables.up(this.db);
      console.log('[DatabaseService] Learning tables migration completed');
      
      // 003 - 分析相关表（规则和性能表）
      await analysisTables.up(this.db);
      console.log('[DatabaseService] Analysis tables migration completed');
      
      this.initialized = true;
      console.log('[DatabaseService] 数据库初始化完成');

      // 初始化收集器服务
      try {
        await CollectorService.getInstance().init();
        console.log('[DatabaseService] 收集器服务初始化完成');
      } catch (error) {
        console.error('[DatabaseService] 收集器服务初始化失败:', error);
      }

      // 启动分析调度器
      try {
        const scheduler = AnalysisScheduler.getInstance();
        scheduler.startScheduling();
        console.log('[DatabaseService] 分析调度器启动完成');
      } catch (error) {
        console.error('[DatabaseService] 分析调度器启动失败:', error);
      }
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

  public isInitialized(): boolean {
    return this.initialized;
  }
} 