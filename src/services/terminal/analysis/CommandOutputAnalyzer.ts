import { ERROR_PATTERNS } from './patterns/errorPatterns';
import { CommandAnalysis, CommandOutput, AnalyzerOptions } from './types/analysis.types';
import { CompletionService } from '../../completion/CompletionService';
import { CollectorService } from '../../completion/learning/collector/CollectorService';

export class CommandOutputAnalyzer {
  private static instance: CommandOutputAnalyzer;
  private outputCache: Map<string, CommandOutput> = new Map();
  
  private constructor() {}
  
  public static getInstance(): CommandOutputAnalyzer {
    if (!CommandOutputAnalyzer.instance) {
      CommandOutputAnalyzer.instance = new CommandOutputAnalyzer();
    }
    return CommandOutputAnalyzer.instance;
  }

  /**
   * 开始记录新命令的输出
   */
  public startCommand(shellId: string, command: string): void {
    this.outputCache.set(shellId, {
      command,
      output: [],
      isComplete: false,
      timestamp: new Date()
    });
  }

  /**
   * 添加命令输出
   */
  public addOutput(shellId: string, output: string): void {
    const cached = this.outputCache.get(shellId);
    if (cached) {
      cached.output.push(output);
    }
  }

  /**
   * 分析命令输出并处理结果
   */
  public async analyzeAndCollect(shellId: string, options: AnalyzerOptions = {}): Promise<CommandAnalysis> {
    const cached = this.outputCache.get(shellId);
    if (!cached) {
      return {
        command: '',
        isValid: false,
        output: []
      };
    }

    const analysis = this.analyzeOutput(cached);
    console.log('[CommandOutputAnalyzer] Analyze command output:', analysis);
    // 如果命令有效，进行数据收集
    if (analysis.isValid) {
      try {
        // 收集命令历史
        if (options.shouldCollectHistory) {
          const completionService = await CompletionService.getInstance();
          await completionService.recordCommand(cached.command);
        }

        // 收集使用统计
        if (options.shouldCollectUsage) {
          await CollectorService.getInstance().collectCommandUsage(
            cached.command,
            true
          );
        }
      } catch (error) {
        console.error('[CommandOutputAnalyzer] Failed to collect command data:', error);
      }
    }

    // 清理缓存
    this.outputCache.delete(shellId);

    return analysis;
  }

  /**
   * 分析命令输出
   */
  private analyzeOutput(cached: CommandOutput): CommandAnalysis {
    const fullOutput = cached.output.join('');
    
    // 检查是否匹配任何错误模式
    for (const { pattern, type } of ERROR_PATTERNS) {
      if (pattern.test(fullOutput)) {
        return {
          command: cached.command,
          isValid: false,
          errorType: type,
          output: cached.output
        };
      }
    }

    // 如果没有匹配任何错误模式，认为命令有效
    return {
      command: cached.command,
      isValid: true,
      output: cached.output
    };
  }

  /**
   * 清理指定 shell 的缓存
   */
  public clearCache(shellId: string): void {
    this.outputCache.delete(shellId);
  }
} 