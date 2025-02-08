import { CompletionSuggestion } from '../types/completion.types';
import { EnhancedContext } from '../core/types/context.types';
import { ContextScoring } from './factors/ContextScoring';
import { ChainScoring } from './factors/ChainScoring';
import { TimeScoring } from './factors/TimeScoring';
import { EnvironmentScoring } from './factors/EnvironmentScoring';
import { FrequencyScoring } from './factors/FrequencyScoring';
import { RecencyScoring } from './factors/RecencyScoring';
import { PrefixScoring } from './factors/PrefixScoring';
import { SyntaxScoring } from './factors/SyntaxScoring';
import { CompletionSource } from '../types/completion.types';

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
    env: 0.05,       // 环境状态权重
    ai: 0.20         // AI建议权重
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
    context: EnhancedContext
  ): Promise<CompletionSuggestion[]> {
    const scoredSuggestions = await Promise.all(
      suggestions.map(async suggestion => {
        // AI建议使用特殊评分逻辑
        if (suggestion.source === CompletionSource.AI) {
          return {
            ...suggestion,
            score: this.weights.ai * suggestion.score +
                   this.weights.prefix * this.prefixScoring.calculateScore(suggestion, input) +
                   this.weights.context * this.contextScoring.calculateScore(suggestion, context)
          };
        }

        // 文件补全建议使用特殊评分逻辑
        if (suggestion.source === CompletionSource.SYNTAX && this.isFileCompletion(suggestion, input)) {
          const prefixScore = this.prefixScoring.calculateScore(suggestion, input);
          const syntaxScore = this.syntaxScoring.calculateScore(suggestion, input);
          
          // 文件补全主要考虑前缀匹配和语法匹配
          return {
            ...suggestion,
            score: suggestion.score * 0.4 +  // 保留原始分数的影响
                   prefixScore * 0.3 +       // 前缀匹配的重要性
                   syntaxScore * 0.3,        // 语法匹配的重要性
            details: {
              frequency: 0,
              lastUsed: new Date(),
              contextScore: 0,
              chainScore: 0,
              timeScore: 0,
              envScore: 0,
              prefix: prefixScore,
              syntax: syntaxScore,
              originalScore: suggestion.score
            }
          };
        }
        
        // 其他建议使用常规评分
        const scores = {
          frequency: this.frequencyScoring.calculateScore(suggestion, context),
          recency: this.recencyScoring.calculateScore(suggestion, context),
          prefix: this.prefixScoring.calculateScore(suggestion, input),
          syntax: this.syntaxScoring.calculateScore(suggestion, input),
          context: this.contextScoring.calculateScore(suggestion, context),
          chain: this.chainScoring.calculateScore(suggestion, context),
          time: this.timeScoring.calculateScore(suggestion, context),
          env: this.environmentScoring.calculateScore(suggestion, context)
        };

        return {
          ...suggestion,
          score: this.calculateTotalScore(scores),
          details: {
            frequency: scores.frequency,
            lastUsed: new Date(),
            contextScore: scores.context,
            chainScore: scores.chain,
            timeScore: scores.time,
            envScore: scores.env
          }
        };
      })
    );

    return scoredSuggestions.sort((a, b) => b.score - a.score);
  }

  // 判断是否为文件补全
  private isFileCompletion(suggestion: CompletionSuggestion, input: string): boolean {
    const command = input.split(' ')[0];
    return ['cat', 'vim', 'nano', 'less', 'more', 'tail', 'head'].includes(command);
  }

  // 计算总分
  private calculateTotalScore(scores: {
    frequency: number;
    recency: number;
    prefix: number;
    syntax: number;
    context: number;
    chain: number;
    time: number;
    env: number;
  }): number {
    return this.weights.base +
           this.weights.frequency * scores.frequency +
           this.weights.recency * scores.recency +
           this.weights.prefix * scores.prefix +
           this.weights.syntax * scores.syntax +
           this.weights.context * scores.context +
           this.weights.chain * scores.chain +
           this.weights.time * scores.time +
           this.weights.env * scores.env;
  }

  public deduplicateAndLimit(
    suggestions: CompletionSuggestion[],
    limit: number
  ): CompletionSuggestion[] {
    // 去重
    const uniqueSuggestions = Array.from(
      new Map(suggestions.map(s => [s.fullCommand, s])).values()
    );

    // 限制数量
    return uniqueSuggestions.slice(0, limit);
  }
} 