import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedCompletionContext } from '../../analyzers/types/context.types';

export class EnvironmentScoring {
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    let score = 0;

    // 检查是否在 Git 仓库中
    if (context.environment.isGitRepository) {
      if (suggestion.suggestion.startsWith('git')) {
        score += 0.2;
      }
    }

    // 检查正在运行的进程
    if (context.environment.runningProcesses) {
      const hasRelatedProcess = context.environment.runningProcesses.some(
        process => suggestion.suggestion.includes(process)
      );
      if (hasRelatedProcess) {
        score += 0.2;
      }
    }

    return score;
  }
} 