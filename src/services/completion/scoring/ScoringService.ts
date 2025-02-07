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
    context: EnhancedContext
  ): Promise<CompletionSuggestion[]> {
    const scoredSuggestions = await Promise.all(
      suggestions.map(async suggestion => {
        // 计算各个因素的得分
        const frequencyScore = this.frequencyScoring.calculateScore(suggestion, context);
        const recencyScore = this.recencyScoring.calculateScore(suggestion, context);
        const prefixScore = this.prefixScoring.calculateScore(suggestion, input);
        const syntaxScore = this.syntaxScoring.calculateScore(suggestion, input);
        const contextScore = this.contextScoring.calculateScore(suggestion, context);
        const chainScore = this.chainScoring.calculateScore(suggestion, context);
        const timeScore = this.timeScoring.calculateScore(suggestion, context);
        const envScore = this.environmentScoring.calculateScore(suggestion, context);

        // 计算加权总分
        const totalScore =
          this.weights.base +
          this.weights.frequency * frequencyScore +
          this.weights.recency * recencyScore +
          this.weights.prefix * prefixScore +
          this.weights.syntax * syntaxScore +
          this.weights.context * contextScore +
          this.weights.chain * chainScore +
          this.weights.time * timeScore +
          this.weights.env * envScore;

        // 更新建议的得分和详情
        return {
          ...suggestion,
          score: totalScore,
          details: {
            frequency: frequencyScore,
            recency: recencyScore,
            prefix: prefixScore,
            syntax: syntaxScore,
            context: contextScore,
            chain: chainScore,
            time: timeScore,
            env: envScore
          }
        };
      })
    );

    // 按得分降序排序
    return scoredSuggestions.sort((a, b) => b.score - a.score);
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