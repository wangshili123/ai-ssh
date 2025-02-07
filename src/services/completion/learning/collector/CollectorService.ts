import { DatabaseService } from '../../../database/DatabaseService';
import { CommandUsageCollector } from './CommandUsageCollector';
import { CompletionUsageCollector } from './CompletionUsageCollector';
import { CommandUsageData, CompletionUsageData } from './types';
import { DataCleaner } from './DataCleaner';
import { CollectorMonitor } from './CollectorMonitor';

interface CollectorConfig {
  batchThreshold: number;      // 批处理阈值
  flushInterval: number;       // 刷新间隔（毫秒）
  maxBatchSize: number;        // 最大批量大小
  retryAttempts: number;       // 重试次数
  retryDelay: number;         // 重试延迟（毫秒）
  monitorInterval: number;    // 监控间隔（毫秒）
  cleanupInterval: number;    // 清理间隔（毫秒）
}

/**
 * 收集器管理服务
 * 负责管理和协调所有数据收集器
 */
export class CollectorService {
  private static instance: CollectorService;
  private commandCollector: CommandUsageCollector | null = null;
  private completionCollector: CompletionUsageCollector | null = null;
  private dataCleaner: DataCleaner | null = null;
  private monitor: CollectorMonitor | null = null;
  private initialized = false;
  private db: any;

  // 批处理队列
  private commandQueue: CommandUsageData[] = [];
  private completionQueue: CompletionUsageData[] = [];
  private flushTimer: NodeJS.Timeout | null = null;

  // 配置参数
  private config: CollectorConfig = {
    batchThreshold: 50,        // 50条数据触发批处理
    flushInterval: 60 * 1000,  // 1分钟刷新一次
    maxBatchSize: 100,         // 最大批量大小
    retryAttempts: 3,          // 最多重试3次
    retryDelay: 1000,         // 1秒后重试
    monitorInterval: 5 * 60 * 1000,  // 5分钟监控间隔
    cleanupInterval: 24 * 60 * 60 * 1000  // 24小时清理间隔
  };

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
      this.db = DatabaseService.getInstance().getDatabase();
      if (!this.db) {
        throw new Error('数据库未初始化');
      }

      // 初始化收集器
      this.commandCollector = new CommandUsageCollector(this.db, {
        batchSize: this.config.maxBatchSize,
        flushInterval: this.config.flushInterval
      });

      this.completionCollector = new CompletionUsageCollector(this.db, {
        batchSize: this.config.maxBatchSize,
        flushInterval: this.config.flushInterval
      });

      // 初始化数据清理器
      this.dataCleaner = new DataCleaner(this.db, {
        cleanupInterval: this.config.cleanupInterval
      });

      // 初始化监控器
      this.monitor = new CollectorMonitor({
        metricsInterval: this.config.monitorInterval
      });

      // 启动服务
      this.startServices();

      this.initialized = true;
      console.log('[CollectorService] 收集器服务初始化成功');
    } catch (error) {
      console.error('[CollectorService] 收集器服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 启动所有服务
   */
  private startServices(): void {
    // 启动定期刷新
    this.startFlushTimer();

    // 启动数据清理
    this.dataCleaner?.start();

    // 启动监控
    this.monitor?.start();

    console.log('[CollectorService] 所有服务已启动');
  }

  /**
   * 收集命令使用数据
   */
  public async collectCommandUsage(command: string, success: boolean): Promise<void> {
    if (!this.initialized) {
      console.warn('[CollectorService] 命令使用收集器未初始化');
      return;
    }

    const startTime = Date.now();

    try {
      // 添加到批处理队列
      this.commandQueue.push({
        command,
        success,
        context: undefined
      });

      // 检查是否需要执行批处理
      if (this.commandQueue.length >= this.config.batchThreshold) {
        await this.flushCommandQueue();
      }

      // 记录成功
      this.monitor?.recordSuccess(Date.now() - startTime);
    } catch (error) {
      console.error('[CollectorService] 收集命令使用数据失败:', error);
      // 记录失败
      this.monitor?.recordFailure(error as Error);
    }
  }

  /**
   * 收集补全使用数据
   */
  public async collectCompletionUsage(
    input: string,
    suggestion: string,
    isSelected: boolean
  ): Promise<void> {
    if (!this.initialized) {
      console.warn('[CollectorService] 补全使用收集器未初始化');
      return;
    }

    const startTime = Date.now();

    try {
      // 添加到批处理队列
      this.completionQueue.push({
        input,
        suggestion,
        isSelected,
        context: undefined
      });

      // 检查是否需要执行批处理
      if (this.completionQueue.length >= this.config.batchThreshold) {
        await this.flushCompletionQueue();
      }

      // 记录成功
      this.monitor?.recordSuccess(Date.now() - startTime);
    } catch (error) {
      console.error('[CollectorService] 收集补全使用数据失败:', error);
      // 记录失败
      this.monitor?.recordFailure(error as Error);
    }
  }

  /**
   * 刷新命令使用数据队列
   */
  private async flushCommandQueue(): Promise<void> {
    if (this.commandQueue.length === 0) {
      return;
    }

    try {
      // 准备批处理数据
      const batchData = this.commandQueue.splice(0, this.config.maxBatchSize);
      console.log('[CollectorService] 正在批量处理命令使用数据:', batchData.length);

      // 执行批量插入
      await this.retryOperation(async () => {
        await this.commandCollector?.batchCollect(batchData);
      });

    } catch (error) {
      console.error('[CollectorService] 批量处理命令使用数据失败:', error);
      // 失败时将数据放回队列
      this.commandQueue.unshift(...this.commandQueue);
      throw error;
    }
  }

  /**
   * 刷新补全使用数据队列
   */
  private async flushCompletionQueue(): Promise<void> {
    if (this.completionQueue.length === 0) {
      return;
    }

    try {
      // 准备批处理数据
      const batchData = this.completionQueue.splice(0, this.config.maxBatchSize);
      console.log('[CollectorService] 正在批量处理补全使用数据:', batchData.length);

      // 执行批量插入
      await this.retryOperation(async () => {
        await this.completionCollector?.batchCollect(batchData);
      });

    } catch (error) {
      console.error('[CollectorService] 批量处理补全使用数据失败:', error);
      // 失败时将数据放回队列
      this.completionQueue.unshift(...this.completionQueue);
      throw error;
    }
  }

  /**
   * 启动定期刷新定时器
   */
  private startFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      try {
        await this.flushCommandQueue();
        await this.flushCompletionQueue();
      } catch (error) {
        console.error('[CollectorService] 定期刷新数据失败:', error);
      }
    }, this.config.flushInterval);
  }

  /**
   * 重试操作
   */
  private async retryOperation(operation: () => Promise<void>): Promise<void> {
    let attempts = 0;
    while (attempts < this.config.retryAttempts) {
      try {
        await operation();
        return;
      } catch (error) {
        attempts++;
        if (attempts === this.config.retryAttempts) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * Math.pow(2, attempts)));
      }
    }
  }

  /**
   * 获取监控指标
   */
  public getMetrics() {
    return this.monitor?.getMetrics();
  }

  /**
   * 清理资源
   */
  public async dispose(): Promise<void> {
    try {
      // 刷新剩余数据
      await this.flushCommandQueue();
      await this.flushCompletionQueue();

      // 清理定时器
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
        this.flushTimer = null;
      }

      // 停止数据清理器
      this.dataCleaner?.stop();

      // 停止监控器
      this.monitor?.stop();

      // 清理收集器
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