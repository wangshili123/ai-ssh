import { DatabaseService } from '../../../database/DatabaseService';
import { CommandUsageCollector } from './CommandUsageCollector';
import { CompletionUsageCollector } from './CompletionUsageCollector';
import { CommandUsageData, CompletionUsageData } from './types';

/**
 * 收集器管理服务
 * 负责管理和协调所有数据收集器
 */
export class CollectorService {
  private static instance: CollectorService;
  private commandCollector: CommandUsageCollector | null = null;
  private completionCollector: CompletionUsageCollector | null = null;
  private initialized = false;

  private constructor() {
    // 私有构造函数
  }

  /**
   * 获取收集器服务实例
   */
  public static getInstance(): CollectorService {
    if (!CollectorService.instance) {
      CollectorService.instance = new CollectorService();
    }
    return CollectorService.instance;
  }

  /**
   * 初始化收集器服务
   */
  public async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 获取数据库实例
      const db = DatabaseService.getInstance().getDatabase();
      if (!db) {
        throw new Error('数据库未初始化');
      }

      // 初始化收集器
      this.commandCollector = new CommandUsageCollector(db, {
        batchSize: 5,
        flushInterval: 1000
      });

      this.completionCollector = new CompletionUsageCollector(db, {
        batchSize: 5,
        flushInterval: 1000
      });

      this.initialized = true;
      console.log('[CollectorService] 收集器服务初始化成功');
    } catch (error) {
      console.error('[CollectorService] 收集器服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 收集命令使用数据
   */
  public async collectCommandUsage(command: string, success: boolean): Promise<void> {
    if (!this.initialized || !this.commandCollector) {
      console.warn('[CollectorService] 命令使用收集器未初始化');
      return;
    }

    try {
      await this.commandCollector.collect({
        command,
        success,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[CollectorService] 收集命令使用数据失败:', error);
    }
  }

  /**
   * 收集补全使用数据
   */
  public async collectCompletionUsage(
    input: string,
    suggestion: string,
    selected: boolean
  ): Promise<void> {
    if (!this.initialized || !this.completionCollector) {
      console.warn('[CollectorService] 补全使用收集器未初始化');
      return;
    }

    try {
      await this.completionCollector.collect({
        input,
        suggestion,
        isSelected: selected,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('[CollectorService] 收集补全使用数据失败:', error);
    }
  }

  /**
   * 清理资源
   */
  public async dispose(): Promise<void> {
    try {
      if (this.commandCollector) {
        await this.commandCollector.dispose();
        this.commandCollector = null;
      }
      if (this.completionCollector) {
        await this.completionCollector.dispose();
        this.completionCollector = null;
      }
      this.initialized = false;
      console.log('[CollectorService] 收集器服务已释放');
    } catch (error) {
      console.error('[CollectorService] 释放收集器服务失败:', error);
    }
  }
} 