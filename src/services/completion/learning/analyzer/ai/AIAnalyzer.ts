import { aiService } from '../../../../../renderer/services/ai';
import { PromptManager } from './PromptManager';
import { AnalysisValidator } from './AnalysisValidator';
import { DataPreprocessor } from './preprocessor/DataPreprocessor';
import {
  AIAnalysisInput,
  AIAnalysisResult,
  AIAnalysisConfig,
  AIAnalysisError,
  CacheEntry
} from './types/ai-analysis.types';

/**
 * AI 分析器
 * 负责对 PatternAnalyzer 的分析结果进行深度分析
 */
export class AIAnalyzer {
  private static instance: AIAnalyzer;
  private promptManager: PromptManager;
  private validator: AnalysisValidator;
  private isProcessing: boolean = false;
  private cache: Map<string, CacheEntry<AIAnalysisResult>> = new Map();

  // 分析配置
  private config: AIAnalysisConfig = {
    maxBatchSize: 100,
    minConfidenceThreshold: 0.7,
    maxRetries: 3,
    analysisTimeout: 30000,
    cacheConfig: {
      maxSize: 1000,
      expiration: 60 * 60 * 1000, // 1小时
      cleanupInterval: 15 * 60 * 1000 // 15分钟
    }
  };

  private constructor() {
    this.promptManager = new PromptManager();
    this.validator = new AnalysisValidator();
    this.startCacheCleanup();
  }

  /**
   * 获取分析器实例
   */
  public static getInstance(): AIAnalyzer {
    if (!AIAnalyzer.instance) {
      AIAnalyzer.instance = new AIAnalyzer();
    }
    return AIAnalyzer.instance;
  }

  /**
   * 执行 AI 分析
   */
  public async analyze(input: AIAnalysisInput): Promise<AIAnalysisResult | null> {
    if (this.isProcessing) {
      console.log('[AIAnalyzer] Analysis already in progress');
      return null;
    }

    try {
      this.isProcessing = true;
      console.log('[AIAnalyzer] Starting AI analysis');

      // 1. 检查缓存
      const cacheKey = this.generateCacheKey(input);
      const cachedResult = this.getCachedResult(cacheKey);
      if (cachedResult) {
        console.log('[AIAnalyzer] Returning cached result');
        return cachedResult;
      }

      // 2. 数据预处理
      const processedData = await DataPreprocessor.preprocess(input);
      console.log('[AIAnalyzer] Data preprocessing completed');

      // 3. 生成分析 Prompt
      const prompt = await this.promptManager.generateAnalysisPrompt(input, processedData);

      // 4. 调用 AI 服务
      const startTime = Date.now();
      const analysisResponse = await this.callAIService(prompt);

      // 5. 解析和验证结果
      const result = await this.parseAndValidateResponse(analysisResponse, input);

      // 6. 添加元数据
      result.metadata.processingTime = Date.now() - startTime;
      result.metadata.timestamp = new Date().toISOString();

      // 7. 缓存结果
      this.cacheResult(cacheKey, result);

      console.log('[AIAnalyzer] Analysis completed successfully');
      return result;

    } catch (error) {
      console.error('[AIAnalyzer] Analysis failed:', error);
      await this.handleAnalysisError(error as Error);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 调用 AI 服务
   */
  private async callAIService(prompt: string): Promise<any> {
    let retries = 0;
    while (retries < this.config.maxRetries) {
      try {
        const response = await aiService.getAgentResponse(prompt);
        return response;
      } catch (error) {
        retries++;
        if (retries === this.config.maxRetries) {
          throw error;
        }
        // 指数退避重试
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
      }
    }
  }

  /**
   * 解析和验证 AI 响应
   */
  private async parseAndValidateResponse(
    response: any,
    input: AIAnalysisInput
  ): Promise<AIAnalysisResult> {
    try {
      // 1. 解析响应
      const parsedResult = this.parseResponse(response);
      
      // 2. 验证结果
      if (!this.validator.validate(parsedResult)) {
        throw new Error('Analysis result validation failed');
      }

      // 3. 过滤低置信度的结果
      return this.filterResults(parsedResult);
    } catch (error) {
      const err = error as Error;
      throw {
        code: 'PARSE_ERROR',
        message: `Failed to parse or validate AI response: ${err.message}`,
        severity: 'high' as const,
        timestamp: new Date().toISOString()
      } as AIAnalysisError;
    }
  }

  /**
   * 解析 AI 响应
   */
  private parseResponse(response: any): AIAnalysisResult {
    try {
      const { description = '' } = response;
      const resultJson = JSON.parse(description);
      return resultJson as AIAnalysisResult;
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error}`);
    }
  }

  /**
   * 过滤分析结果
   */
  private filterResults(result: AIAnalysisResult): AIAnalysisResult {
    return {
      ...result,
      insights: {
        ...result.insights,
        patternInsights: result.insights.patternInsights.filter(
          insight => insight.confidence >= this.config.minConfidenceThreshold
        )
      }
    };
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(input: AIAnalysisInput): string {
    return `${input.baseAnalysis.timestamp}_${JSON.stringify(input.baseAnalysis.patterns)}`;
  }

  /**
   * 获取缓存的结果
   */
  private getCachedResult(key: string): AIAnalysisResult | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    return null;
  }

  /**
   * 缓存结果
   */
  private cacheResult(key: string, result: AIAnalysisResult): void {
    if (this.cache.size >= this.config.cacheConfig.maxSize) {
      // 如果缓存已满，删除最旧的条目
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data: result,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.cacheConfig.expiration
    });
  }

  /**
   * 启动缓存清理
   */
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt <= now) {
          this.cache.delete(key);
        }
      }
    }, this.config.cacheConfig.cleanupInterval);
  }

  /**
   * 错误处理
   */
  private async handleAnalysisError(error: Error): Promise<void> {
    const analysisError = error as unknown as AIAnalysisError;
    console.error('[AIAnalyzer] Error during analysis:', {
      code: analysisError.code || 'UNKNOWN_ERROR',
      message: analysisError.message,
      severity: analysisError.severity || 'high',
      timestamp: new Date().toISOString()
    });
  }
} 