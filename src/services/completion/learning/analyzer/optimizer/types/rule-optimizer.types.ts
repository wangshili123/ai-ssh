import { AIAnalysisResult } from '../../ai/types/ai-analysis.types';
import { AnalysisPattern } from '../../types';

/**
 * 规则类型
 */
export interface CompletionRule {
  id: string;
  type: 'parameter' | 'context' | 'sequence';
  pattern: string;
  weight: number;
  confidence: number;
  version: number;
  metadata: RuleMetadata;
}

/**
 * 规则元数据
 */
export interface RuleMetadata {
  source: 'pattern_analysis' | 'ai_analysis';
  createdAt: string;
  updatedAt: string;
  lastApplied: string;
  performance: RulePerformance;
}

/**
 * 规则性能指标
 */
export interface RulePerformance {
  usageCount: number;
  successRate: number;
  adoptionRate: number;
  averageLatency: number;
}

/**
 * 规则更新
 */
export interface RuleUpdate {
  ruleId: string;
  changes: Partial<CompletionRule>;
  reason: string;
  confidence: number;
}

/**
 * 规则版本
 */
export interface RuleVersion {
  version: number;
  timestamp: string;
  changes: RuleUpdate[];
  status: 'active' | 'rollback' | 'deprecated';
}

/**
 * 规则优化器配置
 */
export interface RuleOptimizerConfig {
  // 权重调整阈值
  minConfidenceThreshold: number;
  maxWeightAdjustment: number;
  
  // 版本控制
  maxVersionsToKeep: number;
  
  // 性能监控
  performanceCheckInterval: number;
  minPerformanceThreshold: number;
  
  // 批处理
  batchSize: number;
  updateInterval: number;
}

/**
 * 规则优化结果
 */
export interface OptimizationResult {
  updatedRules: CompletionRule[];
  removedRules: string[];
  newRules: CompletionRule[];
  version: RuleVersion;
  performance: {
    totalRules: number;
    updatedCount: number;
    addedCount: number;
    removedCount: number;
    averageConfidence: number;
  };
} 