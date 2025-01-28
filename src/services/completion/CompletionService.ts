import { CommandHistory, ICommandHistory } from '../database/models/CommandHistory';
import { CommandRelation, CommandRelationType } from '../database/models/CommandRelation';
import { DatabaseService } from '../database/DatabaseService';
import debounce from 'lodash/debounce';

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
  private lastInput: string = '';
  private lastSuggestions: ICompletionSuggestion[] = [];
  private initialized: boolean = false;

  private constructor() {
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
   * 获取实时补全建议
   * @param input 当前输入的命令
   * @returns 补全建议列表,按得分排序,最多返回3个建议
   */
  public async getSuggestions(input: string): Promise<ICompletionSuggestion[]> {
    console.log('Getting suggestions for input:', input);
    
    // 如果输入为空,返回空数组
    if (!input) {
      console.log('Empty input or same as last input, returning empty array');
      return [];
    }

    this.lastInput = input;
    
    // 获取所有可能的补全
    const suggestions = await this.getAllSuggestions(input);
    console.log('Got suggestions:', suggestions);
    
    // 按得分排序并获取前3个最佳建议
    const bestSuggestions = suggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .filter(s => s.fullCommand !== input); // 过滤掉与输入完全相同的建议
    
    // 如果没有有效建议,返回空数组
    if (bestSuggestions.length === 0) {
      console.log('No valid suggestions found, returning empty array');
      this.lastSuggestions = [];
      return [];
    }

    // 为每个建议计算补全部分
    const processedSuggestions = bestSuggestions.map(suggestion => ({
      ...suggestion,
      suggestion: suggestion.fullCommand.slice(input.length)
    }));
    
    this.lastSuggestions = processedSuggestions;
    console.log('Returning suggestions:', processedSuggestions);
    return processedSuggestions;
  }

  /**
   * 获取所有可能的补全建议
   */
  private async getAllSuggestions(input: string): Promise<ICompletionSuggestion[]> {
    const suggestions: ICompletionSuggestion[] = [];

    // 1. 从历史记录中查找
    const historyResults = await this.getHistoryCompletions(input);
    suggestions.push(...historyResults);

    // 2. 从关联命令中查找
    const relationResults = await this.getRelationCompletions(input);
    suggestions.push(...relationResults);

    // 3. 从本地补全中查找
    const localResults = await this.getLocalCompletions(input);
    suggestions.push(...localResults);

    return suggestions;
  }

  /**
   * 从历史记录中获取补全建议
   */
  private async getHistoryCompletions(input: string): Promise<ICompletionSuggestion[]> {
    const results = await this.commandHistory.search(input);
    return results.map(item => ({
      fullCommand: item.command,
      suggestion: item.command.slice(input.length),
      source: CompletionSource.HISTORY,
      score: this.calculateHistoryScore(item)
    }));
  }

  /**
   * 计算历史记录的得分
   * 基于使用频率和最后使用时间
   */
  private calculateHistoryScore(item: ICommandHistory): number {
    const frequencyScore = Math.min(item.frequency / 10, 1); // 最高1分
    const timeScore = Math.max(0, 1 - this.getDaysDifference(item.last_used) / 30); // 最近30天内,最高1分
    return frequencyScore * 0.7 + timeScore * 0.3; // 频率权重0.7,时间权重0.3
  }

  /**
   * 获取与当前日期的天数差
   */
  private getDaysDifference(date: Date): number {
    const diffTime = Math.abs(new Date().getTime() - date.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  /**
   * 从关联命令中获取补全建议
   */
  private async getRelationCompletions(input: string): Promise<ICompletionSuggestion[]> {
    const historyResults = await this.commandHistory.search(input, 1);
    if (historyResults.length === 0 || !historyResults[0].id) {
      return [];
    }

    const relations = await this.commandRelation.getRelated(
      historyResults[0].id,
      CommandRelationType.SIMILAR
    );

    const suggestions: ICompletionSuggestion[] = [];
    for (const relation of relations) {
      const commandId = relation.command1_id === historyResults[0].id
        ? relation.command2_id
        : relation.command1_id;

      const results = await this.commandHistory.search(`id = ${commandId}`);
      if (results.length > 0) {
        suggestions.push({
          fullCommand: results[0].command,
          suggestion: results[0].command.slice(input.length),
          source: CompletionSource.RELATION,
          score: 0.5 + (relation.frequency / 20) // 基础分0.5,最高加0.5
        });
      }
    }

    return suggestions;
  }

  /**
   * 获取本地补全建议
   * 这里先返回空数组,后续实现具体的本地补全逻辑
   */
  private async getLocalCompletions(input: string): Promise<ICompletionSuggestion[]> {
    return [];
  }

  /**
   * 记录命令执行
   * @param command 执行的命令
   * @param context 执行上下文
   * @param success 是否执行成功
   */
  public async recordCommand(
    command: string,
    context?: string,
    success: boolean = true
  ): Promise<void> {
    console.log('CompletionService.recordCommand called:', { command, context, success });
    
    try {
      this.checkInitialized();
      console.log('Service initialized check passed');

      // 记录到历史
      await this.commandHistory.addOrUpdate(command, context, success);
      console.log('Command recorded to history successfully');

      // 获取最近执行的命令
      const recentCommands = await this.commandHistory.search('', 2);
      console.log('Recent commands:', recentCommands);

      if (recentCommands.length < 2) {
        console.log('Not enough recent commands to record relation');
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
        console.log('Command relation recorded successfully');
      }

      // 重置补全状态
      this.lastInput = '';
      this.lastSuggestions = [];
    } catch (error) {
      console.error('Error in recordCommand:', error);
      throw error;
    }
  }

  /**
   * 接受当前的补全建议
   * @param index 要接受的建议索引,默认为0(第一个建议)
   */
  public acceptSuggestion(index: number = 0): string | null {
    if (this.lastSuggestions.length > index) {
      const suggestion = this.lastSuggestions[index].fullCommand;
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
  }
} 