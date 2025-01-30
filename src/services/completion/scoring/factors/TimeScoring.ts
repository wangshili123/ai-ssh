import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedCompletionContext } from '../../analyzers/types/context.types';

export class TimeScoring {
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    let score = 0;

    // 获取当前小时
    const currentHour = new Date().getHours();
    
    // 如果建议在当前时间段经常使用，增加得分
    if (this.isCommandFrequentInTimeRange(suggestion.suggestion, currentHour)) {
      score += 0.2;
    }

    return score;
  }

  private isCommandFrequentInTimeRange(command: string, hour: number): boolean {
    if (hour >= 9 && hour <= 18) {
      // 工作时间
      return command.match(/^(git|docker|npm|yarn)/) !== null;
    } else {
      // 非工作时间
      return command.match(/^(ls|cd|cat)/) !== null;
    }
  }
} 