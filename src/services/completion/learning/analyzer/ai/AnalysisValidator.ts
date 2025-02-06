import { AIAnalysisResult, PatternInsight, PatternCorrelation, PatternAnomaly, OptimizationSuggestion } from './types/ai-analysis.types';

/**
 * 分析结果验证器
 * 负责验证 AI 分析结果的有效性
 */
export class AnalysisValidator {
  /**
   * 验证分析结果
   */
  public validate(result: AIAnalysisResult): boolean {
    try {
      // 1. 验证基本结构
      if (!this.validateStructure(result)) {
        console.error('[AnalysisValidator] Invalid result structure');
        return false;
      }

      // 2. 验证洞察
      if (!this.validateInsights(result.insights)) {
        console.error('[AnalysisValidator] Invalid insights');
        return false;
      }

      // 3. 验证建议
      if (!this.validateSuggestions(result.suggestions)) {
        console.error('[AnalysisValidator] Invalid suggestions');
        return false;
      }

      // 4. 验证元数据
      if (!this.validateMetadata(result.metadata)) {
        console.error('[AnalysisValidator] Invalid metadata');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[AnalysisValidator] Validation failed:', error);
      return false;
    }
  }

  /**
   * 验证基本结构
   */
  private validateStructure(result: AIAnalysisResult): boolean {
    return (
      result &&
      typeof result === 'object' &&
      'insights' in result &&
      'suggestions' in result &&
      'metadata' in result
    );
  }

  /**
   * 验证洞察
   */
  private validateInsights(insights: {
    patternInsights: PatternInsight[];
    correlations: PatternCorrelation[];
    anomalies: PatternAnomaly[];
  }): boolean {
    // 验证模式洞察
    const validPatternInsights = insights.patternInsights.every(insight => (
      insight.pattern &&
      typeof insight.confidence === 'number' &&
      insight.confidence >= 0 &&
      insight.confidence <= 1 &&
      Array.isArray(insight.relatedPatterns) &&
      Array.isArray(insight.usageContext) &&
      Array.isArray(insight.recommendations)
    ));

    // 验证关联性
    const validCorrelations = insights.correlations.every(correlation => (
      correlation.sourcePattern &&
      correlation.targetPattern &&
      ['sequence', 'alternative', 'dependency'].includes(correlation.correlationType) &&
      typeof correlation.strength === 'number' &&
      correlation.strength >= 0 &&
      correlation.strength <= 1 &&
      Array.isArray(correlation.evidence)
    ));

    // 验证异常
    const validAnomalies = insights.anomalies.every(anomaly => (
      anomaly.pattern &&
      ['frequency', 'usage', 'error', 'performance'].includes(anomaly.anomalyType) &&
      ['low', 'medium', 'high'].includes(anomaly.severity) &&
      anomaly.description &&
      Array.isArray(anomaly.suggestedActions)
    ));

    return validPatternInsights && validCorrelations && validAnomalies;
  }

  /**
   * 验证建议
   */
  private validateSuggestions(suggestions: {
    immediate: OptimizationSuggestion[];
    longTerm: OptimizationSuggestion[];
  }): boolean {
    const validateSuggestion = (suggestion: OptimizationSuggestion): boolean => (
      !!suggestion.type &&
      !!suggestion.target &&
      !!suggestion.suggestion &&
      typeof suggestion.impact === 'number' &&
      typeof suggestion.effort === 'number' &&
      typeof suggestion.priority === 'number' &&
      !!suggestion.implementation &&
      Array.isArray(suggestion.risks)
    );

    return (
      Array.isArray(suggestions.immediate) &&
      Array.isArray(suggestions.longTerm) &&
      suggestions.immediate.every(validateSuggestion) &&
      suggestions.longTerm.every(validateSuggestion)
    );
  }

  /**
   * 验证元数据
   */
  private validateMetadata(metadata: {
    confidence: number;
    processingTime: number;
    modelVersion: string;
    timestamp: string;
  }): boolean {
    return (
      typeof metadata.confidence === 'number' &&
      metadata.confidence >= 0 &&
      metadata.confidence <= 1 &&
      typeof metadata.processingTime === 'number' &&
      metadata.processingTime >= 0 &&
      metadata.modelVersion &&
      metadata.timestamp &&
      !isNaN(Date.parse(metadata.timestamp))
    );
  }
} 