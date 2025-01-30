import { CompletionSuggestion } from '../../types/completion.types';
import { EnhancedCompletionContext, CommandExecutionResult } from '../../analyzers/types/context.types';

export class ChainScoring {
  public calculateScore(
    suggestion: CompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    let score = 0;
    
    if (context.commandHistory.recent && context.commandHistory.recent.length > 0) {
      const lastCommand = context.commandHistory.recent[0];
      // 如果建议的命令经常在最后一个命令之后使用，增加得分
      if (lastCommand && this.areCommandsRelated(lastCommand, suggestion.suggestion)) {
        score += 0.3;
      }
    }

    return score;
  }

  private areCommandsRelated(cmd1: CommandExecutionResult | string, cmd2: string): boolean {
    // 检查命令是否属于同一类别
    const getCommandCategory = (cmd: CommandExecutionResult | string) => {
      const cmdStr = typeof cmd === 'string' ? cmd : cmd.command;
      if (cmdStr.startsWith('git')) return 'git';
      if (cmdStr.startsWith('docker')) return 'docker';
      if (cmdStr.match(/^(ls|cd|pwd|mkdir|rm|cp|mv)/)) return 'file';
      return 'other';
    };

    return getCommandCategory(cmd1) === getCommandCategory(cmd2);
  }
} 