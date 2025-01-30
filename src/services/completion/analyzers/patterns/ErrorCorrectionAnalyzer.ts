import { ErrorCorrectionPattern } from '../types/patterns.types';
import { CommandExecutionResult } from '../types/context.types';

export class ErrorCorrectionAnalyzer {
  private static instance: ErrorCorrectionAnalyzer;
  private errorCorrectionPatterns: Map<string, ErrorCorrectionPattern> = new Map();

  private constructor() {}

  public static getInstance(): ErrorCorrectionAnalyzer {
    if (!ErrorCorrectionAnalyzer.instance) {
      ErrorCorrectionAnalyzer.instance = new ErrorCorrectionAnalyzer();
    }
    return ErrorCorrectionAnalyzer.instance;
  }

  public updatePattern(result: CommandExecutionResult): void {
    // 如果命令执行失败
    if (result.exitCode !== 0) {
      // 记录原始命令
      const originalCommand = result.command;
      
      // 尝试进行命令纠错
      const correctedCommand = this.correctCommand(originalCommand, result.output);
      
      if (correctedCommand && correctedCommand !== originalCommand) {
        const pattern = this.errorCorrectionPatterns.get(originalCommand) || {
          originalCommand,
          correctedCommand,
          frequency: 0,
          lastUsed: new Date(),
          successRate: 1.0
        };
        
        pattern.frequency++;
        pattern.lastUsed = result.timestamp;
        
        this.errorCorrectionPatterns.set(originalCommand, pattern);
      }
    }
  }

  public getCorrections(command: string): string[] {
    const correction = this.errorCorrectionPatterns.get(command);
    return correction ? [correction.correctedCommand] : [];
  }

  private correctCommand(command: string, errorOutput: string[]): string | null {
    // 基于错误输出进行命令纠正
    const errorText = errorOutput.join('\n').toLowerCase();
    
    // 常见错误模式匹配
    if (errorText.includes('command not found')) {
      // 尝试修正拼写错误
      return this.correctSpelling(command);
    }
    
    if (errorText.includes('permission denied')) {
      // 添加 sudo
      return `sudo ${command}`;
    }
    
    if (errorText.includes('no such file or directory')) {
      // 检查路径问题
      return this.correctPath(command);
    }
    
    return null;
  }

  private correctSpelling(command: string): string | null {
    // 简单的拼写纠正逻辑
    const commonCommands: Record<string, string> = {
      'gti': 'git',
      'sl': 'ls',
      'grpe': 'grep',
      'mkidr': 'mkdir'
    };
    
    const firstWord = command.split(' ')[0];
    const correction = commonCommands[firstWord];
    
    if (correction) {
      return command.replace(firstWord, correction);
    }
    
    return null;
  }

  private correctPath(command: string): string | null {
    // 简单的路径纠正逻辑
    const words = command.split(' ');
    const correctedWords = words.map(word => {
      if (word.includes('/')) {
        // 移除多余的斜杠
        return word.replace(/\/+/g, '/');
      }
      return word;
    });
    
    const correctedCommand = correctedWords.join(' ');
    return correctedCommand !== command ? correctedCommand : null;
  }
} 