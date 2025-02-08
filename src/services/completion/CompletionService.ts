import { CommandHistory } from '../database/models/CommandHistory';
import { CommandRelation, CommandRelationType } from '../database/models/CommandRelation';
import { DatabaseService } from '../database/DatabaseService';
import { ShellParser } from '../parser/ShellParser';
import { ShellParserTypes } from '../parser/ShellParserTypes';
import { FishStyleCompletion } from './FishStyleCompletion';
import { CompletionContext, CompletionSource, CompletionSuggestion, AICompletionResult } from './types/completion.types';
import { EnhancedContextAnalyzer } from './analyzers/EnhancedContextAnalyzer';
import { SessionState, EnhancedContext } from './core/types/context.types';
import { ScoringService } from './scoring/ScoringService';
import { SSHSession } from './SSHCompletion';
import { SSHConnectionManager } from '../ssh/SSHConnectionManager';
import { CompletionSSHManager } from './CompletionSSHManager';
import { SuggestionCache } from './cache/SuggestionCache';
import { AnalysisScheduler } from './learning/analyzer/AnalysisScheduler';
import { AIAnalyzer } from './learning/analyzer/ai/AIAnalyzer';

export class CompletionService {
  private static instance: CompletionService;
  private commandHistory!: CommandHistory;
  private commandRelation!: CommandRelation;
  private shellParser: ShellParser;
  private fishCompletion: FishStyleCompletion;
  private contextAnalyzer!: EnhancedContextAnalyzer;
  private scoringService: ScoringService;
  private suggestionCache: SuggestionCache;
  private initialized: boolean = false;
  private lastInput: string = '';
  private lastSuggestions: CompletionSuggestion[] = [];
  private selectedIndex: number = 0;
  private dbService: DatabaseService;

  private constructor() {
    this.shellParser = ShellParser.getInstance();
    this.fishCompletion = FishStyleCompletion.getInstance();
    this.scoringService = ScoringService.getInstance();
    this.suggestionCache = SuggestionCache.getInstance();
    this.dbService = DatabaseService.getInstance();
    this.initializeAsync();
  }

  private async initializeAsync() {
    try {
      // 检查数据库是否已初始化
      const dbService = DatabaseService.getInstance();
      if (!dbService.isInitialized()) {
        throw new Error('数据库未初始化');
      }

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
    await this.waitForInitialization();
    this.checkInitialized();

    // 1. 获取增强上下文
    const enhancedContext = await this.contextAnalyzer.getEnhancedContext(
      params.input,
      params.cursorPosition,
      params.sessionState
    );

    // 转换为简化的上下文
    const simplifiedContext: EnhancedContext = {
      sshSession: await this.getSSHSession(params.sessionState),
      currentDirectory: enhancedContext.environment.currentDirectory,
      shellType: params.sessionState.shellType,
      commandHistory: {
        recent: enhancedContext.commandHistory.recent.map(cmd => ({
          command: cmd.command,
          timestamp: cmd.timestamp.toISOString(),
          success: cmd.exitCode === 0
        })),
        statistics: enhancedContext.commandHistory.statistics.map(stat => ({
          command: stat.command,
          frequency: stat.frequency,
          lastUsed: stat.lastUsed
        }))
      },
      environmentVars: params.sessionState.environment
    };
    
    // 2. 检查补全结果缓存
    const cachedSuggestions = this.suggestionCache.getSuggestions(
      params.input,
      simplifiedContext
    );
    if (cachedSuggestions) {
      this.lastSuggestions = cachedSuggestions;
      return cachedSuggestions;
    }

    // 3. 并行获取各类补全建议
    const [historySuggestions, syntaxSuggestions, aiSuggestions] = await Promise.all([
      this.getHistorySuggestions(params.input),
      this.getSyntaxSuggestions(params.input, simplifiedContext),
      this.getAICompletions(params.input, simplifiedContext)
    ]);

    // 4. 合并所有建议
    const allSuggestions = [
      ...historySuggestions.map(s => ({ ...s, source: CompletionSource.HISTORY })),
      ...syntaxSuggestions.map(s => ({ ...s, source: CompletionSource.SYNTAX })),
      ...aiSuggestions.map(s => ({ ...s, source: CompletionSource.AI }))
    ];

    // 5. 使用评分服务进行评分和排序
    const rankedSuggestions = await this.scoringService.adjustSuggestionScores(
      allSuggestions,
      params.input,
      simplifiedContext
    );
    console.log('[CompletionService] 合并所有建议:', rankedSuggestions);
    // 6. 去重和限制数量
    const finalSuggestions = this.scoringService.deduplicateAndLimit(rankedSuggestions, 3);

    // 7. 缓存结果
    this.suggestionCache.setSuggestions(
      params.input,
      simplifiedContext,
      finalSuggestions
    );

    this.lastSuggestions = finalSuggestions;
    return finalSuggestions;
  }

  /**
   * 获取历史记录建议
   */
  private async getHistorySuggestions(input: string): Promise<CompletionSuggestion[]> {
    const historyResults = await this.commandHistory.search(input, 10);
    return historyResults
      .filter(item => item.command.toLowerCase().startsWith(input.toLowerCase()))
      .map(item => ({
        fullCommand: item.command,
        suggestion: item.command,
        source: CompletionSource.HISTORY,
        score: 0.8
      }));
  }

  /**
   * 获取语法建议
   */
  private async getSyntaxSuggestions(
    input: string,
    context: EnhancedContext
  ): Promise<CompletionSuggestion[]> {
    const command = {
      name: input.split(' ')[0] || '',
      args: input.split(' ').slice(1),
      options: [],
      redirects: [],
      hasTrailingSpace: input.endsWith(' ')
    };

    const suggestions = await this.fishCompletion.getSuggestions(command, {
      tabId: 'default',
      sshSession: context.sshSession,
      recentCommands: context.commandHistory?.recent.map(r => r.command) || [],
      commandHistory: {
        frequency: context.commandHistory?.statistics[0]?.frequency || 0,
        lastUsed: context.commandHistory?.statistics[0]?.lastUsed || new Date()
      },

      currentCommand: {
        name: command.name,
        args: command.args,
        options: [],
        isIncomplete: true
      }
    });
    console.log('[CompletionService] 获取语法建议:', suggestions);
    return suggestions.filter(suggestion => {
      if (input.endsWith(' ')) {
        return true;
      }
      return suggestion.fullCommand.toLowerCase().startsWith(input.toLowerCase());
    });
  }

  /**
   * 获取基于规则的智能建议
   */
  // private async getIntelligentSuggestions(
  //   input: string,
  //   context: EnhancedContext
  // ): Promise<CompletionSuggestion[]> {
  //    // 1. 获取匹配的规则
  //    const { rules, scores } = this.ruleCache.getMatchingRules(input, context);
    
  //    // 2. 转换为补全建议
  //    return rules.map(rule => ({
  //      fullCommand: rule.pattern,
  //      suggestion: rule.pattern.slice(input.length),
  //      source: CompletionSource.RULE,
  //      score: scores.get(rule.id) || 0
  //    }));
 
  // }

  /**
   * 获取AI分析的补全建议
   */
  private async getAICompletions(
    input: string,
    context: EnhancedContext
  ): Promise<CompletionSuggestion[]> {
    try {
      // 获取AI补全建议
      const aiAnalyzer = AIAnalyzer.getInstance();
      const aiSuggestions = await aiAnalyzer.getCompletions(input, context);
      
      return aiSuggestions;
    } catch (error) {
      console.error('[CompletionService] Failed to get intelligent suggestions:', error);
      return [];
    }
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