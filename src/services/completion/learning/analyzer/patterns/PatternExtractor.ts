import { CompletionUsage } from '../../types';
import { ParameterPattern, ContextPattern, SequencePattern } from '../types';

/**
 * 模式提取器
 * 负责从原始数据中提取各种命令模式
 */
export class PatternExtractor {
  /**
   * 提取参数模式
   */
  public static extractParameterPattern(command: string): ParameterPattern | null {
    const parts = command.split(' ');
    if (parts.length < 2) return null;

    const baseCommand = parts[0];
    const parameter = parts.slice(1).join(' ');

    return {
      command: baseCommand,
      parameter,
      frequency: 1,
      examples: [command]
    };
  }

  /**
   * 提取序列模式
   */
  public static identifySequencePatterns(
    data: CompletionUsage[], 
    maxLength: number,
    minFrequency: number
  ): SequencePattern[] {
    const sequences: SequencePattern[] = [];

    for (let i = 0; i < data.length - maxLength + 1; i++) {
      const windowData = data.slice(i, i + maxLength);
      const sequence = windowData
        .map(record => record.suggestion.trim())
        .filter(cmd => cmd.length > 0);

      if (sequence.length >= 2) {
        const timeGap = this.calculateAverageTimeGap(windowData);
        const successRate = this.calculateSuccessRate(windowData);

        const pattern: SequencePattern = {
          commands: sequence,
          frequency: 1,
          timeGap,
          successRate
        };
        this.updateSequencePatterns(sequences, pattern);
      }
    }

    return sequences.filter(s => s.frequency >= minFrequency);
  }

  /**
   * 提取上下文模式
   */
  public static identifyContextPatterns(
    data: CompletionUsage[],
    windowSize: number,
    minFrequency: number
  ): ContextPattern[] {
    const patterns: ContextPattern[] = [];

    for (let i = 0; i < data.length; i++) {
      const currentCommand = data[i].suggestion.trim();
      if (!currentCommand) continue;

      const context = this.extractContext(data, i, windowSize);
      if (!context) continue;

      const pattern: ContextPattern = {
        command: currentCommand,
        context: context.join(' '),
        frequency: 1,
        correlation: this.calculateContextCorrelation(currentCommand, context)
      };

      this.updateContextPatterns(patterns, pattern);
    }

    return patterns.filter(p => p.frequency >= minFrequency);
  }

  /**
   * 计算上下文相关性
   */
  private static calculateContextCorrelation(command: string, context: string[]): number {
    // 基于命令和上下文的共同出现频率计算相关性
    const commandTerms = new Set(command.split(' '));
    const contextTerms = new Set(context.flatMap(cmd => cmd.split(' ')));
    
    const commonTerms = [...commandTerms].filter(term => contextTerms.has(term));
    const correlation = commonTerms.length / Math.max(commandTerms.size, contextTerms.size);
    
    return Math.min(correlation + 0.5, 1.0); // 基础相关性0.5，最高1.0
  }

  /**
   * 提取上下文
   */
  private static extractContext(
    data: CompletionUsage[], 
    currentIndex: number, 
    window: number
  ): string[] | null {
    const context: string[] = [];
    
    // 获取前面的命令
    for (let i = Math.max(0, currentIndex - window); i < currentIndex; i++) {
      const cmd = data[i].suggestion.trim();
      if (cmd) context.push(cmd);
    }

    // 获取后面的命令
    for (let i = currentIndex + 1; i < Math.min(data.length, currentIndex + window + 1); i++) {
      const cmd = data[i].suggestion.trim();
      if (cmd) context.push(cmd);
    }

    return context.length > 0 ? context : null;
  }

  /**
   * 计算平均时间间隔
   */
  private static calculateAverageTimeGap(data: CompletionUsage[]): number {
    if (data.length < 2) return 0;

    let totalGap = 0;
    let validGaps = 0;

    for (let i = 1; i < data.length; i++) {
      const current = new Date(data[i].timestamp).getTime();
      const previous = new Date(data[i - 1].timestamp).getTime();
      const gap = current - previous;

      // 只考虑合理的时间间隔（小于1小时的）
      if (gap > 0 && gap < 3600000) {
        totalGap += gap;
        validGaps++;
      }
    }

    return validGaps > 0 ? totalGap / validGaps : 0;
  }

  /**
   * 计算成功率
   */
  private static calculateSuccessRate(data: CompletionUsage[]): number {
    if (data.length === 0) return 0;
    const successCount = data.filter(record => record.success).length;
    return successCount / data.length;
  }

  /**
   * 更新序列模式
   */
  private static updateSequencePatterns(patterns: SequencePattern[], newPattern: SequencePattern): void {
    const existingPattern = patterns.find(p => 
      p.commands.length === newPattern.commands.length &&
      p.commands.every((cmd, i) => cmd === newPattern.commands[i])
    );

    if (existingPattern) {
      existingPattern.frequency++;
      // 更新时间间隔（使用移动平均）
      existingPattern.timeGap = (existingPattern.timeGap * (existingPattern.frequency - 1) + newPattern.timeGap) 
        / existingPattern.frequency;
      // 更新成功率
      existingPattern.successRate = (existingPattern.successRate * (existingPattern.frequency - 1) + newPattern.successRate)
        / existingPattern.frequency;
    } else {
      patterns.push(newPattern);
    }
  }

  /**
   * 更新上下文模式
   */
  private static updateContextPatterns(patterns: ContextPattern[], newPattern: ContextPattern): void {
    const existingPattern = patterns.find(p => 
      p.command === newPattern.command && p.context === newPattern.context
    );

    if (existingPattern) {
      existingPattern.frequency++;
      // 更新相关性（使用移动平均）
      existingPattern.correlation = (existingPattern.correlation * (existingPattern.frequency - 1) + newPattern.correlation)
        / existingPattern.frequency;
    } else {
      patterns.push(newPattern);
    }
  }
} 