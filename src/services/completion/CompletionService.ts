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

  public async getSuggestions(
    input: string,
    cursorPosition: number,
    sessionState: SessionState
  ): Promise<CompletionSuggestion[]> {
    const startTime = performance.now();
    console.log('[CompletionService] 开始获取补全建议:', {
      input,
      cursorPosition,
      sessionState
    });

    try {
      // 1. 获取增强的上下文
      const contextStartTime = performance.now();
      console.log('[CompletionService] 正在获取增强上下文...');
      const enhancedContext = await this.contextAnalyzer.getEnhancedContext(
        input,
        cursorPosition,
        sessionState
      );
      const contextEndTime = performance.now();
      console.log('[CompletionService] 获取增强上下文完成, 耗时:', (contextEndTime - contextStartTime).toFixed(2), 'ms');
      console.log('[CompletionService] 获取到的增强上下文:', enhancedContext);

      // 2. 从历史记录中查找匹配的命令
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

      // 3. 获取基础补全建议
      const command = enhancedContext.currentCommand.type === 'command' 
        ? enhancedContext.currentCommand 
        : { name: input, args: [], options: [], redirects: [] };
      console.log('[CompletionService] 处理的命令对象:', command);

      const fishStartTime = performance.now();
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
      const fishEndTime = performance.now();
      console.log('[CompletionService] Fish风格补全完成, 耗时:', (fishEndTime - fishStartTime).toFixed(2), 'ms');

      // 4. 过滤基础补全建议
      const filterStartTime = performance.now();
      const filteredSyntaxSuggestions = syntaxSuggestions.filter(
        suggestion => suggestion.fullCommand.toLowerCase().startsWith(input.toLowerCase())
      );
      const filterEndTime = performance.now();
      console.log('[CompletionService] 过滤补全建议完成, 耗时:', (filterEndTime - filterStartTime).toFixed(2), 'ms');
      console.log('[CompletionService] 过滤后的基础补全建议:', filteredSyntaxSuggestions);

      // 5. 合并历史记录和基础补全建议
      const allSuggestions = [...historySuggestions, ...filteredSyntaxSuggestions];

      // 6. 使用ScoringService调整建议的排序和得分
      const scoringStartTime = performance.now();
      console.log('[CompletionService] 正在调整建议排序和得分...');
      const adjustedSuggestions = await this.scoringService.adjustSuggestionScores(
        allSuggestions,
        input,
        enhancedContext
      );
      const scoringEndTime = performance.now();
      console.log('[CompletionService] 调整排序和得分完成, 耗时:', (scoringEndTime - scoringStartTime).toFixed(2), 'ms');

      // 7. 去重并限制数量
      const dedupeStartTime = performance.now();
      const finalSuggestions = this.scoringService.deduplicateAndLimit(adjustedSuggestions, 10);
      const dedupeEndTime = performance.now();
      console.log('[CompletionService] 去重和限制数量完成, 耗时:', (dedupeEndTime - dedupeStartTime).toFixed(2), 'ms');

      const endTime = performance.now();
      console.log('[CompletionService] 获取补全建议完成, 总耗时:', (endTime - startTime).toFixed(2), 'ms', {
        '增强上下文耗时': (contextEndTime - contextStartTime).toFixed(2),
        '历史记录查询耗时': (historyEndTime - historyStartTime).toFixed(2),
        'Fish补全耗时': (fishEndTime - fishStartTime).toFixed(2),
        '过滤耗时': (filterEndTime - filterStartTime).toFixed(2),
        '打分耗时': (scoringEndTime - scoringStartTime).toFixed(2),
        '去重耗时': (dedupeEndTime - dedupeStartTime).toFixed(2)
      });

      return finalSuggestions;

    } catch (error) {
      const endTime = performance.now();
      console.error('[CompletionService] 获取补全建议失败, 总耗时:', (endTime - startTime).toFixed(2), 'ms, 错误:', error);
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
} 