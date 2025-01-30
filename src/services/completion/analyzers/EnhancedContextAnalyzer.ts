import { 
  EnhancedCompletionContext, 
  CommandExecutionResult, 
  EnvironmentState, 
  UserPattern,
  ArgumentPattern,
  DirectoryPattern,
  FileTypePattern,
  ErrorCorrectionPattern,
  EnhancedPatterns,
  SessionState
} from '../core/types/context.types';
import { ShellParserTypes } from '../../parser/ShellParserTypes';
import { ShellParser } from '../../parser/ShellParser';
import { sshService } from '@/main/services/ssh';
import { eventBus } from '@/renderer/services/eventBus';
import { CommandHistory } from '../../database/models/CommandHistory';
import { DatabaseService } from '../../database/DatabaseService';

/**
 * 增强的上下文分析器
 */
export class EnhancedContextAnalyzer {
  private static instance: EnhancedContextAnalyzer;
  private shellParser: ShellParser;
  private commandHistory!: CommandHistory;  // 使用!断言，因为我们会在initializeAsync中初始化它
  private initialized: boolean = false;
  
  // 记录最近的命令执行结果
  private recentCommands: CommandExecutionResult[] = [];
  // 记录命令统计信息
  private commandStats: Map<string, { frequency: number; lastUsed: Date; outputs: string[] }> = new Map();
  // 记录用户行为模式
  private userPatterns: UserPattern = {
    commandChains: {},
    timePatterns: {},
    contextPatterns: {}
  };

  // 新增的模式分析属性
  private argumentPatterns: Map<string, Map<string, ArgumentPattern>> = new Map();
  private directoryPatterns: Map<string, DirectoryPattern> = new Map();
  private fileTypePatterns: Map<string, FileTypePattern> = new Map();
  private errorCorrectionPatterns: Map<string, ErrorCorrectionPattern> = new Map();

  private constructor() {
    this.shellParser = ShellParser.getInstance();
    this.initializeAsync();
  }

  private async initializeAsync() {
    try {
      // 先初始化数据库服务
      await DatabaseService.getInstance().init();
      
      // 然后再创建CommandHistory实例
      this.commandHistory = new CommandHistory();
      
      this.initialized = true;

      // 从数据库加载历史记录
      await this.loadHistoryFromDatabase();
    } catch (error) {
      console.error('初始化上下文分析器失败:', error);
      throw error;
    }
  }

  private async loadHistoryFromDatabase() {
    try {
      // 获取最近的命令历史
      const history = await this.commandHistory.search('', 100);
      
      // 更新命令统计
      history.forEach(record => {
        this.commandStats.set(record.command, {
          frequency: record.frequency,
          lastUsed: record.last_used,
          outputs: record.outputs || []
        });

        // 添加到最近命令列表
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
      // 等待初始化完成
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
   * 获取增强的补全上下文
   */
  public async getEnhancedContext(
    input: string,
    cursorPosition: number,
    sessionState: SessionState
  ): Promise<EnhancedCompletionContext> {
    this.checkInitialized();
    
    console.log('[EnhancedContextAnalyzer] 开始获取补全上下文:', {
      input,
      cursorPosition,
      sessionState
    });

    // 1. 解析当前命令
    const currentCommand = await this.shellParser.parse(input);
    console.log('[EnhancedContextAnalyzer] 命令解析结果:', currentCommand);
    
    // 2. 获取环境状态
    const environment = await this.getEnvironmentState(sessionState.currentWorkingDirectory);
    console.log('[EnhancedContextAnalyzer] 环境状态:', environment);

    // 3. 实时从数据库获取最近的命令历史
    const recentHistory = await this.commandHistory.search('', 100);
    console.log('[EnhancedContextAnalyzer] 从数据库获取的历史记录:', recentHistory);

    // 更新内存中的统计信息
    recentHistory.forEach(record => {
      this.commandStats.set(record.command, {
        frequency: record.frequency,
        lastUsed: record.last_used,
        outputs: []  // 初始化为空数组
      });
    });

    // 构建命令历史上下文
    const commandHistory = {
      recent: recentHistory.map(record => ({
        command: record.command,
        output: [],  // 初始化为空数组
        exitCode: record.success ? 0 : 1,
        timestamp: record.last_used
      })).slice(-10),
      statistics: Array.from(this.commandStats.entries()).map(([cmd, stats]) => ({
        command: cmd,
        frequency: stats.frequency,
        lastUsed: stats.lastUsed,
        avgExitCode: 0,
        outputs: []  // 初始化为空数组
      }))
    };
    console.log('[EnhancedContextAnalyzer] 命令历史:', commandHistory);

    // 4. 获取相关的模式
    const patterns = await this.getRelevantPatterns(
      input,
      sessionState.currentWorkingDirectory,
      currentCommand
    );
    console.log('[EnhancedContextAnalyzer] 相关模式:', patterns);

    const context = {
      currentCommand,
      commandHistory,
      environment,
      userPatterns: this.userPatterns,
      patterns,
      cursorPosition,
      sessionState
    };

    console.log('[EnhancedContextAnalyzer] 最终生成的上下文:', context);
    return context;
  }

  /**
   * 获取相关的模式信息
   */
  private async getRelevantPatterns(
    input: string,
    cwd: string,
    parsedCommand: ShellParserTypes.ParseResult
  ): Promise<EnhancedPatterns> {
    // 获取命令的参数模式
    const argPatterns = this.getArgumentPatternsForCommand(input);
    
    // 获取当前目录的相关命令
    const dirPatterns = this.getDirectoryPatterns(cwd);
    
    // 获取相关文件类型的命令
    const filePatterns = await this.getFileTypePatterns(cwd, parsedCommand);
    
    // 获取可能的错误修正
    const corrections = this.getErrorCorrections(input);

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
        '',  // context
        result.exitCode === 0,  // success
        result.output  // outputs
      );

      // 2. 更新内存中的状态
      // 更新最近命令列表
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
      stats.outputs = [...stats.outputs, ...result.output].slice(-5);  // 只保留最近5条输出
      this.commandStats.set(result.command, stats);

      // 3. 更新新增的模式分析
      await this.updateArgumentPatterns(result);
      await this.updateDirectoryPatterns(result);
      await this.updateFileTypePatterns(result);
      this.updateErrorCorrectionPatterns(result);

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
   * 更新参数使用模式
   */
  private async updateArgumentPatterns(result: CommandExecutionResult): Promise<void> {
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

  /**
   * 更新目录操作模式
   */
  private async updateDirectoryPatterns(result: CommandExecutionResult): Promise<void> {
    try {
      const cwd = await this.executeCommand('pwd');
      const pattern = this.directoryPatterns.get(cwd) || {
        path: cwd,
        commands: {},
        lastUsed: new Date()
      };
      
      pattern.commands[result.command] = (pattern.commands[result.command] || 0) + 1;
      pattern.lastUsed = result.timestamp;
      
      this.directoryPatterns.set(cwd, pattern);
    } catch (error) {
      console.error('更新目录模式失败:', error);
    }
  }

  /**
   * 更新文件类型关联模式
   */
  private async updateFileTypePatterns(result: CommandExecutionResult): Promise<void> {
    try {
      const commandParts = result.command.split(' ');
      const commandName = commandParts[0];
      const args = commandParts.slice(1);
      
      // 提取命令中涉及的文件
      const files = args.filter(arg => !arg.startsWith('-'));
      
      for (const file of files) {
        const parts = file.split('.');
        if (parts.length < 2) continue; // 跳过没有扩展名的文件
        
        const extension = parts[parts.length - 1];
        const pattern = this.fileTypePatterns.get(extension) || {
          extension,
          commands: {},
          lastUsed: new Date()
        };
        
        pattern.commands[commandName] = (pattern.commands[commandName] || 0) + 1;
        pattern.lastUsed = result.timestamp;
        
        this.fileTypePatterns.set(extension, pattern);
      }
    } catch (error) {
      console.error('更新文件类型模式失败:', error);
    }
  }

  /**
   * 更新错误修正模式
   */
  private updateErrorCorrectionPatterns(result: CommandExecutionResult): void {
    // 如果命令执行失败
    if (result.exitCode !== 0) {
      // 记录原始命令
      const originalCommand = result.command;
      
      // TODO: 实现命令纠错逻辑，可以考虑：
      // 1. 常见拼写错误修正
      // 2. 参数顺序调整
      // 3. 缺少参数补充
      // 4. 权限问题修正
    }
  }

  /**
   * 获取命令的参数模式
   */
  private getArgumentPatternsForCommand(command: string): ArgumentPattern[] {
    const patterns = this.argumentPatterns.get(command);
    if (!patterns) return [];
    
    return Array.from(patterns.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * 获取目录相关的命令模式
   */
  private getDirectoryPatterns(cwd: string): string[] {
    const pattern = this.directoryPatterns.get(cwd);
    if (!pattern) return [];
    
    return Object.entries(pattern.commands)
      .sort((a, b) => b[1] - a[1])
      .map(([cmd]) => cmd);
  }

  /**
   * 获取文件类型相关的命令模式
   */
  private async getFileTypePatterns(
    cwd: string,
    parsedCommand: ShellParserTypes.ParseResult
  ): Promise<string[]> {
    try {
      // 获取当前目录下的文件
      const files = await this.executeCommand('ls');
      const extensions = new Set(
        files.split('\n')
          .map(f => f.split('.').pop())
          .filter((ext): ext is string => ext !== undefined && ext !== '')
      );
      
      // 收集所有相关的命令
      const commands = new Set<string>();
      for (const ext of extensions) {
        const pattern = this.fileTypePatterns.get(ext);
        if (pattern) {
          Object.keys(pattern.commands).forEach(cmd => commands.add(cmd));
        }
      }
      
      return Array.from(commands);
    } catch (error) {
      console.error('获取文件类型模式失败:', error);
      return [];
    }
  }

  /**
   * 获取可能的错误修正
   */
  private getErrorCorrections(command: string): string[] {
    const correction = this.errorCorrectionPatterns.get(command);
    return correction ? [correction.correctedCommand] : [];
  }

  /**
   * 获取环境状态
   */
  private async getEnvironmentState(cwd: string): Promise<EnvironmentState> {
    return {
      currentDirectory: cwd,
      isGitRepository: await this.checkIsGitRepository(cwd),
      recentFiles: await this.getRecentFiles(cwd),
      runningProcesses: await this.getRunningProcesses(),
      lastModifiedFiles: await this.getLastModifiedFiles(cwd)
    };
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
      const gitStatus = await this.checkIsGitRepository(await this.executeCommand('pwd'))
        ? await this.executeCommand('git rev-parse --abbrev-ref HEAD')
        : 'non-git';
      
      const context = `${await this.executeCommand('pwd')}:${gitStatus}`;
      
      this.userPatterns.contextPatterns[context] = this.userPatterns.contextPatterns[context] || {};
      this.userPatterns.contextPatterns[context][result.command] = 
        (this.userPatterns.contextPatterns[context][result.command] || 0) + 1;
    } catch (error) {
      console.error('更新上下文模式失败:', error);
    }
  }

  /**
   * 检查是否是Git仓库
   */
  private async checkIsGitRepository(cwd: string): Promise<boolean> {
    try {
      const result = await this.executeCommand('git rev-parse --is-inside-work-tree 2>/dev/null');
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
      const result = await this.executeCommand('ls -ut | head -n 10');
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
      const result = await this.executeCommand('ps -e -o comm= | grep -v "ps" | sort -u | head -n 10');
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
      // 使用ls命令按修改时间排序，更快速高效
      const result = await this.executeCommand('ls -t | head -n 10');
      return result.split('\n')
        .map(file => file.trim())
        .filter(file => file && !file.startsWith('.'));
    } catch (error) {
      console.error('获取最近修改文件失败:', error);
      return [];
    }
  }

  /**
   * 通过SSH会话执行命令
   */
  private async executeCommand(command: string): Promise<string> {
    try {
      const sessionId = eventBus.getCurrentSessionId();
      console.log('[EnhancedContextAnalyzer] Current shellId:', sessionId);
      
      if (!sessionId) {
        throw new Error('No active shell session found');
      }

      let connection = sshService.getConnection(sessionId);
      console.log('[EnhancedContextAnalyzer] Existing SSH connection:', connection ? 'found' : 'not found');
      
      if (!connection) {
        
        const sessionInfo = eventBus.getCurrentSessionInfo();
        console.log('[EnhancedContextAnalyzer] Session info:', sessionInfo);
        
        if (!sessionInfo) {
          throw new Error('No session information found');
        }

        console.log('[EnhancedContextAnalyzer] Creating new SSH connection for session:', sessionInfo.id);
        await sshService.connect(sessionInfo);
        connection = sshService.getConnection(sessionId);
        console.log('[EnhancedContextAnalyzer] New connection created:', connection ? 'success' : 'failed');
        
        if (!connection) {
          throw new Error('Failed to create SSH connection');
        }
      }

      console.log('[EnhancedContextAnalyzer] Executing command:', command);

      return new Promise((resolve, reject) => {
        connection!.exec(command, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          let output = '';
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.on('end', () => {
            resolve(output);
          });

          stream.on('error', (error: Error) => {
            reject(error);
          });
        });
      });
    } catch (error) {
      console.error('执行命令失败:', error);
      throw error;
    }
  }
} 