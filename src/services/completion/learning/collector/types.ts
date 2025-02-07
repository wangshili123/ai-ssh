/**
 * 数据收集器接口
 */
export interface Collector {
  collect(data: any): Promise<void>;
}

/**
 * 收集器配置选项
 */
export interface CollectorOptions {
  batchSize: number;
  flushInterval: number;  // 单位: 毫秒
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * 命令使用数据接口
 */
export interface CommandUsageData {
  command: string;
  success: boolean;
  timestamp: Date;
  context?: string;
  executionTime?: number;
  errorType?: string;
}

/**
 * 补全使用数据接口
 */
export interface CompletionUsageData {
  input: string;
  suggestion: string;
  isSelected: boolean;
  timestamp: Date;
  context?: string;
  executionTime?: number;
  errorType?: string;
}

/**
 * 收集器统计指标
 */
export interface CollectorMetrics {
  totalCollected: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
  lastCollectionTime: Date;
  errorTypes: Record<string, number>;
} 
