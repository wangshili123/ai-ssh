import { PatternAnalyzer } from './PatternAnalyzer';
import { AIAnalyzer } from './ai/AIAnalyzer';
import { RuleOptimizer } from './optimizer/RuleOptimizer';
import { DatabaseService } from '../../../database/DatabaseService';
import { RuleCache } from '../cache/RuleCache';
import { ParameterPattern, ContextPattern, SequencePattern } from './types';
import { CommandPattern, AnalysisResult } from '../types';

/**
 * 将 CommandPattern 转换为 AI 分析所需的模式类型
 */
function convertToAIPatterns(patterns: CommandPattern[]): Array<ParameterPattern | ContextPattern | SequencePattern> {
  return patterns.map(pattern => {
    if (pattern.context === 'parameter') {
      return {
        command: pattern.pattern.split(' ')[0],
        parameter: pattern.pattern.split(' ').slice(1).join(' '),
        frequency: pattern.frequency,
        confidence: pattern.confidence,
        examples: []
      } as ParameterPattern;
    } else if (pattern.context === 'sequence') {
      return {
        commands: pattern.pattern.split(' && '),
        frequency: pattern.frequency,
        confidence: pattern.confidence,
        timeGap: pattern.avgExecutionTime || 0,
        successRate: pattern.successRate || 1
      } as SequencePattern;
    } else {
      return {
        command: pattern.pattern,
        context: pattern.context,
        frequency: pattern.frequency,
        confidence: pattern.confidence,
        correlation: pattern.confidence
      } as ContextPattern;
    }
  });
}

/**
 * 将 AnalysisResult 转换为 PatternAnalysisResult
 */
function convertToPatternAnalysisResult(result: AnalysisResult) {
  // 将模式按类型分类
  const parameterPatterns: ParameterPattern[] = [];
  const contextPatterns: ContextPattern[] = [];
  const sequencePatterns: SequencePattern[] = [];

  result.patterns.forEach(pattern => {
    const converted = convertToAIPatterns([pattern])[0];
    if ('parameter' in converted) {
      parameterPatterns.push(converted as ParameterPattern);
    } else if ('commands' in converted) {
      sequencePatterns.push(converted as SequencePattern);
    } else {
      contextPatterns.push(converted as ContextPattern);
    }
  });

  // 转换指标
  const metrics = {
    totalCommands: result.metrics.totalCommands,
    uniqueCommands: result.metrics.uniquePatterns, // 使用 uniquePatterns 作为 uniqueCommands
    averageConfidence: result.metrics.averageConfidence,
    averageFrequency: result.metrics.averageSuccessRate // 使用 averageSuccessRate 作为 averageFrequency
  };

  return {
    parameterPatterns,
    contextPatterns,
    sequencePatterns,
    metrics,
    timestamp: result.timestamp
  };
}

/**
 * 分析任务调度器
 * 负责管理和调度模式分析任务
 */
export class AnalysisScheduler {
  private static instance: AnalysisScheduler;
  private isAnalyzing: boolean = false;
  private lastAnalysisTime: Date | null = null;
  private analysisInterval: number = 1000 * 60 * 0.1; // 5分钟
  private retryCount: number = 0;
  private readonly MAX_RETRIES: number = 3;
  private schedulerTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  /**
   * 获取调度器实例
   */
  public static getInstance(): AnalysisScheduler {
    if (!AnalysisScheduler.instance) {
      AnalysisScheduler.instance = new AnalysisScheduler();
    }
    return AnalysisScheduler.instance;
  }

  /**
   * 启动调度器
   */
  public startScheduling(): void {
    console.log('[AnalysisScheduler] Starting scheduler');
    
    // 先执行一次分析
    this.scheduleAnalysis();
    
    // 设置定期执行
    this.schedulerTimer = setInterval(() => {
      this.scheduleAnalysis();
    }, this.analysisInterval);
  }

  /**
   * 停止调度器
   */
  public stopScheduling(): void {
    console.log('[AnalysisScheduler] Stopping scheduler');
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * 调度分析任务
   */
  private async scheduleAnalysis(): Promise<void> {
    if (this.isAnalyzing) {
      console.log('[AnalysisScheduler] Analysis already in progress, skipping');
      return;
    }

    try {
      this.isAnalyzing = true;
      console.log('[AnalysisScheduler] Starting analysis task');

      // 获取数据库实例
      const db = DatabaseService.getInstance().getDatabase();
      if (!db) {
        throw new Error('Database not initialized');
      }

      // 1. 执行模式分析
      const patternAnalyzer = PatternAnalyzer.getInstance();
      const patternResult = await patternAnalyzer.analyze();
      
      if (patternResult) {
        console.log('[AnalysisScheduler] Pattern analysis completed:', {
          patternsCount: patternResult.patterns.length,
          suggestionsCount: patternResult.suggestions.length,
          metrics: patternResult.metrics
        });

        // 2. 执行 AI 分析
        const aiAnalyzer = AIAnalyzer.getInstance();
        const aiResult = await aiAnalyzer.analyze({
          baseAnalysis: {
            patterns: convertToAIPatterns(patternResult.patterns),
            metrics: patternResult.metrics,
            timestamp: patternResult.timestamp
          },
          context: {
            environmentState: {
              currentDirectory: process.cwd(),
              shellType: process.platform === 'win32' ? 'powershell' : 'bash',
              osType: process.platform
            },
            userPreferences: {
              favoriteCommands: [],
              commandAliases: {},
              customPrompts: [],
              riskTolerance: 'medium'
            },
            historicalData: {
              recentCommands: [],
              commandFrequency: {},
              errorPatterns: []
            }
          }
        });

        if (aiResult) {
          console.log('[AnalysisScheduler] AI analysis completed:', {
            insightsCount: aiResult.insights.patternInsights.length,
            correlationsCount: aiResult.insights.correlations.length,
            anomaliesCount: aiResult.insights.anomalies.length
          });

          // 3. 执行规则优化
          const ruleOptimizer = RuleOptimizer.getInstance();
          const optimizationResult = await ruleOptimizer.optimizeRules(
            convertToPatternAnalysisResult(patternResult),
            aiResult
          );

          if (optimizationResult) {
            console.log('[AnalysisScheduler] Rule optimization completed:', {
              totalRules: optimizationResult.performance.totalRules,
              updatedCount: optimizationResult.performance.updatedCount,
              addedCount: optimizationResult.performance.addedCount,
              removedCount: optimizationResult.performance.removedCount
            });
          }
        }
      }

      // 更新最后分析时间
      this.lastAnalysisTime = new Date();
      this.retryCount = 0;

      console.log('[AnalysisScheduler] Analysis pipeline completed successfully');
    } catch (error) {
      console.error('[AnalysisScheduler] Analysis failed:', error);
      
      // 处理重试逻辑
      if (this.retryCount < this.MAX_RETRIES) {
        this.retryCount++;
        console.log(`[AnalysisScheduler] Retrying analysis (${this.retryCount}/${this.MAX_RETRIES})`);
        
        // 延迟重试
        setTimeout(() => {
          this.scheduleAnalysis();
        }, 5 * 60 * 1000); // 5分钟后重试
      } else {
        console.error('[AnalysisScheduler] Max retries reached, giving up');
        this.retryCount = 0;
      }
    } finally {
      this.isAnalyzing = false;
    }
  }

  /**
   * 获取上次分析时间
   */
  public getLastAnalysisTime(): Date | null {
    return this.lastAnalysisTime;
  }

  /**
   * 检查是否需要执行分析
   */
  public shouldAnalyze(): boolean {
    if (!this.lastAnalysisTime) {
      return true;
    }

    const now = new Date().getTime();
    const lastAnalysis = this.lastAnalysisTime.getTime();
    return now - lastAnalysis >= this.analysisInterval;
  }

  /**
   * 手动触发分析
   */
  public async triggerAnalysis(): Promise<void> {
    console.log('[AnalysisScheduler] Manually triggering analysis');
    await this.scheduleAnalysis();
  }
} 