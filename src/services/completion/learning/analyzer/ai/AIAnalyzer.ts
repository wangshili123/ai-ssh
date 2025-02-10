import { AIAnalysisInput, AIAnalysisResult } from './types/ai-analysis.types';
import { ipcRenderer } from 'electron';
import { DatabaseService } from '../../../../database/DatabaseService';
import { CompletionSource, CompletionSuggestion, AICompletionResult } from '../../../types/completion.types';
import { EnhancedContext } from '../../../core/types/context.types';

/**
 * AI 分析器
 * 负责调用 AI API 进行命令分析
 */
export class AIAnalyzer {
  private static instance: AIAnalyzer;
  private dbService: DatabaseService;

  private constructor() {
    this.dbService = DatabaseService.getInstance();
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
    try {
      console.log('[AIAnalyzer] Starting AI analysis');

      // 1. 获取 AI 配置
      const config = await this.getConfig();

      // 2. 调用 AI API
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      };

      const requestBody = {
        model: config.model,
        messages: input.messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        response_format: { type: 'json_object' },
        stream: false
      };

      const response = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      console.log('[AIAnalyzer] AI API response:', response);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || error.message || '请求失败');
      }

      // 3. 解析响应
      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('未获取到有效响应');
      }

      const result = JSON.parse(content);

      // 4. 添加元数据
      return {
        completions: result.patterns.map((p: any) => ({
          command: p.command,
          parts: p.parts || null,
          frequency: p.frequency || 1,
          confidence: p.confidence || 0.5,
          context: p.context || null
        })),
        metadata: {
          totalCommands: result.metadata.totalCommands,
          uniquePatterns: result.patterns.length,
          averageConfidence: result.metadata.averageConfidence,
          processingTime: Date.now() - data.created,
          modelVersion: config.model,
          timestamp: new Date(data.created * 1000).toISOString()
        }
      };

    } catch (error) {
      console.error('[AIAnalyzer] Analysis failed:', error);
      return null;
    }
  }

  /**
   * 获取AI补全建议
   */
  public async getCompletions(
    input: string,
    context: EnhancedContext
  ): Promise<CompletionSuggestion[]> {
    const completions = await this.dbService.getDatabase().prepare(`
      SELECT command, parts, confidence, context, frequency
      FROM ai_completions
      WHERE command LIKE ? OR parts LIKE ?
      ORDER BY confidence DESC, frequency DESC
      LIMIT 10
    `).all(`${input}%`, `${input}%`) as AICompletionResult[];

    return completions.map(c => ({
      fullCommand: c.command,
      suggestion: c.command.slice(input.length),
      source: CompletionSource.AI,
      score: c.confidence,
      details: {
        frequency: c.frequency
      }
    }));
  }
} 