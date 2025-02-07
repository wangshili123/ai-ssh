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
  private db: any;
  private config: AnalysisConfig = {
    minFrequency: 3,
    minConfidence: 0.6,
    maxSequenceLength: 5,
    contextWindow: 3,
    batchSize: 1000
  };

  private constructor() {
    this.completionUsageModel = new CompletionUsageModel();
    this.db = DatabaseService.getInstance().getDatabase();
    this.loadAnalysisState();
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
   * 加载分析状态
   */
  private async loadAnalysisState(): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        SELECT last_processed_id, last_analysis_time, processed_count, analysis_metrics
        FROM analysis_state
        WHERE component = 'PatternAnalyzer'
      `);
      const state = stmt.get();
      
      if (state) {
        this.lastProcessedId = state.last_processed_id;
        console.log('[PatternAnalyzer] 加载分析状态:', {
          lastProcessedId: this.lastProcessedId,
          lastAnalysisTime: state.last_analysis_time,
          processedCount: state.processed_count
        });
      } else {
        // 如果没有状态记录，创建一个
        const insertStmt = this.db.prepare(`
          INSERT INTO analysis_state (
            component, last_processed_id, last_analysis_time, processed_count, analysis_metrics
          ) VALUES (?, ?, CURRENT_TIMESTAMP, 0, ?)
        `);
        insertStmt.run('PatternAnalyzer', 0, JSON.stringify({}));
      }
    } catch (error) {
      console.error('[PatternAnalyzer] 加载分析状态失败:', error);
    }
  }

  /**
   * 保存分析状态
   */
  private async saveAnalysisState(result: AnalysisResult): Promise<void> {
    try {
      const stmt = this.db.prepare(`
        UPDATE analysis_state
        SET last_processed_id = ?,
            last_analysis_time = CURRENT_TIMESTAMP,
            processed_count = processed_count + ?,
            analysis_metrics = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE component = 'PatternAnalyzer'
      `);

      stmt.run(
        this.lastProcessedId,
        result.patterns.length,
        JSON.stringify(result.metrics)
      );

      console.log('[PatternAnalyzer] 保存分析状态:', {
        lastProcessedId: this.lastProcessedId,
        processedCount: result.patterns.length,
        metrics: result.metrics
      });
    } catch (error) {
      console.error('[PatternAnalyzer] 保存分析状态失败:', error);
    }
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
      console.log('[PatternAnalyzer] Fetched completion data:', {
        count: newData.length,
        lastProcessedId: this.lastProcessedId,
        samples: newData.slice(0, 3) // 只显示前3条数据
      });

      if (newData.length === 0) {
        console.log('[PatternAnalyzer] No new data to analyze');
        return null;
      }

      // 1. 数据预处理
      const processedData = await DataPreprocessor.preprocess(newData, this.config);
      console.log('[PatternAnalyzer] Preprocessed data:', {
        uniqueCommands: processedData.uniqueCommands.size,
        parameterPatterns: processedData.parameterPatterns.length,
        contextPatterns: processedData.contextPatterns.length,
        sequencePatterns: processedData.sequencePatterns.length
      });

      // 2. 模式识别和指标计算
      const patterns = await this.identifyPatterns(processedData);
      console.log('[PatternAnalyzer] Identified patterns:', {
        count: patterns.length,
        samples: patterns.slice(0, 3)
      });

      // 3. 生成优化建议
      const suggestions = await this.generateSuggestions(patterns);
      console.log('[PatternAnalyzer] Generated suggestions:', {
        count: suggestions.length,
        samples: suggestions.slice(0, 3)
      });

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

      // 更新最后处理的ID
      this.lastProcessedId = newData[newData.length - 1].id!;
      
      // 保存分析状态
      await this.saveAnalysisState(result);

      console.log('[PatternAnalyzer] Analysis completed successfully:', {
        metrics: result.metrics
      });
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