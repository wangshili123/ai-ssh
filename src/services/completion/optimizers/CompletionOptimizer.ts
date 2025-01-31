import { CompletionSuggestion, CompletionContext } from '../types/completion.types';

interface SuggestionCache {
  suggestions: CompletionSuggestion[];
  timestamp: number;
  input: string;
  context: CompletionContext;
}

interface ScoringFactors {
  frequency: number;    // 使用频率
  recency: number;     // 最近使用时间
  contextMatch: number; // 上下文匹配度
  prefixMatch: number; // 前缀匹配度
  syntaxMatch: number; // 语法匹配度
  commandChain: number; // 命令链关联度
}

export class CompletionOptimizer {
  private static instance: CompletionOptimizer;
  private cache: Map<string, SuggestionCache> = new Map();
  
  private readonly CACHE_DURATION = 2000; // 2s
  private readonly WEIGHT_FACTORS = {
    FREQUENCY: 0.4,
    RECENCY: 0.3,
    CONTEXT_MATCH: 0.2,
    PREFIX_MATCH: 0.1
  };
  
  private constructor() {}
  
  public static getInstance(): CompletionOptimizer {
    if (!CompletionOptimizer.instance) {
      CompletionOptimizer.instance = new CompletionOptimizer();
    }
    return CompletionOptimizer.instance;
  }
  
  public async optimizeSuggestions(
    input: string,
    context: CompletionContext,
    suggestions: CompletionSuggestion[]
  ): Promise<CompletionSuggestion[]> {
    console.log('[CompletionOptimizer] 开始优化补全建议');
    const startTime = Date.now();
    
    try {
      // 1. 检查缓存
      const cacheKey = this.getCacheKey(input, context);
      const cached = this.cache.get(cacheKey);
      
      if (cached && this.isCacheValid(cached)) {
        console.log('[CompletionOptimizer] 使用缓存的建议');
        return cached.suggestions;
      }
      
      // 2. 计算建议得分
      const scoredSuggestions = suggestions.map(suggestion => ({
        ...suggestion,
        score: this.calculateScore(suggestion, input, context)
      }));
      
      // 3. 排序建议
      const sortedSuggestions = this.sortSuggestions(scoredSuggestions);
      
      // 4. 更新缓存
      this.cache.set(cacheKey, {
        suggestions: sortedSuggestions,
        timestamp: Date.now(),
        input,
        context
      });
      
      const duration = Date.now() - startTime;
      console.log('[CompletionOptimizer] 优化完成, 耗时:', duration, 'ms');
      
      return sortedSuggestions;
    } catch (error) {
      console.error('[CompletionOptimizer] 优化建议失败:', error);
      return suggestions;
    }
  }
  
  private calculateScore(
    suggestion: CompletionSuggestion,
    input: string,
    context: CompletionContext
  ): number {
    const factors: ScoringFactors = {
      frequency: suggestion.details?.frequency || 0,
      recency: this.calculateRecencyScore(suggestion.details?.lastUsed),
      contextMatch: this.calculateContextMatchScore(suggestion, context),
      prefixMatch: this.calculatePrefixMatchScore(suggestion.suggestion, input),
      syntaxMatch: this.calculateSyntaxMatchScore(suggestion, context),
      commandChain: this.calculateCommandChainScore(suggestion, context)
    };
    
    return (
      factors.frequency * this.WEIGHT_FACTORS.FREQUENCY +
      factors.recency * this.WEIGHT_FACTORS.RECENCY +
      factors.contextMatch * this.WEIGHT_FACTORS.CONTEXT_MATCH +
      factors.prefixMatch * this.WEIGHT_FACTORS.PREFIX_MATCH
    );
  }
  
  private calculateRecencyScore(lastUsed?: Date): number {
    if (!lastUsed) return 0;
    
    const age = Date.now() - lastUsed.getTime();
    const hourAge = age / (1000 * 60 * 60);
    return Math.max(0, 1 - hourAge / 24); // 24小时内线性衰减
  }
  
  private calculateContextMatchScore(
    suggestion: CompletionSuggestion,
    context: CompletionContext
  ): number {
    let score = 0;
    
    // 1. 目录匹配
    if (suggestion.details?.contextScore) {
      score += suggestion.details.contextScore;
    }
    
    // 2. 环境匹配
    if (suggestion.details?.envScore) {
      score += suggestion.details.envScore;
    }
    
    return score;
  }
  
  private calculatePrefixMatchScore(value: string, input: string): number {
    if (!input) return 1;
    if (value.startsWith(input)) return 1;
    
    const normalizedValue = value.toLowerCase();
    const normalizedInput = input.toLowerCase();
    
    if (normalizedValue.startsWith(normalizedInput)) return 0.8;
    if (normalizedValue.includes(normalizedInput)) return 0.4;
    
    return 0;
  }
  
  private calculateSyntaxMatchScore(
    suggestion: CompletionSuggestion,
    context: CompletionContext
  ): number {
    if (!context.currentCommand) return 0;
    
    let score = 0;
    
    // 1. 命令匹配
    if (suggestion.fullCommand === context.currentCommand.name) {
      score += 1;
    }
    
    // 2. 参数匹配
    if (context.currentCommand.args.includes(suggestion.suggestion)) {
      score += 0.5;
    }
    
    return score;
  }
  
  private calculateCommandChainScore(
    suggestion: CompletionSuggestion,
    context: CompletionContext
  ): number {
    if (!context.recentCommands?.length) return 0;
    
    const lastCommand = context.recentCommands[0];
    if (!lastCommand) return 0;
    
    // 检查命令链关联
    if (suggestion.details?.chainScore) {
      return suggestion.details.chainScore;
    }
    
    return 0;
  }
  
  private sortSuggestions(
    suggestions: CompletionSuggestion[]
  ): CompletionSuggestion[] {
    return [...suggestions].sort((a, b) => b.score - a.score);
  }
  
  private getCacheKey(input: string, context: CompletionContext): string {
    return `${input}|${context.currentCommand?.name}|${context.recentCommands?.length}`;
  }
  
  private isCacheValid(cache: SuggestionCache): boolean {
    const age = Date.now() - cache.timestamp;
    return age < this.CACHE_DURATION;
  }
  
  public clearCache(): void {
    this.cache.clear();
  }
  
  public getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // TODO: 实现缓存命中率统计
    };
  }
} 