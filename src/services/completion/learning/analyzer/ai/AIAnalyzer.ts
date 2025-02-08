import { AIAnalysisInput, AIAnalysisResult, AIAnalysisConfig } from './types/ai-analysis.types';
import { PromptManager } from './PromptManager';
import { AnalysisValidator } from './AnalysisValidator';
import { DataPreprocessor } from './preprocessor/DataPreprocessor';
import { ipcRenderer } from 'electron';

interface APIError {
  error?: {
    message: string;
  };
  message?: string;
}

interface CacheEntry {
  data: AIAnalysisResult;
  timestamp: number;
  expiresAt: number;
}

/**
 * AI 分析器
 * 负责对 PatternAnalyzer 的分析结果进行深度分析
 */
export class AIAnalyzer {
  private static instance: AIAnalyzer;
  private promptManager: PromptManager;
  private validator: AnalysisValidator;
  private isProcessing: boolean = false;
  private cache: Map<string, CacheEntry> = new Map();

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

  public static getInstance(): AIAnalyzer {
    if (!AIAnalyzer.instance) {
      AIAnalyzer.instance = new AIAnalyzer();
    }
    return AIAnalyzer.instance;
  }

  /**
   * 获取 AI 配置
   */
  private async getConfig() {
    const response = await ipcRenderer.invoke('ai-config:load');
    console.log('AI 配置加载结果:', response);
    if (!response.success) {
      throw new Error(response.error);
    }
    const config = response.data;
    if (!config.baseURL) {
      throw new Error('未配置 API 基础 URL');
    }
    return config;
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

      // 3. 获取 AI 配置
      const config = await this.getConfig();

      // 4. 生成 Prompt
      const { messages} = this.promptManager.generateAnalysisPrompt(input, processedData);

      // 5. 调用 AI API
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      const requestBody = {
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: 'json_object' }
      };

      let result: AIAnalysisResult | null = null;
      let retryCount = 0;

      while (retryCount < this.config.maxRetries) {
        try {
          const response = await fetch(`${config.baseURL}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
          });

          if (!response.ok) {
            const apiError = await response.json() as APIError;
            throw new Error(apiError.error?.message || apiError.message || '请求失败');
          }

          // 6. 解析和验证结果
          const data = await response.json();
          const content = data.choices[0]?.message?.content;
          if (!content) {
            throw new Error('未获取到有效响应');
          }

          result = JSON.parse(content) as AIAnalysisResult;
          if (!this.validator.validate(result)) {
            throw new Error('Analysis result validation failed');
          }

          // 7. 添加元数据
          result.metadata.processingTime = Date.now() - data.created;
          result.metadata.timestamp = new Date(data.created * 1000).toISOString();

          // 8. 缓存结果
          this.cacheResult(cacheKey, result);
          break;

        } catch (error) {
          retryCount++;
          if (retryCount === this.config.maxRetries) {
            throw error;
          }
          // 指数退避重试
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }

      console.log('[AIAnalyzer] Analysis completed successfully');
      return result;

    } catch (error) {
      console.error('[AIAnalyzer] Analysis failed:', error);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(input: AIAnalysisInput): string {
    // 使用分析时间和模式数据的哈希作为缓存键
    const patternsHash = JSON.stringify(input.baseAnalysis.patterns);
    return `${input.baseAnalysis.timestamp}_${Buffer.from(patternsHash).toString('base64')}`;
  }

  /**
   * 获取缓存的结果
   */
  private getCachedResult(key: string): AIAnalysisResult | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key); // 删除过期缓存
    }
    return null;
  }

  /**
   * 缓存结果
   */
  private cacheResult(key: string, result: AIAnalysisResult): void {
    // 如果缓存已满，删除最旧的条目
    if (this.cache.size >= this.config.cacheConfig.maxSize) {
      const oldestKey = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
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
      console.log('[AIAnalyzer] Starting cache cleanup');
      const now = Date.now();
      let cleanedCount = 0;
      for (const [key, entry] of this.cache.entries()) {
        if (entry.expiresAt <= now) {
          this.cache.delete(key);
          cleanedCount++;
        }
      }
      if (cleanedCount > 0) {
        console.log(`[AIAnalyzer] Cleaned ${cleanedCount} expired cache entries`);
      }
    }, this.config.cacheConfig.cleanupInterval);
  }
} 