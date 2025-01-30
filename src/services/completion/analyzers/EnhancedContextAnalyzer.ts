import { 
  EnhancedCompletionContext, 
  CommandExecutionResult, 
  EnvironmentState, 
  SessionState
} from './types/context.types';
import { EnhancedPatterns } from './types/patterns.types';
import { ShellParserTypes } from '../../parser/ShellParserTypes';
import { ShellParser } from '../../parser/ShellParser';
import { CommandHistory, ICommandHistory } from '../../database/models/CommandHistory';
import { DatabaseService } from '../../database/DatabaseService';
import { ArgumentPatternAnalyzer } from './patterns/ArgumentPatternAnalyzer';
import { DirectoryPatternAnalyzer } from './patterns/DirectoryPatternAnalyzer';
import { FileTypePatternAnalyzer } from './patterns/FileTypePatternAnalyzer';
import { ErrorCorrectionAnalyzer } from './patterns/ErrorCorrectionAnalyzer';
import { CommandExecutor } from './execution/CommandExecutor';

/**
 * 增强的上下文分析器
 */
export class EnhancedContextAnalyzer {
  private static instance: EnhancedContextAnalyzer;
  private shellParser: ShellParser;
  private commandHistory!: CommandHistory;
  private initialized: boolean = false;
  
  // 记录最近的命令执行结果
  private recentCommands: CommandExecutionResult[] = [];
  // 记录命令统计信息
  private commandStats: Map<string, { frequency: number; lastUsed: Date; outputs: string[] }> = new Map();
  // 记录用户行为模式
  private userPatterns: {
    commandChains: Record<string, {
      nextCommands: Record<string, number>;
      frequency: number;
      lastUsed: Date;
    }>;
    timePatterns: Record<number, Record<string, number>>;
    contextPatterns: Record<string, Record<string, number>>;
  } = {
    commandChains: {},
    timePatterns: {},
    contextPatterns: {}
  };

  // 分析器实例
  private argumentAnalyzer: ArgumentPatternAnalyzer;
  private directoryAnalyzer: DirectoryPatternAnalyzer;
  private fileTypeAnalyzer: FileTypePatternAnalyzer;
  private errorCorrectionAnalyzer: ErrorCorrectionAnalyzer;
  private commandExecutor: CommandExecutor;

  // 添加环境状态缓存
  private environmentCache: Map<string, {
    state: EnvironmentState;
    timestamp: number;
  }> = new Map();

  private readonly ENV_CACHE_EXPIRY = 5000; // 5秒缓存过期

  private constructor() {
    this.shellParser = ShellParser.getInstance();
    this.argumentAnalyzer = ArgumentPatternAnalyzer.getInstance();
    this.directoryAnalyzer = DirectoryPatternAnalyzer.getInstance();
    this.fileTypeAnalyzer = FileTypePatternAnalyzer.getInstance();
    this.errorCorrectionAnalyzer = ErrorCorrectionAnalyzer.getInstance();
    this.commandExecutor = CommandExecutor.getInstance();
    this.initializeAsync();
  }

  private async initializeAsync() {
    try {
      await DatabaseService.getInstance().init();
      this.commandHistory = new CommandHistory();
      this.initialized = true;
      await this.loadHistoryFromDatabase();
    } catch (error) {
      console.error('初始化上下文分析器失败:', error);
      throw error;
    }
  }

  private async loadHistoryFromDatabase() {
    try {
      const history = await this.commandHistory.search('', 100);
      
      history.forEach((record: ICommandHistory) => {
        this.commandStats.set(record.command, {
          frequency: record.frequency,
          lastUsed: record.last_used,
          outputs: record.outputs || []
        });

        this.recentCommands.push({
          command: record.command,
          output: record.outputs || [],
          exitCode: record.success ? 0 : 1,
          timestamp: record.last_used
        });
      });

      console.log('[EnhancedContextAnalyzer] 从数据库加载了历史记录:', {
        historyCount: history.length,
        statsCount: this.commandStats.size
      });
    } catch (error) {
      console.error('加载历史记录失败:', error);
    }
  }

  private checkInitialized() {
    if (!this.initialized) {
      throw new Error('上下文分析器未初始化');
    }
  }

  public static async getInstance(): Promise<EnhancedContextAnalyzer> {
    if (!EnhancedContextAnalyzer.instance) {
      EnhancedContextAnalyzer.instance = new EnhancedContextAnalyzer();
      await EnhancedContextAnalyzer.instance.waitForInitialization();
    }
    return EnhancedContextAnalyzer.instance;
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

  /**
   * 获取增强的补全上下文
   */
  public async getEnhancedContext(
    input: string,
    cursorPosition: number,
    sessionState: SessionState
  ): Promise<EnhancedCompletionContext> {
    const startTime = performance.now();
    this.checkInitialized();
    
    console.log('[EnhancedContextAnalyzer] 开始获取补全上下文:', {
      input,
      cursorPosition,
      sessionState
    });

    // 1. 解析当前命令
    const parseStartTime = performance.now();
    const currentCommand = await this.shellParser.parse(input);
    const parseEndTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 命令解析耗时:', (parseEndTime - parseStartTime).toFixed(2), 'ms');
    console.log('[EnhancedContextAnalyzer] 命令解析结果:', currentCommand);
    
    // 2. 获取环境状态
    const envStartTime = performance.now();
    const environment = await this.getEnvironmentState(sessionState.currentWorkingDirectory);
    const envEndTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 获取环境状态耗时:', (envEndTime - envStartTime).toFixed(2), 'ms');
    console.log('[EnhancedContextAnalyzer] 环境状态:', environment);

    // 3. 实时从数据库获取最近的命令历史
    const historyStartTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 从数据库获取的历史记录...');
    const recentHistory = await this.commandHistory.search('', 100);
    const historyEndTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 获取历史记录耗时:', (historyEndTime - historyStartTime).toFixed(2), 'ms');
    console.log('[EnhancedContextAnalyzer] 从数据库获取的历史记录:', recentHistory);

    // 更新内存中的统计信息
    const statsStartTime = performance.now();
    recentHistory.forEach(record => {
      this.commandStats.set(record.command, {
        frequency: record.frequency,
        lastUsed: record.last_used,
        outputs: []
      });
    });
    const statsEndTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 更新统计信息耗时:', (statsEndTime - statsStartTime).toFixed(2), 'ms');

    // 4. 获取相关的模式
    const patternsStartTime = performance.now();
    const patterns = await this.getRelevantPatterns(
      input,
      sessionState.currentWorkingDirectory,
      currentCommand
    );
    const patternsEndTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 获取相关模式耗时:', (patternsEndTime - patternsStartTime).toFixed(2), 'ms');
    console.log('[EnhancedContextAnalyzer] 相关模式:', patterns);

    const endTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 获取增强上下文完成, 总耗时:', (endTime - startTime).toFixed(2), 'ms', {
      '命令解析耗时': (parseEndTime - parseStartTime).toFixed(2),
      '环境状态耗时': (envEndTime - envStartTime).toFixed(2),
      '历史记录耗时': (historyEndTime - historyStartTime).toFixed(2),
      '统计信息耗时': (statsEndTime - statsStartTime).toFixed(2),
      '相关模式耗时': (patternsEndTime - patternsStartTime).toFixed(2)
    });

    return {
      currentCommand,
      commandHistory: {
        recent: this.recentCommands.slice(-10),
        statistics: Array.from(this.commandStats.entries()).map(([cmd, stats]) => ({
          command: cmd,
          frequency: stats.frequency,
          lastUsed: stats.lastUsed,
          avgExitCode: 0,
          outputs: []
        }))
      },
      environment,
      userPatterns: this.userPatterns,
      patterns,
      cursorPosition,
      sessionState
    };
  }

  private async getRelevantPatterns(
    input: string,
    cwd: string,
    parsedCommand: ShellParserTypes.ParseResult
  ): Promise<EnhancedPatterns> {
    const startTime = performance.now();
    
    // 获取命令的参数模式
    const argStartTime = performance.now();
    const argPatterns = this.argumentAnalyzer.getPatterns(input);
    const argEndTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 获取参数模式耗时:', (argEndTime - argStartTime).toFixed(2), 'ms');
    
    // 获取当前目录的相关命令
    const dirStartTime = performance.now();
    const dirPatterns = await this.directoryAnalyzer.getPatterns(cwd);
    const dirEndTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 获取目录模式耗时:', (dirEndTime - dirStartTime).toFixed(2), 'ms');
    
    // 获取相关文件类型的命令
    const fileStartTime = performance.now();
    const filePatterns = await this.fileTypeAnalyzer.getPatterns(cwd, parsedCommand);
    const fileEndTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 获取文件类型模式耗时:', (fileEndTime - fileStartTime).toFixed(2), 'ms');
    
    // 获取可能的错误修正
    const corrStartTime = performance.now();
    const corrections = this.errorCorrectionAnalyzer.getCorrections(input);
    const corrEndTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 获取错误修正耗时:', (corrEndTime - corrStartTime).toFixed(2), 'ms');

    const endTime = performance.now();
    console.log('[EnhancedContextAnalyzer] 获取相关模式完成, 总耗时:', (endTime - startTime).toFixed(2), 'ms', {
      '参数模式耗时': (argEndTime - argStartTime).toFixed(2),
      '目录模式耗时': (dirEndTime - dirStartTime).toFixed(2),
      '文件类型模式耗时': (fileEndTime - fileStartTime).toFixed(2),
      '错误修正耗时': (corrEndTime - corrStartTime).toFixed(2)
    });

    return {
      argumentPatterns: argPatterns,
      directoryPatterns: dirPatterns,
      fileTypePatterns: filePatterns,
      errorCorrections: corrections
    };
  }

  /**
   * 更新命令执行结果
   */
  public async updateCommandExecution(result: CommandExecutionResult): Promise<void> {
    this.checkInitialized();

    try {
      // 1. 更新数据库
      await this.commandHistory.addOrUpdate(
        result.command,
        '',
        result.exitCode === 0,
        result.output
      );

      // 2. 更新内存中的状态
      this.recentCommands.push(result);
      if (this.recentCommands.length > 100) {
        this.recentCommands.shift();
      }

      // 更新命令统计
      const stats = this.commandStats.get(result.command) || {
        frequency: 0,
        lastUsed: new Date(),
        outputs: []
      };
      stats.frequency++;
      stats.lastUsed = result.timestamp;
      stats.outputs = [...stats.outputs, ...result.output].slice(-5);
      this.commandStats.set(result.command, stats);

      // 3. 更新各个分析器
      await this.argumentAnalyzer.updatePattern(result);
      await this.directoryAnalyzer.updatePattern(result);
      await this.fileTypeAnalyzer.updatePattern(result);
      this.errorCorrectionAnalyzer.updatePattern(result);

      // 4. 更新其他模式
      this.updateCommandChainPattern(result);
      this.updateTimePattern(result);
      await this.updateContextPattern(result);

      console.log('[EnhancedContextAnalyzer] 命令执行结果更新完成:', {
        command: result.command,
        exitCode: result.exitCode,
        timestamp: result.timestamp,
        outputLength: result.output.length
      });
    } catch (error) {
      console.error('更新命令执行结果失败:', error);
      throw error;
    }
  }

  /**
   * 获取环境状态
   */
  private async getEnvironmentState(cwd: string): Promise<EnvironmentState> {
    try {
      // 1. 检查缓存
      const cached = this.environmentCache.get(cwd);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp < this.ENV_CACHE_EXPIRY)) {
        return cached.state;
      }

      // 2. 并行执行所有命令
      const [
        isGitRepo,
        recentFiles,
        runningProcesses,
        lastModifiedFiles
      ] = await Promise.all([
        this.checkIsGitRepository(cwd),
        this.getRecentFiles(cwd),
        this.getRunningProcesses(),
        this.getLastModifiedFiles(cwd)
      ]);

      // 3. 构建环境状态
      const state: EnvironmentState = {
        currentDirectory: cwd,
        isGitRepository: isGitRepo,
        recentFiles,
        runningProcesses,
        lastModifiedFiles
      };

      // 4. 更新缓存
      this.environmentCache.set(cwd, {
        state,
        timestamp: now
      });

      return state;
    } catch (error) {
      console.error('获取环境状态失败:', error);
      // 返回默认状态
      return {
        currentDirectory: cwd,
        isGitRepository: false,
        recentFiles: [],
        runningProcesses: [],
        lastModifiedFiles: []
      };
    }
  }

  /**
   * 检查是否是Git仓库
   */
  private async checkIsGitRepository(cwd: string): Promise<boolean> {
    try {
      const result = await this.commandExecutor.executeCommand('git rev-parse --is-inside-work-tree 2>/dev/null');
      return result.trim() === 'true';
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取最近访问的文件
   */
  private async getRecentFiles(cwd: string): Promise<string[]> {
    try {
      const result = await this.commandExecutor.executeCommand('ls -ut | head -n 10');
      return result.split('\n')
        .map(file => file.trim())
        .filter(file => file && !file.startsWith('.'));
    } catch (error) {
      console.error('获取最近文件失败:', error);
      return [];
    }
  }

  /**
   * 获取运行中的进程
   */
  private async getRunningProcesses(): Promise<string[]> {
    try {
      const result = await this.commandExecutor.executeCommand('ps -e -o comm= | grep -v "ps" | sort -u | head -n 10');
      return result.split('\n')
        .map(line => line.trim())
        .filter(Boolean);
    } catch (error) {
      console.error('获取进程列表失败:', error);
      return [];
    }
  }

  /**
   * 获取最近修改的文件
   */
  private async getLastModifiedFiles(cwd: string): Promise<string[]> {
    try {
      const result = await this.commandExecutor.executeCommand('ls -t | head -n 10');
      return result.split('\n')
        .map(file => file.trim())
        .filter(file => file && !file.startsWith('.'));
    } catch (error) {
      console.error('获取最近修改文件失败:', error);
      return [];
    }
  }

  /**
   * 更新命令链模式
   */
  private updateCommandChainPattern(result: CommandExecutionResult): void {
    const lastCommand = this.recentCommands[this.recentCommands.length - 2]?.command;
    if (!lastCommand) return;

    const chainKey = lastCommand;
    const chainStats = this.userPatterns.commandChains[chainKey] || {
      nextCommands: {},
      frequency: 0,
      lastUsed: new Date()
    };

    chainStats.nextCommands[result.command] = (chainStats.nextCommands[result.command] || 0) + 1;
    chainStats.frequency++;
    chainStats.lastUsed = result.timestamp;

    this.userPatterns.commandChains[chainKey] = chainStats;
  }

  /**
   * 更新时间模式
   */
  private updateTimePattern(result: CommandExecutionResult): void {
    const hour = result.timestamp.getHours();
    this.userPatterns.timePatterns[hour] = this.userPatterns.timePatterns[hour] || {};
    this.userPatterns.timePatterns[hour][result.command] = 
      (this.userPatterns.timePatterns[hour][result.command] || 0) + 1;
  }

  /**
   * 更新上下文模式
   */
  private async updateContextPattern(result: CommandExecutionResult): Promise<void> {
    try {
      const gitStatus = await this.checkIsGitRepository(await this.commandExecutor.executeCommand('pwd'))
        ? await this.commandExecutor.executeCommand('git rev-parse --abbrev-ref HEAD')
        : 'non-git';
      
      const context = `${await this.commandExecutor.executeCommand('pwd')}:${gitStatus}`;
      
      this.userPatterns.contextPatterns[context] = this.userPatterns.contextPatterns[context] || {};
      this.userPatterns.contextPatterns[context][result.command] = 
        (this.userPatterns.contextPatterns[context][result.command] || 0) + 1;
    } catch (error) {
      console.error('更新上下文模式失败:', error);
    }
  }
} 