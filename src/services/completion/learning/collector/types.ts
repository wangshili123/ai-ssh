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
  batchSize?: number;      // 批量处理大小
  flushInterval?: number;  // 自动刷新间隔（毫秒）
}

/**
 * 命令使用数据接口
 */
export interface CommandUsageData {
  command: string;         // 执行的命令
  context?: string;        // 执行上下文
  success: boolean;        // 是否执行成功
}

/**
 * 补全使用数据接口
 */
export interface CompletionUsageData {
  input: string;          // 用户输入前缀
  suggestion: string;     // 补全建议
  isSelected: boolean;    // 是否被选中
  context?: string;       // 补全上下文
} 
