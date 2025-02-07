import { DatabaseService } from '../../../database/DatabaseService';
import { CompletionUsage, CommandPattern, OptimizationSuggestion, AnalysisResult } from '../types';
import { AnalysisConfig } from './types';
import { DataPreprocessor } from './preprocessor/DataPreprocessor';
import { MetricsCalculator } from './metrics/MetricsCalculator';
import { CompletionUsageModel } from '../../../database/models/CompletionUsage';

/**
 * 命令模式分析器
 * 负责分析用户命令使用模式并生成优化建议
 */
export class PatternAnalyzer {
  private static instance: PatternAnalyzer;
  private isProcessing: boolean = false;
  private lastProcessedId: number = 0;
  private completionUsageModel: CompletionUsageModel;
  private config: AnalysisConfig = {
    minFrequency: 3,
    minConfidence: 0.6,
    maxSequenceLength: 5,
    contextWindow: 3,
    batchSize: 1000
  };

  private constructor() {
    this.completionUsageModel = new CompletionUsageModel();
  }

  /**
   * 获取分析器实例
   */
  public static getInstance(): PatternAnalyzer {
    if (!PatternAnalyzer.instance) {
      PatternAnalyzer.instance = new PatternAnalyzer();
    }
    return PatternAnalyzer.instance;
  }

  /**
   * 执行模式分析
   */
  public async analyze(): Promise<AnalysisResult | null> {
    if (this.isProcessing) {
      console.log('[PatternAnalyzer] Analysis already in progress');
      return null;
    }

    try {
      this.isProcessing = true;
      console.log('[PatternAnalyzer] Starting pattern analysis');

      // 获取新的补全使用数据
      const newData = await this.fetchNewCompletionData();
      if (newData.length === 0) {
        console.log('[PatternAnalyzer] No new data to analyze');
        return null;
      }

      // 1. 数据预处理
      const processedData = await DataPreprocessor.preprocess(newData, this.config);

      // 2. 模式识别和指标计算
      const patterns = await this.identifyPatterns(processedData);

      // 3. 生成优化建议
      const suggestions = await this.generateSuggestions(patterns);

      // 4. 生成分析结果
      const result: AnalysisResult = {
        patterns,
        suggestions,
        timestamp: new Date().toISOString(),
        metrics: {
          totalCommands: newData.length,
          uniquePatterns: patterns.length,
          averageConfidence: MetricsCalculator.calculateAverageConfidence(patterns),
          averageSuccessRate: MetricsCalculator.calculateAverageMetric(patterns, 'successRate'),
          averageExecutionTime: MetricsCalculator.calculateAverageMetric(patterns, 'avgExecutionTime')
        }
      };

      this.lastProcessedId = newData[newData.length - 1].id!;
      console.log('[PatternAnalyzer] Analysis completed successfully');
      return result;

    } catch (error) {
      console.error('[PatternAnalyzer] Analysis failed:', error);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 获取新的补全使用数据
   */
  private async fetchNewCompletionData(): Promise<CompletionUsage[]> {
    try {
      const dbData = await this.completionUsageModel.findAfterLastProcessedId(
        this.lastProcessedId,
        this.config.batchSize
      );

      // 转换数据类型
      return dbData.map(item => ({
        id: item.id || 0,  // 确保 id 不为 undefined
        input: item.input,
        suggestion: item.suggestion,
        is_selected: item.is_selected ? 1 : 0,  // 转换为数字类型
        timestamp: item.created_at || new Date().toISOString(),
        context: item.context,
        success: true,  // 默认为 true
        execution_time: 0  // 默认为 0
      }));
    } catch (error) {
      console.error('[PatternAnalyzer] Failed to fetch completion data:', error);
      throw error;
    }
  }

  /**
   * 从处理后的数据中识别模式
   */
  private async identifyPatterns(data: any): Promise<CommandPattern[]> {
    const patterns: CommandPattern[] = [];

    // 从参数模式生成命令模式
    for (const paramPattern of data.parameterPatterns) {
      if (paramPattern.frequency >= this.config.minFrequency) {
        const confidence = MetricsCalculator.calculateConfidence(
          paramPattern.frequency,
          data.totalSamples
        );

        if (confidence >= this.config.minConfidence) {
          patterns.push({
            pattern: `${paramPattern.command} ${paramPattern.parameter}`,
            frequency: paramPattern.frequency,
            context: 'parameter',
            confidence,
            avgExecutionTime: 0,
            successRate: 1.0,
            lastUsed: new Date().toISOString()
          });
        }
      }
    }

    // 从序列模式生成命令模式
    for (const seqPattern of data.sequencePatterns) {
      if (seqPattern.frequency >= this.config.minFrequency) {
        patterns.push({
          pattern: seqPattern.commands.join(' && '),
          frequency: seqPattern.frequency,
          context: 'sequence',
          confidence: seqPattern.successRate,
          avgExecutionTime: seqPattern.timeGap,
          successRate: seqPattern.successRate,
          lastUsed: new Date().toISOString()
        });
      }
    }

    // 从上下文模式生成命令模式
    for (const ctxPattern of data.contextPatterns) {
      if (ctxPattern.frequency >= this.config.minFrequency) {
        patterns.push({
          pattern: ctxPattern.command,
          frequency: ctxPattern.frequency,
          context: ctxPattern.context,
          confidence: ctxPattern.correlation,
          avgExecutionTime: 0,
          successRate: 1.0,
          lastUsed: new Date().toISOString()
        });
      }
    }

    return patterns;
  }

  /**
   * 生成优化建议
   */
  private async generateSuggestions(patterns: CommandPattern[]): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];

    for (const pattern of patterns) {
      const impact = MetricsCalculator.calculatePatternImpact(pattern);
      const difficulty = MetricsCalculator.calculateImplementationDifficulty(pattern);
      const priority = MetricsCalculator.calculateSuggestionPriority(impact, difficulty);

      if (impact > 0.5) { // 只为高影响力的模式生成建议
        suggestions.push({
          pattern,
          suggestion: `Consider using "${pattern.pattern}" for better efficiency`,
          impact,
          reasoning: `This pattern has a high success rate and is frequently used`,
          category: 'efficiency',
          priority,
          implementationDifficulty: difficulty
        });
      }
    }

    // 按优先级排序
    return suggestions.sort((a, b) => b.priority! - a.priority!);
  }
} 