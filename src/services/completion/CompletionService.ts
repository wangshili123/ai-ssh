import { CommandHistory } from '../database/models/CommandHistory';
import { CommandRelation, CommandRelationType } from '../database/models/CommandRelation';
import { DatabaseService } from '../database/DatabaseService';
import { ShellParser } from '../parser/ShellParser';
import { ShellParserTypes } from '../parser/ShellParserTypes';
import { FishStyleCompletion } from './FishStyleCompletion';
import { CompletionContext, CompletionSource, CompletionSuggestion } from './types/completion.types';
import { EnhancedContextAnalyzer } from './analyzers/EnhancedContextAnalyzer';
import { SessionState } from './core/types/context.types';
import { ScoringService } from './scoring/ScoringService';
import { SSHSession } from './SSHCompletion';
import { SSHConnectionManager } from '../ssh/SSHConnectionManager';
import { CompletionSSHManager } from './CompletionSSHManager';

export class CompletionService {
  private static instance: CompletionService;
  private commandHistory!: CommandHistory;
  private commandRelation!: CommandRelation;
  private shellParser: ShellParser;
  private fishCompletion: FishStyleCompletion;
  private contextAnalyzer!: EnhancedContextAnalyzer;
  private scoringService: ScoringService;
  private initialized: boolean = false;
  private lastInput: string = '';
  private lastSuggestions: CompletionSuggestion[] = [];
  private selectedIndex: number = 0;

  private constructor() {
    this.shellParser = ShellParser.getInstance();
    this.fishCompletion = FishStyleCompletion.getInstance();
    this.scoringService = ScoringService.getInstance();
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

  public static async getInstance(): Promise<CompletionService> {
    if (!CompletionService.instance) {
      CompletionService.instance = new CompletionService();
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

          setTimeout(() => {
            clearInterval(checkInterval);
            reject(new Error('初始化超时'));
          }, 10000);
        });
      } catch (error) {
        console.error('等待初始化完成失败:', error);
        throw error;
      }
    }
  }

  private checkInitialized() {
    if (!this.initialized) {
      throw new Error('CompletionService not initialized');
    }
  }

  /**
   * 获取补全建议
   */
  public async getSuggestions(params: {
    input: string;
    cursorPosition: number;
    sessionState: SessionState;
    tabId: string;
  }): Promise<CompletionSuggestion[]> {
    this.checkInitialized();
    await this.waitForInitialization();

    const { input, cursorPosition, sessionState, tabId } = params;
    
    // 创建上下文对象
    const context: CompletionContext = {
      tabId,
      sshSession: await this.getSSHSession(sessionState),
      recentCommands: [],
      commandHistory: {
        frequency: 0,
        lastUsed: new Date()
      },
      currentCommand: {
        name: '',
        args: [],
        options: [],
        isIncomplete: true
      }
    };

    console.log('[CompletionService] 开始获取补全建议:', params);

    const hasSession = sessionState && sessionState.currentWorkingDirectory !== undefined;
    console.log('[CompletionService] SSH 会话状态:', { hasSession });

    const startTime = performance.now();

    // 获取增强上下文
    console.log('[CompletionService] 正在获取增强上下文...');
    const enhancedContext = await this.contextAnalyzer.getEnhancedContext(
      input,
      cursorPosition,
      sessionState
    );

    // 如果解析出的命令存在，添加原始输入的空格信息
    if (enhancedContext.currentCommand.type === 'program' && enhancedContext.currentCommand.commands.length > 0) {
      const command = enhancedContext.currentCommand.commands[0];
      command.hasTrailingSpace = input.endsWith(' ');
      console.log('[CompletionService] 设置命令尾部空格状态:', command.hasTrailingSpace);
    }

    console.log('[CompletionService] 获取增强上下文完成, 耗时:', performance.now() - startTime, 'ms');
    console.log('[CompletionService] 获取到的增强上下文:', enhancedContext);

    // 从历史记录中查找匹配的命令
    const historyStartTime = performance.now();
    console.log('[CompletionService] 从历史记录中查找匹配的命令...');
    const historyResults = await this.commandHistory.search(input, 10);
    const historySuggestions = historyResults
      .filter(item => item.command.toLowerCase().startsWith(input.toLowerCase()))
      .map(item => ({
        fullCommand: item.command,
        suggestion: item.command,
        source: CompletionSource.HISTORY,
        score: 0.8
      }));
    const historyEndTime = performance.now();
    console.log('[CompletionService] 历史记录匹配完成, 耗时:', (historyEndTime - historyStartTime).toFixed(2), 'ms');
    console.log('[CompletionService] 历史记录匹配结果:', historySuggestions);

    // 获取基础补全建议
    const command = enhancedContext.currentCommand.type === 'command' 
      ? {
          ...enhancedContext.currentCommand,
          name: enhancedContext.currentCommand.name,
          hasTrailingSpace: input.endsWith(' ')
        }
      : (() => {
          const parts = input.trim().split(/\s+/);
          return { 
            name: parts[0] || '', 
            args: parts.slice(1), 
            options: [], 
            redirects: [],
            hasTrailingSpace: input.endsWith(' ')
          };
        })();
    console.log('[CompletionService] 处理的命令对象:', command);

    const fishStartTime = performance.now();
    console.log('[CompletionService] 正在获取Fish风格补全建议...');
    const syntaxSuggestions = await this.fishCompletion.getSuggestions(
      command,
      {
        tabId,
        sshSession: hasSession ? {
          execute: async (command: string) => {
            console.log('[CompletionService] 执行 SSH 命令:', command);
            const result = await SSHConnectionManager.getInstance().executeCurrentSessionCommand(command);
            console.log('[CompletionService] SSH 命令执行结果:', result);
            return {
              stdout: result.stdout,
              stderr: result.stderr
            };
          },
          getCurrentDirectory: async () => {
            console.log('[CompletionService] 获取当前目录');
            const currentDirectory = CompletionSSHManager.getInstance().getCurrentDirectoryN();
            console.log('[CompletionService] 当前目录:', currentDirectory);
            return currentDirectory;
          },
          getEnvironmentVars: async () => {
            console.log('[CompletionService] 获取环境变量');
            const result = await SSHConnectionManager.getInstance().executeCurrentSessionCommand('env');
            const vars: Record<string, string> = {};
            result.stdout.split('\n').forEach((line: string) => {
              const [key, ...values] = line.split('=');
              if (key) vars[key] = values.join('=');
            });
            console.log('[CompletionService] 环境变量:', vars);
            return vars;
          }
        } : undefined,
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
    const fishEndTime = performance.now();
    console.log('[CompletionService] Fish风格补全完成, 耗时:', (fishEndTime - fishStartTime).toFixed(2), 'ms');
    console.log('[CompletionService] Fish风格补全建议:', syntaxSuggestions);

    // 过滤基础补全建议
    const filterStartTime = performance.now();
    const filteredSyntaxSuggestions = syntaxSuggestions.filter(suggestion => {
      // 如果输入以空格结尾，说明是在补全参数，不需要过滤
      if (input.endsWith(' ')) {
        return true;
      }
      // 否则按照命令前缀过滤
      return suggestion.fullCommand.toLowerCase().startsWith(input.toLowerCase());
    });
    const filterEndTime = performance.now();
    console.log('[CompletionService] 过滤补全建议完成, 耗时:', (filterEndTime - filterStartTime).toFixed(2), 'ms');
    console.log('[CompletionService] 过滤后的基础补全建议:', filteredSyntaxSuggestions);

    // 合并历史记录和基础补全建议
    const allSuggestions = [...historySuggestions, ...filteredSyntaxSuggestions];
    console.log('[CompletionService] 合并后的所有建议:', allSuggestions);

    // 使用ScoringService调整建议的排序和得分
    const scoringStartTime = performance.now();
    console.log('[CompletionService] 正在调整建议排序和得分...');
    const adjustedSuggestions = await this.scoringService.adjustSuggestionScores(
      allSuggestions,
      input,
      enhancedContext
    );
    const scoringEndTime = performance.now();
    console.log('[CompletionService] 调整排序和得分完成, 耗时:', (scoringEndTime - scoringStartTime).toFixed(2), 'ms');
    console.log('[CompletionService] 调整后的建议:', adjustedSuggestions);

    // 去重并限制数量
    const dedupeStartTime = performance.now();
    const finalSuggestions = this.scoringService.deduplicateAndLimit(adjustedSuggestions, 3);
    const dedupeEndTime = performance.now();
    console.log('[CompletionService] 去重和限制数量完成, 耗时:', (dedupeEndTime - dedupeStartTime).toFixed(2), 'ms');
    console.log('[CompletionService] 最终补全建议:', finalSuggestions);

    const endTime = performance.now();
    console.log('[CompletionService] 获取补全建议完成, 总耗时:', (endTime - startTime).toFixed(2), 'ms', {
      '增强上下文耗时': (performance.now() - startTime).toFixed(2),
      '历史记录查询耗时': (historyEndTime - historyStartTime).toFixed(2),
      'Fish补全耗时': (fishEndTime - fishStartTime).toFixed(2),
      '过滤耗时': (filterEndTime - filterStartTime).toFixed(2),
      '打分耗时': (scoringEndTime - scoringStartTime).toFixed(2),
      '去重耗时': (dedupeEndTime - dedupeStartTime).toFixed(2)
    });

    return finalSuggestions;
  }

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

  public setSelectedIndex(index: number): void {
    this.selectedIndex = Math.min(index, this.lastSuggestions.length - 1);
  }

  public acceptSuggestion(): string | null {
    if (!this.lastSuggestions || this.lastSuggestions.length === 0) {
      return null;
    }

    if (this.selectedIndex < 0 || this.selectedIndex >= this.lastSuggestions.length) {
      this.selectedIndex = 0;
    }

    const suggestion = this.lastSuggestions[this.selectedIndex];
    if (!suggestion) {
      return null;
    }

    this.lastSuggestions = [];
    this.lastInput = suggestion.fullCommand;
    return suggestion.fullCommand;
  }

  public clearSuggestion(): void {
    this.lastSuggestions = [];
    this.selectedIndex = 0;
  }

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

  private async getSSHSession(sessionState: SessionState): Promise<SSHSession | undefined> {
    try {
      const sshManager = SSHConnectionManager.getInstance();

      return {
        execute: async (command: string) => {
          const result = await sshManager.executeCurrentSessionCommand(command);
          return {
            stdout: result.stdout,
            stderr: result.stderr
          };
        },
        getCurrentDirectory: async () => {
          const currentDirectory = CompletionSSHManager.getInstance().getCurrentDirectoryN();
          console.log('[CompletionService] 当前目录:', currentDirectory);
          return currentDirectory;
        },
        getEnvironmentVars: async () => {
          const result = await sshManager.executeCurrentSessionCommand('env');
          const vars: Record<string, string> = {};
          result.stdout.split('\n').forEach((line: string) => {
            const [key, ...values] = line.split('=');
            if (key) vars[key] = values.join('=');
          });
          console.log('[CompletionService] 环境变量:', vars);
          return vars;
        }
      };
    } catch (error) {
      console.error('[CompletionService] 获取 SSH 会话失败:', error);
      return undefined;
    }
  }
} 