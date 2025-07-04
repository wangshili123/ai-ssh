/**
 * 补全使用记录
 */
export interface CompletionUsage {
  id: number;
  input: string;
  suggestion: string;
  is_selected: number;
  timestamp: string;
  execution_time?: number;    // 执行时间（毫秒）
  success?: boolean;          // 执行是否成功
  error_type?: string;        // 错误类型（如果失败）
  context?: string;           // 执行上下文
}

/**
 * 命令模式
 */
export interface CommandPattern {
  id?: number;           // 数据库ID
  pattern: string;
  frequency: number;
  context: string;
  confidence: number;
  avgExecutionTime?: number;  // 平均执行时间
  successRate?: number;       // 成功率
  lastUsed?: string;         // 最后使用时间
}

/**
 * 优化建议
 */
export interface OptimizationSuggestion {
  pattern: CommandPattern;
  suggestion: string;
  impact: number;
  reasoning: string;
  category?: string;         // 建议类别
  priority?: number;         // 优先级
  implementationDifficulty?: number;  // 实现难度
}

/**
 * 分析结果
 */
export interface AnalysisResult {
  patterns: CommandPattern[];
  suggestions: OptimizationSuggestion[];
  timestamp: string;
  metrics: {
    totalCommands: number;
    uniquePatterns: number;
    averageConfidence: number;
    averageSuccessRate: number;    // 平均成功率
    averageExecutionTime: number;  // 平均执行时间
  };
}

/**
 * 补全规则类型
 */
export interface CompletionRule {
  id: string;
  type: 'parameter' | 'context' | 'sequence';
  pattern: string;
  weight: number;
  confidence: number;
  version: number;
  metadata: {
    description?: string;
    examples?: string[];
    performance?: {
      usageCount: number;
      successRate: number;
      adoptionRate: number;
      averageLatency: number;
    };
    [key: string]: any;
  };
}

/**
 * 规则更新类型
 */
export interface RuleUpdate {
  ruleId: string;
  changes: Partial<CompletionRule>;
} 