import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedCompletionContext } from '../../analyzers/types/context.types';

export class ContextScoring {
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    let score = 0;
    
    // 检查建议是否与当前目录相关
    if (context.environment.currentDirectory) {
      if (suggestion.suggestion.includes(context.environment.currentDirectory)) {
        score += 0.3;
      }
    }

    // 检查建议是否与最近文件相关
    if (context.environment.recentFiles) {
      const hasRecentFileMatch = context.environment.recentFiles.some(
        file => suggestion.suggestion.includes(file)
      );
      if (hasRecentFileMatch) {
        score += 0.2;
      }
    }

    return score;
  }
} 