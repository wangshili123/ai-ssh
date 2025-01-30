import { ArgumentPattern } from '../types/patterns.types';
import { CommandExecutionResult } from '../types/context.types';
import { ShellParser } from '../../../parser/ShellParser';

export class ArgumentPatternAnalyzer {
  private static instance: ArgumentPatternAnalyzer;
  private argumentPatterns: Map<string, Map<string, ArgumentPattern>> = new Map();
  private shellParser: ShellParser;

  private constructor() {
    this.shellParser = ShellParser.getInstance();
  }

  public static getInstance(): ArgumentPatternAnalyzer {
    if (!ArgumentPatternAnalyzer.instance) {
      ArgumentPatternAnalyzer.instance = new ArgumentPatternAnalyzer();
    }
    return ArgumentPatternAnalyzer.instance;
  }

  public async updatePattern(result: CommandExecutionResult): Promise<void> {
    try {
      const parsedCommand = await this.shellParser.parse(result.command);
      const commandParts = result.command.split(' ');
      const commandName = commandParts[0];
      const args = commandParts.slice(1);
      
      if (!this.argumentPatterns.has(commandName)) {
        this.argumentPatterns.set(commandName, new Map());
      }
      
      const cmdArgPatterns = this.argumentPatterns.get(commandName)!;
      
      // 更新每个参数的使用情况
      args.forEach(arg => {
        const pattern = cmdArgPatterns.get(arg) || {
          value: arg,
          frequency: 0,
          lastUsed: new Date(),
          successRate: 1.0
        };
        
        pattern.frequency++;
        pattern.lastUsed = result.timestamp;
        pattern.successRate = (pattern.successRate * (pattern.frequency - 1) + (result.exitCode === 0 ? 1 : 0)) / pattern.frequency;
        
        cmdArgPatterns.set(arg, pattern);
      });
    } catch (error) {
      console.error('更新参数模式失败:', error);
    }
  }

  public getPatterns(command: string): ArgumentPattern[] {
    const patterns = this.argumentPatterns.get(command);
    if (!patterns) return [];
    
    return Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency);
  }
} 