import { CompletionSuggestion } from '../types/completion.types';
import { EnhancedCompletionContext, CommandExecutionResult } from '../analyzers/types/context.types';
import { ContextScoring } from './factors/ContextScoring';
import { ChainScoring } from './factors/ChainScoring';
import { TimeScoring } from './factors/TimeScoring';
import { EnvironmentScoring } from './factors/EnvironmentScoring';

export class ScoringService {
  private static instance: ScoringService;
  private contextScoring: ContextScoring;
  private chainScoring: ChainScoring;
  private timeScoring: TimeScoring;
  private environmentScoring: EnvironmentScoring;

  private constructor() {
    this.contextScoring = new ContextScoring();
    this.chainScoring = new ChainScoring();
    this.timeScoring = new TimeScoring();
    this.environmentScoring = new EnvironmentScoring();
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
        let finalScore = suggestion.score;

        // 2. 计算各个维度的得分
        const contextScore = this.contextScoring.calculateScore(suggestion, context);
        const chainScore = this.chainScoring.calculateScore(suggestion, context);
        const timeScore = this.timeScoring.calculateScore(suggestion, context);
        const envScore = this.environmentScoring.calculateScore(suggestion, context);

        // 3. 根据不同来源调整权重
        const weights = {
          base: 0.1,      // 基础得分权重
          history: 0.5,   // 历史使用权重
          context: 0.15,  // 上下文相关度权重
          chain: 0.15,    // 命令链权重
          time: 0.05,     // 时间模式权重
          env: 0.05       // 环境状态权重
        };

        // 4. 计算最终得分
        finalScore = (
          suggestion.score * weights.base +
          contextScore * weights.context +
          chainScore * weights.chain +
          timeScore * weights.time +
          envScore * weights.env
        );

        console.log('[ScoringService] 建议得分调整:', {
          suggestion: suggestion.suggestion,
          originalScore: suggestion.score,
          adjustedScore: finalScore,
          details: {
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
            contextScore,
            chainScore,
            timeScore,
            envScore
          }
        };
      })
    );

    // 5. 按最终得分排序
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