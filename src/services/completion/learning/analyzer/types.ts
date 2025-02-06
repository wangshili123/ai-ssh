/**
 * 命令参数模式
 * 用于表示命令及其参数的使用模式
 */
export interface ParameterPattern {
  command: string;          // 基础命令
  parameter: string;        // 参数部分
  frequency: number;        // 出现频率
  confidence: number;       // 置信度
}

/**
 * 命令上下文模式
 * 用于表示命令在特定上下文中的使用模式
 */
export interface ContextPattern {
  command: string;          // 命令
  context: string;          // 上下文
  frequency: number;        // 出现频率
  confidence: number;       // 置信度
}

/**
 * 命令序列模式
 * 用于表示连续执行的命令序列
 */
export interface SequencePattern {
  commands: string[];       // 命令序列
  frequency: number;        // 出现频率
  confidence: number;       // 置信度
}

/**
 * 预处理后的数据
 * 包含各种统计信息和识别出的模式
 */
export interface ProcessedData {
  uniqueCommands: Set<string>;                  // 唯一命令集合
  commandFrequency: Map<string, number>;        // 命令频率映射
  parameterPatterns: ParameterPattern[];        // 参数模式列表
  contextPatterns: ContextPattern[];            // 上下文模式列表
  sequencePatterns: SequencePattern[];          // 序列模式列表
  totalSamples: number;                         // 总样本数
  totalUniqueCommands: number;                  // 唯一命令数
  averageFrequency: number;                     // 平均频率
}

/**
 * 分析上下文
 * 包含分析过程中需要的上下文信息
 */
export interface AnalysisContext {
  timeRange: {
    start: Date;           // 分析开始时间
    end: Date;             // 分析结束时间
  };
  totalSamples: number;    // 总样本数
  uniqueUsers: number;     // 唯一用户数
}

/**
 * 分析配置
 * 用于配置分析过程的各种参数
 */
export interface AnalysisConfig {
  minFrequency: number;        // 最小频率阈值
  minConfidence: number;       // 最小置信度阈值
  maxSequenceLength: number;   // 最大序列长度
  contextWindow: number;       // 上下文窗口大小
  batchSize: number;          // 批处理大小
}

/**
 * 模式分析结果
 */
export interface PatternAnalysisResult {
  parameterPatterns: ParameterPattern[];
  contextPatterns: ContextPattern[];
  sequencePatterns: SequencePattern[];
  metrics: {
    totalCommands: number;
    uniqueCommands: number;
    averageConfidence: number;
    averageFrequency: number;
  };
  timestamp: string;
} 