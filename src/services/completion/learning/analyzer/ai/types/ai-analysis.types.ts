import { ParameterPattern, ContextPattern, SequencePattern } from '../../types';

/**
 * AI 分析输入数据接口
 */
export interface AIAnalysisInput {
  // PatternAnalyzer 的基础分析结果
  baseAnalysis: {
    patterns: Array<ParameterPattern | ContextPattern | SequencePattern>;
    metrics: AnalysisMetrics;
    timestamp: string;
  };
  
  // 环境上下文信息
  context: {
    environmentState: EnvironmentState;
    userPreferences: UserPreferences;
    historicalData: HistoricalData;
  };
}

/**
 * 分析指标接口
 */
export interface AnalysisMetrics {
  totalCommands: number;
  uniquePatterns: number;
  averageConfidence: number;
  averageSuccessRate: number;
  averageExecutionTime: number;
}

/**
 * 环境状态接口
 */
export interface EnvironmentState {
  currentDirectory: string;
  shellType: string;
  osType: string;
  lastCommand?: string;
  lastOutput?: string;
}

/**
 * 用户偏好接口
 */
export interface UserPreferences {
  favoriteCommands: string[];
  commandAliases: Record<string, string>;
  customPrompts: string[];
  riskTolerance: 'low' | 'medium' | 'high';
}

/**
 * 历史数据接口
 */
export interface HistoricalData {
  recentCommands: Array<{
    command: string;
    timestamp: string;
    success: boolean;
  }>;
  commandFrequency: Record<string, number>;
  errorPatterns: Array<{
    pattern: string;
    frequency: number;
  }>;
}

/**
 * 模式洞察接口
 */
export interface PatternInsight {
  pattern: ParameterPattern | ContextPattern | SequencePattern;
  confidence: number;
  impact: number;
  relatedPatterns: string[];
  usageContext: string[];
  recommendations: string[];
}

/**
 * 模式关联接口
 */
export interface PatternCorrelation {
  sourcePattern: string;
  targetPattern: string;
  correlationType: 'sequence' | 'alternative' | 'dependency';
  strength: number;
  evidence: string[];
}

/**
 * 模式异常接口
 */
export interface PatternAnomaly {
  pattern: string;
  anomalyType: 'frequency' | 'usage' | 'error' | 'performance';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestedActions: string[];
}

/**
 * 优化建议接口
 */
export interface OptimizationSuggestion {
  type: 'immediate' | 'longTerm';
  target: string;
  suggestion: string;
  impact: number;
  effort: number;
  priority: number;
  implementation: string;
  risks: string[];
}

/**
 * AI 分析结果接口
 */
export interface AIAnalysisResult {
  // 深度分析结果
  insights: {
    patternInsights: PatternInsight[];
    correlations: PatternCorrelation[];
    anomalies: PatternAnomaly[];
  };
  
  // 优化建议
  suggestions: {
    immediate: OptimizationSuggestion[];
    longTerm: OptimizationSuggestion[];
  };
  
  // 元数据
  metadata: {
    confidence: number;
    processingTime: number;
    modelVersion: string;
    timestamp: string;
  };
}

/**
 * 分析错误接口
 */
export interface AIAnalysisError {
  code: string;
  message: string;
  context?: any;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * 缓存配置接口
 */
export interface CacheConfig {
  maxSize: number;
  expiration: number;
  cleanupInterval: number;
}

/**
 * 缓存条目接口
 */
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * AI 分析配置接口
 */
export interface AIAnalysisConfig {
  maxBatchSize: number;
  minConfidenceThreshold: number;
  maxRetries: number;
  analysisTimeout: number;
  cacheConfig: CacheConfig;
} 