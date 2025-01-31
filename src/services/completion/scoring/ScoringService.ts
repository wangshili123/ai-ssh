import { CompletionSuggestion } from '../types/completion.types';
import { EnhancedCompletionContext } from '../analyzers/types/context.types';
import { ContextScoring } from './factors/ContextScoring';
import { ChainScoring } from './factors/ChainScoring';
import { TimeScoring } from './factors/TimeScoring';
import { EnvironmentScoring } from './factors/EnvironmentScoring';
import { FrequencyScoring } from './factors/FrequencyScoring';
import { RecencyScoring } from './factors/RecencyScoring';
import { PrefixScoring } from './factors/PrefixScoring';
import { SyntaxScoring } from './factors/SyntaxScoring';

export class ScoringService {
  private static instance: ScoringService;
  private contextScoring: ContextScoring;
  private chainScoring: ChainScoring;
  private timeScoring: TimeScoring;
  private environmentScoring: EnvironmentScoring;
  private frequencyScoring: FrequencyScoring;
  private recencyScoring: RecencyScoring;
  private prefixScoring: PrefixScoring;
  private syntaxScoring: SyntaxScoring;

  private readonly weights = {
    base: 0.05,      // 基础得分权重
    frequency: 0.20, // 使用频率权重
    recency: 0.15,   // 最近使用权重
    prefix: 0.15,    // 前缀匹配权重
    syntax: 0.15,    // 语法匹配权重
    context: 0.10,   // 上下文相关度权重
    chain: 0.10,     // 命令链权重
    time: 0.05,      // 时间模式权重
    env: 0.05        // 环境状态权重
  };

  private constructor() {
    this.contextScoring = new ContextScoring();
    this.chainScoring = new ChainScoring();
    this.timeScoring = new TimeScoring();
    this.environmentScoring = new EnvironmentScoring();
    this.frequencyScoring = new FrequencyScoring();
    this.recencyScoring = new RecencyScoring();
    this.prefixScoring = new PrefixScoring();
    this.syntaxScoring = new SyntaxScoring();
  }

  public static getInstance(): ScoringService {
    if (!ScoringService.instance) {
      ScoringService.instance = new ScoringService();
    }
    return ScoringService.instance;
  }

  public async adjustSuggestionScores(
    suggestions: CompletionSuggestion[],
    input: string,
    context: EnhancedCompletionContext
  ): Promise<CompletionSuggestion[]> {
    console.log('[ScoringService] 开始调整建议得分...');
    
    const adjustedSuggestions = await Promise.all(
      suggestions.map(async (suggestion) => {
        // 1. 计算基础得分
        let finalScore = suggestion.score * this.weights.base;

        // 2. 计算各个维度的得分
        const frequencyScore = this.frequencyScoring.calculateScore(suggestion, context);
        const recencyScore = this.recencyScoring.calculateScore(suggestion, context);
        const prefixScore = this.prefixScoring.calculateScore(suggestion, input);
        const syntaxScore = this.syntaxScoring.calculateScore(suggestion, context);
        const contextScore = this.contextScoring.calculateScore(suggestion, context);
        const chainScore = this.chainScoring.calculateScore(suggestion, context);
        const timeScore = this.timeScoring.calculateScore(suggestion, context);
        const envScore = this.environmentScoring.calculateScore(suggestion, context);

        // 3. 计算加权总分
        finalScore += (
          frequencyScore * this.weights.frequency +
          recencyScore * this.weights.recency +
          prefixScore * this.weights.prefix +
          syntaxScore * this.weights.syntax +
          contextScore * this.weights.context +
          chainScore * this.weights.chain +
          timeScore * this.weights.time +
          envScore * this.weights.env
        );

        console.log('[ScoringService] 建议得分调整:', {
          suggestion: suggestion.suggestion,
          originalScore: suggestion.score,
          adjustedScore: finalScore,
          details: {
            frequencyScore,
            recencyScore,
            prefixScore,
            syntaxScore,
            contextScore,
            chainScore,
            timeScore,
            envScore
          }
        });

        return {
          ...suggestion,
          score: finalScore,
          details: {
            frequencyScore,
            recencyScore,
            prefixScore,
            syntaxScore,
            contextScore,
            chainScore,
            timeScore,
            envScore
          }
        };
      })
    );

    // 4. 按最终得分排序
    return adjustedSuggestions.sort((a, b) => b.score - a.score);
  }

  public deduplicateAndLimit(suggestions: CompletionSuggestion[], limit: number): CompletionSuggestion[] {
    // 使用 Map 来去重，保留得分最高的
    const uniqueMap = new Map<string, CompletionSuggestion>();
    
    for (const suggestion of suggestions) {
      const existing = uniqueMap.get(suggestion.fullCommand);
      if (!existing || existing.score < suggestion.score) {
        uniqueMap.set(suggestion.fullCommand, suggestion);
      }
    }
    
    // 转换回数组并按得分排序
    return Array.from(uniqueMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
} 