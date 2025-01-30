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
  private contextAnalyzer!: EnhancedContextAnalyzer;
  private initialized: boolean = false;
  private lastInput: string = '';
  private lastSuggestions: ICompletionSuggestion[] = [];
  private selectedIndex: number = 0;

  private constructor() {
    this.shellParser = ShellParser.getInstance();
    this.fishCompletion = FishStyleCompletion.getInstance();
    this.initializeAsync();
  }

  private async initializeAsync() {
    try {
      await DatabaseService.getInstance().init();
      this.commandHistory = new CommandHistory();
      this.commandRelation = new CommandRelation();
      this.contextAnalyzer = await EnhancedContextAnalyzer.getInstance();
      this.initialized = true;
      console.log('[CompletionService] 初始化完成');
    } catch (error) {
      console.error('[CompletionService] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取补全服务实例
   */
  public static async getInstance(): Promise<CompletionService> {
    if (!CompletionService.instance) {
      CompletionService.instance = new CompletionService();
      // 等待初始化完成
      await CompletionService.instance.waitForInitialization();
    }
    return CompletionService.instance;
  }

  private async waitForInitialization(): Promise<void> {
    if (!this.initialized) {
      try {
        await new Promise<void>((resolve, reject) => {
          const checkInterval = setInterval(() => {
            if (this.initialized) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);

          // 设置超时
          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('初始化超时'));
          }, 10000); // 10秒超时
        });
      } catch (error) {
        console.error('等待初始化完成失败:', error);
        throw error;
      }
    }
  }

  /**
   * 检查服务是否已初始化
   */
  private checkInitialized() {
    if (!this.initialized) {
      throw new Error('CompletionService not initialized');
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
    console.log('[CompletionService] 开始获取补全建议:', {
      input,
      cursorPosition,
      sessionState
    });

    try {
      // 1. 获取增强的上下文
      console.log('[CompletionService] 正在获取增强上下文...');
      const enhancedContext = await this.contextAnalyzer.getEnhancedContext(
        input,
        cursorPosition,
        sessionState
      );
      console.log('[CompletionService] 获取到的增强上下文:', enhancedContext);

      // 2. 先从历史记录中查找匹配的命令
      console.log('[CompletionService] 从历史记录中查找匹配的命令...');
      const historyResults = await this.commandHistory.search(input, 10);
      const historySuggestions = historyResults
        .filter(item => item.command.toLowerCase().startsWith(input.toLowerCase()))
        .map(item => ({
          fullCommand: item.command,
          suggestion: item.command,
          source: CompletionSource.HISTORY,
          score: 0.8,
          details: {
            frequency: item.frequency,
            lastUsed: item.last_used,
            success: item.success
          }
        }));
      console.log('[CompletionService] 历史记录匹配结果:', historySuggestions);

      // 3. 获取基础补全建议
      const command = enhancedContext.currentCommand.type === 'command' 
        ? enhancedContext.currentCommand 
        : { name: input, args: [], options: [], redirects: [] };
      console.log('[CompletionService] 处理的命令对象:', command);

      console.log('[CompletionService] 正在获取Fish风格补全建议...');
      const syntaxSuggestions = await this.fishCompletion.getSuggestions(
        command,
        {
          sshSession: undefined,
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

      // 4. 过滤基础补全建议，只保留以输入为前缀的建议
      const filteredSyntaxSuggestions = syntaxSuggestions.filter(
        suggestion => suggestion.fullCommand.toLowerCase().startsWith(input.toLowerCase())
      );
      console.log('[CompletionService] 过滤后的基础补全建议:', filteredSyntaxSuggestions);

      // 5. 合并历史记录和基础补全建议
      const allSuggestions = [...historySuggestions, ...filteredSyntaxSuggestions];

      // 6. 根据增强上下文调整建议的排序和得分
      console.log('[CompletionService] 正在调整建议排序和得分...');
      const adjustedSuggestions = await this.adjustSuggestionScores(allSuggestions, input, enhancedContext);
      console.log('[CompletionService] 最终的补全建议:', adjustedSuggestions);

      // 7. 去重并限制数量
      return this.deduplicateAndLimit(adjustedSuggestions, 10);

    } catch (error) {
      console.error('[CompletionService] 获取补全建议失败:', error);
      return [];
    }
  }

  /**
   * 去重并限制建议数量
   */
  private deduplicateAndLimit(suggestions: ICompletionSuggestion[], limit: number): ICompletionSuggestion[] {
    // 使用 Map 来去重，保留得分最高的
    const uniqueMap = new Map<string, ICompletionSuggestion>();
    
    for (const suggestion of suggestions) {
      const existing = uniqueMap.get(suggestion.fullCommand);
      if (!existing || existing.score < suggestion.score) {
        uniqueMap.set(suggestion.fullCommand, suggestion);
      }
    }
    
    // 转换回数组并按得分排序
    return Array.from(uniqueMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * 调整建议得分
   */
  private async adjustSuggestionScores(
    suggestions: ICompletionSuggestion[],
    input: string,
    context: EnhancedCompletionContext
  ): Promise<ICompletionSuggestion[]> {
    console.log('[CompletionService] 开始调整建议得分...');
    
    const adjustedSuggestions = await Promise.all(
      suggestions.map(async (suggestion) => {
        // 1. 计算基础得分
        let finalScore = suggestion.score;

        // 2. 获取命令历史信息
        const historyInfo = await this.getCommandHistory(suggestion.suggestion);
        
        // 3. 计算上下文得分
        const contextScore = this.calculateContextScore(suggestion, context);
        
        // 4. 计算命令链得分
        const chainScore = this.calculateChainScore(suggestion, context);
        
        // 5. 计算时间模式得分
        const timeScore = this.calculateTimeScore(suggestion, context);

        // 6. 计算环境状态得分
        const envScore = this.calculateEnvironmentScore(suggestion, context);

        console.log('[CompletionService] 最终得分计算:', {
          suggestion: suggestion.suggestion,
          baseScore: suggestion.score,
          chainScore,
          timeScore,
          contextScore,
          envScore,
          historyInfo
        });

        // 7. 根据不同来源调整权重
        const weights = {
          base: 0.1,      // 基础得分权重进一步降低
          history: 0.5,   // 历史使用权重进一步提高
          context: 0.15,  // 上下文相关度权重
          chain: 0.15,    // 命令链权重
          time: 0.05,     // 时间模式权重
          env: 0.05       // 环境状态权重
        };

        // 8. 计算最终得分
        const timeSinceLastUse = historyInfo.lastUsed ? 
          (Date.now() - new Date(historyInfo.lastUsed).getTime()) / (1000 * 60) : // 转换为分钟
          Number.MAX_VALUE;

        // 最近使用的命令获得更高的额外加分
        const recentBonus = timeSinceLastUse < 5 ? 0.5 : // 5分钟内使用过
                           timeSinceLastUse < 30 ? 0.3 : // 30分钟内使用过
                           timeSinceLastUse < 60 ? 0.2 : // 1小时内使用过
                           0;

        // 根据来源调整基础分数
        const sourceBonus = suggestion.source === CompletionSource.HISTORY ? 0.3 : 0;

        finalScore = (
          suggestion.score * weights.base +
          (historyInfo.frequency / 10) * weights.history +
          contextScore * weights.context +
          chainScore * weights.chain +
          timeScore * weights.time +
          envScore * weights.env +
          recentBonus +  // 加入最近使用的额外得分
          sourceBonus    // 加入来源的额外得分
        );

        console.log('[CompletionService] 建议得分调整:', {
          suggestion: suggestion.suggestion,
          originalScore: suggestion.score,
          adjustedScore: finalScore
        });

        return {
          ...suggestion,
          score: finalScore,
          details: {
            frequency: historyInfo.frequency,
            lastUsed: historyInfo.lastUsed,
            contextScore,
            chainScore,
            timeScore,
            envScore
          }
        };
      })
    );

    // 9. 按最终得分排序
    return adjustedSuggestions.sort((a, b) => b.score - a.score);
  }

  /**
   * 计算上下文得分
   */
  private calculateContextScore(
    suggestion: ICompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    // 根据当前目录、最近文件等计算上下文相关度
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

  /**
   * 计算命令链得分
   */
  private calculateChainScore(
    suggestion: ICompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    // 根据命令使用顺序计算得分
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

  /**
   * 计算时间模式得分
   */
  private calculateTimeScore(
    suggestion: ICompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    // 根据命令使用的时间模式计算得分
    let score = 0;

    // 获取当前小时
    const currentHour = new Date().getHours();
    
    // 如果建议在当前时间段经常使用，增加得分
    if (this.isCommandFrequentInTimeRange(suggestion.suggestion, currentHour)) {
      score += 0.2;
    }

    return score;
  }

  /**
   * 计算环境状态得分
   */
  private calculateEnvironmentScore(
    suggestion: ICompletionSuggestion,
    context: EnhancedCompletionContext
  ): number {
    // 根据当前环境状态计算得分
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

  /**
   * 检查两个命令是否相关
   */
  private areCommandsRelated(cmd1: CommandExecutionResult | string, cmd2: string): boolean {
    // 这里可以实现更复杂的命令关联性检查逻辑
    // 当前简单实现：检查命令是否属于同一类别
    const getCommandCategory = (cmd: CommandExecutionResult | string) => {
      const cmdStr = typeof cmd === 'string' ? cmd : cmd.command;
      if (cmdStr.startsWith('git')) return 'git';
      if (cmdStr.startsWith('docker')) return 'docker';
      if (cmdStr.match(/^(ls|cd|pwd|mkdir|rm|cp|mv)/)) return 'file';
      return 'other';
    };

    return getCommandCategory(cmd1) === getCommandCategory(cmd2);
  }

  /**
   * 检查命令在指定时间范围内是否经常使用
   */
  private isCommandFrequentInTimeRange(command: string, hour: number): boolean {
    // 这里可以实现更复杂的时间模式检查逻辑
    // 当前简单实现：根据命令类型判断是否适合当前时间
    if (hour >= 9 && hour <= 18) {
      // 工作时间
      return command.match(/^(git|docker|npm|yarn)/) !== null;
    } else {
      // 非工作时间
      return command.match(/^(ls|cd|cat)/) !== null;
    }
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
    console.log('[CompletionService] 接受补全建议, 当前索引:', this.selectedIndex);
    console.log('[CompletionService] 当前建议列表:', this.lastSuggestions);

    if (!this.lastSuggestions || this.lastSuggestions.length === 0) {
      console.log('[CompletionService] 没有可用的建议');
      return null;
    }

    if (this.selectedIndex < 0 || this.selectedIndex >= this.lastSuggestions.length) {
      console.log('[CompletionService] 选中索引超出范围');
      this.selectedIndex = 0;
    }

    const suggestion = this.lastSuggestions[this.selectedIndex];
    if (!suggestion) {
      console.log('[CompletionService] 未找到选中的建议');
      return null;
    }

    console.log('[CompletionService] 接受建议:', suggestion.fullCommand);
    this.lastSuggestions = [];
    this.lastInput = suggestion.fullCommand;
    return suggestion.fullCommand;
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