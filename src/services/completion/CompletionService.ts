import { CommandHistory, ICommandHistory } from '../database/models/CommandHistory';
import { CommandRelation, CommandRelationType } from '../database/models/CommandRelation';
import { DatabaseService } from '../database/DatabaseService';
import { ShellParser } from '../parser/ShellParser';
import { ShellParserTypes } from '../parser/ShellParserTypes';
import { FishStyleCompletion } from './FishStyleCompletion';
import { CompletionContext } from './CompletionContext';
import debounce from 'lodash/debounce';
import { EnhancedContextAnalyzer } from './analyzers/EnhancedContextAnalyzer';
import { 
  EnhancedCompletionContext, 
  CommandExecutionResult,
  SessionState
} from './core/types/context.types';

export interface ICompletionSuggestion {
  fullCommand: string;    // 完整的命令
  suggestion: string;     // 建议补全的部分
  source: CompletionSource;
  score: number;         // 建议的相关度得分
}

/**
 * 补全来源类型
 */
export enum CompletionSource {
  HISTORY = 'history',       // 历史记录
  RELATION = 'relation',     // 关联命令
  LOCAL = 'local'           // 本地补全
}

/**
 * 命令补全服务
 * 负责提供命令补全建议
 */
export class CompletionService {
  private static instance: CompletionService;
  private commandHistory!: CommandHistory;
  private commandRelation!: CommandRelation;
  private shellParser: ShellParser;
  private fishCompletion: FishStyleCompletion;
  private lastInput: string = '';
  private lastSuggestions: ICompletionSuggestion[] = [];
  private selectedIndex: number = 0;
  private initialized: boolean = false;
  private contextAnalyzer: EnhancedContextAnalyzer;

  private constructor() {
    this.shellParser = ShellParser.getInstance();
    this.fishCompletion = FishStyleCompletion.getInstance();
    this.contextAnalyzer = EnhancedContextAnalyzer.getInstance();
    this.initializeAsync();
  }

  private async initializeAsync() {
    try {
      await DatabaseService.getInstance().init();
      this.commandHistory = new CommandHistory();
      this.commandRelation = new CommandRelation();
      this.initialized = true;
    } catch (error) {
      console.error('数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取补全服务实例
   */
  public static async getInstance(): Promise<CompletionService> {
    if (!CompletionService.instance) {
      CompletionService.instance = new CompletionService();
      await CompletionService.instance.initializeAsync();
    }
    return CompletionService.instance;
  }

  /**
   * 检查服务是否已初始化
   */
  private checkInitialized() {
    if (!this.initialized) {
      throw new Error('补全服务未初始化');
    }
  }

  /**
   * 获取补全建议
   */
  public async getSuggestions(
    input: string,
    cursorPosition: number,
    sessionState: SessionState
  ): Promise<ICompletionSuggestion[]> {
    console.log('[CompletionService] 开始获取补全建议, 输入:', input);

    try {
      // 1. 获取增强的上下文
      const enhancedContext = await this.contextAnalyzer.getEnhancedContext(
        input,
        cursorPosition,
        sessionState
      );

      // 2. 获取基础补全建议
      const command = enhancedContext.currentCommand.type === 'command' 
        ? enhancedContext.currentCommand 
        : { name: '', args: [], options: [], redirects: [] };

      const suggestions = await this.fishCompletion.getSuggestions(
        command,
        {
          sshSession: undefined, // 如果需要SSH补全，在这里添加
          recentCommands: enhancedContext.commandHistory.recent.map(r => r.command),
          commandHistory: {
            frequency: enhancedContext.commandHistory.statistics[0]?.frequency || 0,
            lastUsed: enhancedContext.commandHistory.statistics[0]?.lastUsed || new Date()
          },
          currentCommand: {
            name: command.name,
            args: command.args,
            options: command.options,
            isIncomplete: true
          }
        }
      );

      // 3. 根据增强上下文调整建议的排序和得分
      return this.adjustSuggestions(suggestions, enhancedContext);
    } catch (error) {
      console.error('[CompletionService] 获取补全建议失败:', error);
      return [];
    }
  }

  /**
   * 根据增强上下文调整建议
   */
  private adjustSuggestions(
    suggestions: ICompletionSuggestion[],
    context: EnhancedCompletionContext
  ): ICompletionSuggestion[] {
    return suggestions.map(suggestion => {
      const adjustedScore = this.calculateContextualScore(suggestion, context);
      return {
        ...suggestion,
        score: adjustedScore
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * 计算上下文相关的得分
   */
  private calculateContextualScore(
    suggestion: ICompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    let score = suggestion.score;

    // 1. 基于命令链的得分
    const chainScore = this.getCommandChainScore(suggestion, context);
    
    // 2. 基于时间模式的得分
    const timeScore = this.getTimePatternScore(suggestion, context);
    
    // 3. 基于上下文模式的得分
    const contextScore = this.getContextPatternScore(suggestion, context);

    // 4. 基于环境状态的得分
    const environmentScore = this.getEnvironmentScore(suggestion, context);

    // 综合得分
    return (
      score * 0.4 +
      chainScore * 0.3 +
      timeScore * 0.1 +
      contextScore * 0.1 +
      environmentScore * 0.1
    );
  }

  /**
   * 获取命令链得分
   */
  private getCommandChainScore(
    suggestion: ICompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    const lastCommand = context.commandHistory.recent[context.commandHistory.recent.length - 1]?.command;
    if (!lastCommand) return 0;

    const chainStats = context.userPatterns.commandChains[lastCommand];
    if (!chainStats) return 0;

    const nextCommandCount = chainStats.nextCommands[suggestion.fullCommand] || 0;
    return nextCommandCount / (chainStats.frequency || 1);
  }

  /**
   * 获取时间模式得分
   */
  private getTimePatternScore(
    suggestion: ICompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    const currentHour = new Date().getHours();
    const hourPattern = context.userPatterns.timePatterns[currentHour] || {};
    const commandCount = hourPattern[suggestion.fullCommand] || 0;
    
    const totalCommands = Object.values(hourPattern).reduce((sum: number, count: number) => sum + count, 0);
    return totalCommands > 0 ? commandCount / totalCommands : 0;
  }

  /**
   * 获取上下文模式得分
   */
  private getContextPatternScore(
    suggestion: ICompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    // TODO: 实现更复杂的上下文识别
    const currentContext = 'default';
    const contextPattern = context.userPatterns.contextPatterns[currentContext] || {};
    const commandCount = contextPattern[suggestion.fullCommand] || 0;
    
    const totalCommands = Object.values(contextPattern).reduce((sum: number, count: number) => sum + count, 0);
    return totalCommands > 0 ? commandCount / totalCommands : 0;
  }

  /**
   * 获取环境相关得分
   */
  private getEnvironmentScore(
    suggestion: ICompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    let score = 0;

    // 1. Git相关命令在Git仓库中得分更高
    if (context.environment.isGitRepository && suggestion.fullCommand.startsWith('git')) {
      score += 0.3;
    }

    // 2. 文件操作命令与最近修改的文件相关性
    if (
      ['cat', 'vim', 'nano', 'less'].some(cmd => suggestion.fullCommand.startsWith(cmd)) &&
      context.environment.lastModifiedFiles.some((file: string) => suggestion.fullCommand.includes(file))
    ) {
      score += 0.3;
    }

    // 3. 进程相关命令与运行进程的相关性
    if (
      ['kill', 'pkill'].some(cmd => suggestion.fullCommand.startsWith(cmd)) &&
      context.environment.runningProcesses.some((proc: string) => suggestion.fullCommand.includes(proc))
    ) {
      score += 0.3;
    }

    return score;
  }

  /**
   * 获取实时补全建议
   * @param input 当前输入的命令
   * @param sshSession 当前SSH会话
   * @returns 补全建议列表
   */
  public async getSuggestionsOld(
    input: string,
    sshSession?: CompletionContext['sshSession']
  ): Promise<ICompletionSuggestion[]> {
    console.log('[CompletionService] 开始获取补全建议, 输入:', input);
    this.checkInitialized();
    
    // 如果输入为空或与上次相同，返回空数组
    if (!input || input === this.lastInput) {
      console.log('[CompletionService] 输入为空或与上次相同，返回空数组');
      return [];
    }

    this.lastInput = input;
    
    // 解析命令
    console.log('[CompletionService] 开始解析命令...');
    const parseResult = await this.shellParser.parse(input);
    console.log('[CompletionService] 命令解析结果:', parseResult);
    
    if (parseResult.type === 'error' || parseResult.type === 'unknown') {
      console.log('[CompletionService] 命令解析失败或未知类型，返回空数组');
      return [];
    }

    // 准备补全上下文
    console.log('[CompletionService] 准备补全上下文...');
    const context: CompletionContext = {
      sshSession,
      recentCommands: await this.getRecentCommands(),
      commandHistory: await this.getCommandHistory(input),
      currentCommand: {
        name: '',
        args: [],
        options: [],
        isIncomplete: true
      }
    };
    console.log('[CompletionService] 补全上下文:', context);

    // 根据解析结果类型处理
    let suggestions: ICompletionSuggestion[] = [];
    if (parseResult.type === 'command') {
      console.log('[CompletionService] 处理单个命令补全...');
      suggestions = await this.fishCompletion.getSuggestions(parseResult, context);
    } else if (parseResult.type === 'pipeline') {
      console.log('[CompletionService] 处理管道命令补全...');
      const lastCommand = parseResult.commands[parseResult.commands.length - 1];
      if (lastCommand) {
        suggestions = await this.fishCompletion.getSuggestions(lastCommand, context);
      }
    } else if (parseResult.type === 'program') {
      console.log('[CompletionService] 处理程序命令补全...');
      if (parseResult.commands.length > 0) {
        const lastCommand = parseResult.commands[parseResult.commands.length - 1];
        console.log('[CompletionService] 使用最后一个命令进行补全:', lastCommand);
        suggestions = await this.fishCompletion.getSuggestions(lastCommand, context);
      } else {
        // 如果是空程序，创建一个空命令对象用于补全
        console.log('[CompletionService] 使用空命令进行补全');
        const emptyCommand: ShellParserTypes.Command = {
          name: input,
          args: [],
          options: [],
          redirects: []
        };
        suggestions = await this.fishCompletion.getSuggestions(emptyCommand, context);
      }
    }
    console.log('[CompletionService] 原始补全建议:', suggestions);

    // 过滤、排序并限制结果数量
    this.lastSuggestions = suggestions
      .filter(s => s.fullCommand !== input)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log('[CompletionService] 最终补全建议:', this.lastSuggestions);
    return this.lastSuggestions;
  }

  /**
   * 获取最近使用的命令
   */
  private async getRecentCommands(): Promise<string[]> {
    console.log('[CompletionService] 获取最近使用的命令...');
    try {
      const history = await this.commandHistory.search('', 10);
      const commands = history.map(item => item.command);
      console.log('[CompletionService] 获取到的最近命令:', commands);
      return commands;
    } catch (error) {
      console.error('[CompletionService] 获取历史命令失败:', error);
      return [];
    }
  }

  /**
   * 获取命令历史信息
   */
  private async getCommandHistory(command: string): Promise<CompletionContext['commandHistory']> {
    console.log('[CompletionService] 获取命令历史信息, 命令:', command);
    try {
      const results = await this.commandHistory.search(command, 1);
      console.log('[CompletionService] 命令历史搜索结果:', results);
      if (results.length > 0) {
        return {
          frequency: results[0].frequency,
          lastUsed: results[0].last_used
        };
      }
      return {
        frequency: 0,
        lastUsed: new Date(0)
      };
    } catch (error) {
      console.error('[CompletionService] 获取命令历史失败:', error);
      return {
        frequency: 0,
        lastUsed: new Date(0)
      };
    }
  }

  /**
   * 记录命令执行
   */
  public async recordCommand(
    command: string,
    context?: string,
    success: boolean = true
  ): Promise<void> {
    try {
      this.checkInitialized();

      // 记录到历史
      await this.commandHistory.addOrUpdate(command, context, success);

      // 获取最近执行的命令
      const recentCommands = await this.commandHistory.search('', 2);
      if (recentCommands.length < 2) {
        return;
      }

      // 记录命令顺序关系
      const currentId = recentCommands[0].id;
      const previousId = recentCommands[1].id;
      if (currentId && previousId) {
        await this.commandRelation.addOrUpdate(
          previousId,
          currentId,
          CommandRelationType.SEQUENCE
        );
      }

      // 重置补全状态
      this.lastInput = '';
      this.lastSuggestions = [];
    } catch (error) {
      console.error('记录命令失败:', error);
      throw error;
    }
  }

  /**
   * 设置当前选中的建议索引
   */
  public setSelectedIndex(index: number): void {
    this.selectedIndex = Math.min(index, this.lastSuggestions.length - 1);
  }

  /**
   * 接受当前的补全建议
   */
  public acceptSuggestion(): string | null {
    if (this.lastSuggestions.length > this.selectedIndex) {
      const suggestion = this.lastSuggestions[this.selectedIndex].fullCommand;
      this.lastSuggestions = [];
      this.lastInput = suggestion;
      return suggestion;
    }
    return null;
  }

  /**
   * 清除当前的补全建议
   */
  public clearSuggestion(): void {
    this.lastSuggestions = [];
    this.selectedIndex = 0;
  }

  /**
   * 更新命令执行结果
   */
  public updateCommandExecution(
    command: string,
    output: string[],
    exitCode: number
  ): void {
    this.contextAnalyzer.updateCommandExecution({
      command,
      output,
      exitCode,
      timestamp: new Date()
    });
  }
} 