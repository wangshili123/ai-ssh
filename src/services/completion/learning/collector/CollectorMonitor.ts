import { CollectorMetrics } from './types';

interface MonitorConfig {
  metricsInterval: number;    // 指标收集间隔（毫秒）
  errorThreshold: number;     // 错误阈值
  performanceThreshold: number; // 性能阈值（毫秒）
  maxErrorTypes: number;      // 最大错误类型数
}

/**
 * 收集器监控器
 * 负责收集和报告性能指标
 */
export class CollectorMonitor {
  private metrics: CollectorMetrics;
  private config: MonitorConfig;
  private metricsTimer: NodeJS.Timeout | null = null;
  private startTime: number;

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      metricsInterval: 5 * 60 * 1000,  // 5分钟
      errorThreshold: 0.1,             // 10%错误率阈值
      performanceThreshold: 1000,      // 1秒性能阈值
      maxErrorTypes: 20,               // 最多记录20种错误类型
      ...config
    };

    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
  }

  /**
   * 初始化指标
   */
  private initializeMetrics(): CollectorMetrics {
    return {
      totalCollected: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: 0,
      lastCollectionTime: new Date(),
      errorTypes: {}
    };
  }

  /**
   * 启动监控
   */
  public start(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    this.metricsTimer = setInterval(() => {
      this.reportMetrics();
    }, this.config.metricsInterval);

    console.log('[CollectorMonitor] 监控已启动');
  }

  /**
   * 停止监控
   */
  public stop(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    console.log('[CollectorMonitor] 监控已停止');
  }

  /**
   * 记录成功收集
   */
  public recordSuccess(executionTime: number): void {
    this.metrics.totalCollected++;
    this.metrics.successCount++;
    this.metrics.lastCollectionTime = new Date();
    
    // 更新平均执行时间
    this.metrics.averageExecutionTime = (
      this.metrics.averageExecutionTime * (this.metrics.totalCollected - 1) +
      executionTime
    ) / this.metrics.totalCollected;

    // 检查性能问题
    if (executionTime > this.config.performanceThreshold) {
      console.warn('[CollectorMonitor] 性能警告: 执行时间超过阈值', {
        executionTime,
        threshold: this.config.performanceThreshold
      });
    }
  }

  /**
   * 记录收集失败
   */
  public recordFailure(error: Error): void {
    this.metrics.totalCollected++;
    this.metrics.failureCount++;
    this.metrics.lastCollectionTime = new Date();

    // 记录错误类型
    const errorType = error.name || 'UnknownError';
    this.metrics.errorTypes[errorType] = (this.metrics.errorTypes[errorType] || 0) + 1;

    // 清理过多的错误类型
    const errorTypes = Object.entries(this.metrics.errorTypes);
    if (errorTypes.length > this.config.maxErrorTypes) {
      // 按出现次数排序，保留出现次数最多的错误类型
      errorTypes.sort((a, b) => b[1] - a[1]);
      this.metrics.errorTypes = Object.fromEntries(
        errorTypes.slice(0, this.config.maxErrorTypes)
      );
    }

    // 检查错误率
    const errorRate = this.metrics.failureCount / this.metrics.totalCollected;
    if (errorRate > this.config.errorThreshold) {
      console.error('[CollectorMonitor] 错误率警告:', {
        errorRate,
        threshold: this.config.errorThreshold,
        totalErrors: this.metrics.failureCount,
        errorTypes: this.metrics.errorTypes
      });
    }
  }

  /**
   * 报告指标
   */
  private reportMetrics(): void {
    const uptime = Date.now() - this.startTime;
    const errorRate = this.metrics.failureCount / this.metrics.totalCollected;
    const successRate = this.metrics.successCount / this.metrics.totalCollected;
    const collectionsPerMinute = this.metrics.totalCollected / (uptime / 60000);

    console.log('[CollectorMonitor] 性能指标报告:', {
      uptime: this.formatDuration(uptime),
      totalCollected: this.metrics.totalCollected,
      successRate: (successRate * 100).toFixed(2) + '%',
      errorRate: (errorRate * 100).toFixed(2) + '%',
      averageExecutionTime: this.metrics.averageExecutionTime.toFixed(2) + 'ms',
      collectionsPerMinute: collectionsPerMinute.toFixed(2),
      lastCollection: this.metrics.lastCollectionTime,
      errorTypes: this.metrics.errorTypes
    });

    // 检查健康状态
    this.checkHealth({
      errorRate,
      successRate,
      collectionsPerMinute
    });
  }

  /**
   * 检查系统健康状态
   */
  private checkHealth(stats: {
    errorRate: number;
    successRate: number;
    collectionsPerMinute: number;
  }): void {
    const issues: string[] = [];

    if (stats.errorRate > this.config.errorThreshold) {
      issues.push(`错误率(${(stats.errorRate * 100).toFixed(2)}%)超过阈值(${(this.config.errorThreshold * 100).toFixed(2)}%)`);
    }

    if (stats.successRate < 0.9) {  // 成功率低于90%
      issues.push(`成功率(${(stats.successRate * 100).toFixed(2)}%)过低`);
    }

    if (stats.collectionsPerMinute < 1) {  // 每分钟收集少于1次
      issues.push(`收集频率(${stats.collectionsPerMinute.toFixed(2)}/分钟)过低`);
    }

    if (issues.length > 0) {
      console.warn('[CollectorMonitor] 系统健康警告:', {
        issues,
        metrics: this.metrics
      });
    }
  }

  /**
   * 格式化持续时间
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    return `${days}天${hours % 24}小时${minutes % 60}分${seconds % 60}秒`;
  }

  /**
   * 获取当前指标
   */
  public getMetrics(): CollectorMetrics {
    return { ...this.metrics };
  }

  /**
   * 重置指标
   */
  public resetMetrics(): void {
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();
    console.log('[CollectorMonitor] 指标已重置');
  }
} 