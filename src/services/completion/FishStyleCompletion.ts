import { ShellParserTypes } from '../parser/ShellParserTypes';
import { CompletionContext, CompletionSource, CompletionSuggestion } from './types/completion.types';
import { eventBus } from '@/renderer/services/eventBus';
import { CompletionSSHManager } from './CompletionSSHManager';
import { SessionInfo } from '@/main/services/storage';

/**
 * Fish-shell风格的补全算法实现
 */
export class FishStyleCompletion {
  private static instance: FishStyleCompletion;
  private sshManager: CompletionSSHManager;

  /**
   * 补全建议缓存
   */
  private suggestionCache: Map<string, {
    suggestions: CompletionSuggestion[];
    timestamp: number;
  }> = new Map();

  /**
   * 缓存过期时间(毫秒)
   */
  private readonly CACHE_EXPIRY = 5000;

  private constructor() {
    this.sshManager = CompletionSSHManager.getInstance();
  }

  public static getInstance(): FishStyleCompletion {
    if (!FishStyleCompletion.instance) {
      FishStyleCompletion.instance = new FishStyleCompletion();
    }
    return FishStyleCompletion.instance;
  }

  /**
   * 从缓存中获取建议
   */
  private getCachedSuggestions(
    command: ShellParserTypes.Command,
    context: CompletionContext
  ): CompletionSuggestion[] | null {
    const cacheKey = this.getCacheKey(command, context);
    const cached = this.suggestionCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    // 检查缓存是否过期
    if (Date.now() - cached.timestamp > this.CACHE_EXPIRY) {
      this.suggestionCache.delete(cacheKey);
      return null;
    }

    return cached.suggestions;
  }

  /**
   * 将建议存入缓存
   */
  private cacheSuggestions(
    command: ShellParserTypes.Command,
    context: CompletionContext,
    suggestions: CompletionSuggestion[]
  ): void {
    const cacheKey = this.getCacheKey(command, context);
    this.suggestionCache.set(cacheKey, {
      suggestions,
      timestamp: Date.now()
    });

    // 清理过期缓存
    this.cleanExpiredCache();
  }

  /**
   * 生成缓存键
   */
  private getCacheKey(
    command: ShellParserTypes.Command,
    context: CompletionContext
  ): string {
    return JSON.stringify({
      name: command.name,
      args: command.args,
      options: command.options
    });
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.suggestionCache.entries()) {
      if (now - value.timestamp > this.CACHE_EXPIRY) {
        this.suggestionCache.delete(key);
      }
    }
  }

  /**
   * 获取补全建议
   */
  public async getSuggestions(
    command: ShellParserTypes.Command,
    context: CompletionContext
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] Getting suggestions for command:', command);

    // 检查缓存
    const cachedSuggestions = this.getCachedSuggestions(command, context);
    if (cachedSuggestions) {
      console.log('[FishStyleCompletion] Using cached suggestions');
      return cachedSuggestions;
    }

    // 清理过期缓存
    this.cleanExpiredCache();

    // 获取建议
    const suggestions: CompletionSuggestion[] = [];
    //当前目录
    const currentDirectory = this.sshManager.getCurrentDirectoryN();
    console.log('[FishStyleCompletion] 当前目录:', currentDirectory);
    try {
      // 预先获取共用数据
      const commonData = {
        fileList: [] as Array<{ name: string; isDirectory: boolean }>,
        envVars: {} as Record<string, string>
      };

      const tabId = eventBus.getCurrentTabId();
      // 获取文件列表（如果需要的话）
      if (this.needsFileCompletion(command)) {
        try {
          const lsResult = await this.sshManager.executeCommandForTab(tabId, 'ls -1aU | cat');
          commonData.fileList = lsResult.stdout.split('\n')
            .map(line => line.trim())
            .filter(line => line && line !== '.' && line !== '..')
            .map(name => ({
              name,
              isDirectory: name.endsWith('/')
            }));
          console.log('[FishStyleCompletion] 预加载的文件列表:', commonData.fileList);
        } catch (error) {
          console.error('[FishStyleCompletion] 获取文件列表失败:', error);
        }
      }

        // 获取环境变量（如果需要的话）
        if (this.needsEnvCompletion(command)) {
          try {
            const envResult = await this.sshManager.executeCommandForTab(tabId, 'env');
            envResult.stdout.split('\n').forEach(line => {
              const [key, ...values] = line.split('=');
              if (key) commonData.envVars[key] = values.join('=');
            });
            console.log('[FishStyleCompletion] 预加载的环境变量:', commonData.envVars);
          } catch (error) {
            console.error('[FishStyleCompletion] 获取环境变量失败:', error);
          }
        }
      

      // 1. 获取智能语法补全
      const syntaxSuggestions = await this.getIntelligentSyntaxCompletions(command, context, commonData);
      suggestions.push(...syntaxSuggestions);

      // 2. 获取历史记录补全
      const historySuggestions = await this.getHistoryCompletions(command, context);
      suggestions.push(...historySuggestions);

      // 3. 获取 SSH 补全（如果在 SSH 会话中）
      const sshSuggestions = await this.getSSHCompletions(command, context, commonData);
        suggestions.push(...sshSuggestions);

      // 缓存结果
      this.cacheSuggestions(command, context, suggestions);

      return suggestions;
    } catch (error) {
      console.error('[FishStyleCompletion] Error getting suggestions:', error);
      return [];
    }
  }

  /**
   * 判断是否需要文件补全
   */
  private needsFileCompletion(command: ShellParserTypes.Command): boolean {
    // 如果是文件相关命令，或者命令有参数，可能需要文件补全
    return this.isFileCompletionCommand(command.name) || command.args.length > 0;
  }

  /**
   * 判断是否需要环境变量补全
   */
  private needsEnvCompletion(command: ShellParserTypes.Command): boolean {
    // 检查命令或最后一个参数是否以 $ 开头
    const lastArg = command.args[command.args.length - 1] || '';
    return command.name.startsWith('$') || lastArg.startsWith('$');
  }

  /**
   * 获取基于语法的智能补全
   */
  private async getIntelligentSyntaxCompletions(
    command: ShellParserTypes.Command,
    context: CompletionContext,
    commonData: { fileList: Array<{ name: string; isDirectory: boolean }>; envVars: Record<string, string> }
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取智能语法补全');
    console.log('[FishStyleCompletion] 命令类型检查:', {
      isGitCommand: this.isGitCommand(command),
      isDockerCommand: this.isDockerCommand(command)
    });

    const suggestions: CompletionSuggestion[] = [];
    
    // 1. 基本命令补全
    const basicSuggestions = await this.getSyntaxCompletions(command, context, commonData);
    console.log('[FishStyleCompletion] 基本语法补全结果:', basicSuggestions);
    suggestions.push(...basicSuggestions);

    // 2. 根据命令类型提供特定补全
    if (this.isGitCommand(command)) {
      const gitSuggestions = await this.getGitCompletions(command);
      console.log('[FishStyleCompletion] Git命令补全结果:', gitSuggestions);
      suggestions.push(...gitSuggestions);
    } else if (this.isDockerCommand(command)) {
      const dockerSuggestions = await this.getDockerCompletions(command);
      console.log('[FishStyleCompletion] Docker命令补全结果:', dockerSuggestions);
      suggestions.push(...dockerSuggestions);
    }

    // 3. 基于文件类型的补全
    const fileTypeSuggestions = await this.getFileTypeCompletions(command, context);
    console.log('[FishStyleCompletion] 文件类型补全结果:', fileTypeSuggestions);
    suggestions.push(...fileTypeSuggestions);

    // 4. 基于目录操作模式的补全
    const directoryPatternSuggestions = await this.getDirectoryPatternCompletions(command, context);
    console.log('[FishStyleCompletion] 目录操作模式补全结果:', directoryPatternSuggestions);
    suggestions.push(...directoryPatternSuggestions);

    // 5. 基于错误修正的补全
    const errorCorrectionSuggestions = await this.getErrorCorrectionCompletions(command, context);
    console.log('[FishStyleCompletion] 错误修正补全结果:', errorCorrectionSuggestions);
    suggestions.push(...errorCorrectionSuggestions);

    // 6. 根据参数位置提供特定补全
    const lastArg = command.args[command.args.length - 1] || '';
    console.log('[FishStyleCompletion] 参数分析:', {
      lastArg,
      isInQuotes: this.isInQuotes(lastArg),
      isVariableExpansion: this.isVariableExpansion(lastArg),
      isRedirectionTarget: this.isRedirectionTarget(command, command.args.length - 1)
    });

    if (this.isVariableExpansion(lastArg)) {
      const prefix = lastArg.slice(1);  // 去掉 $ 符号
      const varSuggestions = Object.keys(commonData.envVars)
        .filter(varName => varName.startsWith(prefix))
        .map(varName => ({
          fullCommand: `$${varName}`,
          suggestion: varName.slice(prefix.length),
          source: CompletionSource.LOCAL,
          score: 0.8
        }));
      console.log('[FishStyleCompletion] 变量补全结果:', varSuggestions);
      suggestions.push(...varSuggestions);
    } 

    console.log('[FishStyleCompletion] 智能语法补全完成, 总建议数:', suggestions.length);
    return suggestions;
  }

  /**
   * 检查是否是 Git 命令
   */
  private isGitCommand(command: ShellParserTypes.Command): boolean {
    return command.name === 'git';
  }

  /**
   * 检查是否是 Docker 命令
   */
  private isDockerCommand(command: ShellParserTypes.Command): boolean {
    return command.name === 'docker';
  }

  /**
   * 检查参数是否在引号内
   */
  private isInQuotes(arg: string): boolean {
    return (arg.startsWith('"') && !arg.endsWith('"')) ||
           (arg.startsWith("'") && !arg.endsWith("'"));
  }

  /**
   * 检查是否是变量展开
   */
  private isVariableExpansion(arg: string): boolean {
    return arg.startsWith('$') || arg.startsWith('${');
  }

  /**
   * 检查是否是重定向目标
   */
  private isRedirectionTarget(command: ShellParserTypes.Command, argIndex: number): boolean {
    const prevArg = command.args[argIndex - 1];
    return prevArg === '>' || prevArg === '>>' || prevArg === '<';
  }

  /**
   * 去除引号
   */
  private stripQuotes(arg: string): string {
    return arg.replace(/^["']|["']$/g, '');
  }

  /**
   * 获取 Git 特定的补全
   */
  private async getGitCompletions(
    command: ShellParserTypes.Command
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取git命令补全');
    const lastArg = command.args[command.args.length - 1] || '';
    
    const gitCommands = [
      'status', 'add', 'commit', 'push', 'pull',
      'checkout', 'branch', 'merge', 'rebase',
      'log', 'fetch', 'clone', 'stash'
    ];

    return gitCommands
      .filter(cmd => cmd.startsWith(lastArg))
      .map(cmd => ({
        fullCommand: `git ${cmd}`,
        suggestion: cmd.slice(lastArg.length),
        source: CompletionSource.LOCAL,
        score: 0.9
      }));
  }

  /**
   * 获取 Docker 特定的补全
   */
  private async getDockerCompletions(
    command: ShellParserTypes.Command
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取docker命令补全');
    const lastArg = command.args[command.args.length - 1] || '';
    
    const dockerCommands = [
      'ps', 'images', 'run', 'build', 'stop',
      'rm', 'rmi', 'exec', 'logs', 'pull',
      'push', 'compose', 'network', 'volume'
    ];

    return dockerCommands
      .filter(cmd => cmd.startsWith(lastArg))
      .map(cmd => ({
        fullCommand: `docker ${cmd}`,
        suggestion: cmd.slice(lastArg.length),
        source: CompletionSource.LOCAL,
        score: 0.9
      }));
  }

  /**
   * 获取SSH会话相关的补全
   */
  private async getSSHCompletions(
    command: ShellParserTypes.Command,
    context: CompletionContext,
    commonData: { fileList: Array<{ name: string; isDirectory: boolean }>; envVars: Record<string, string> }
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取SSH补全, 命令:', command);
    const suggestions: CompletionSuggestion[] = [];

    try {
      const sessionInfo = eventBus.getCurrentSessionInfo();
      if (!sessionInfo) {
        console.log('[FishStyleCompletion] 未找到会话信息');
        return [];
      }

      // 1. 如果是空命令，获取命令补全
      if (!command.name) {
        console.log('[FishStyleCompletion] 获取空命令补全...');
        return this.getBasicCommandSuggestions('');
      }

      // 2. 如果命令存在且有参数，使用预加载的文件列表
      if (command.args.length > 0) {
        const lastArg = command.args[command.args.length - 1];
        console.log('[FishStyleCompletion] 获取路径补全, 最后参数:', lastArg);
        const pathSuggestions = await this.getFileNameCompletions(lastArg, context, commonData.fileList, command);
        console.log('[FishStyleCompletion] 文件名补全建议:', pathSuggestions);
        suggestions.push(...pathSuggestions);
      }

      // 3. 如果输入以$开头，使用预加载的环境变量
      const lastInput = command.args[command.args.length - 1] || command.name;
      if (lastInput.startsWith('$')) {
        console.log('[FishStyleCompletion] 获取环境变量补全, 输入:', lastInput);
        const prefix = lastInput.slice(1);
        
        const envSuggestions = Object.keys(commonData.envVars)
          .filter(varName => varName.startsWith(prefix))
          .map(varName => ({
            fullCommand: `$${varName}`,
            suggestion: varName.slice(prefix.length),
            source: CompletionSource.LOCAL,
            score: 0.8
          }));

        suggestions.push(...envSuggestions);
      }
      console.log('[FishStyleCompletion] SSH补全结果:', suggestions);
      return suggestions;
    } catch (error) {
      console.error('[FishStyleCompletion] SSH补全失败:', error);
      return [];
    }
  }

  /**
   * 获取基于历史的补全
   */
  private async getHistoryCompletions(
    command: ShellParserTypes.Command,
    context: CompletionContext
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取历史补全, 命令:', command);
    console.log('[FishStyleCompletion] 补全上下文:', context);
    
    const suggestions: CompletionSuggestion[] = [];
    const { recentCommands, commandHistory } = context;

    // 1. 从最近命令中查找匹配
    for (const recentCmd of recentCommands) {
      if (recentCmd.startsWith(command.name)) {
        const score = this.calculateHistoryScore(commandHistory);
        console.log('[FishStyleCompletion] 找到匹配的历史命令:', {
          recentCmd,
          score,
          commandName: command.name
        });
        suggestions.push({
          fullCommand: recentCmd,
          suggestion: recentCmd.slice(command.name.length),
          source: CompletionSource.HISTORY,
          score
        });
      }
    }

    console.log('[FishStyleCompletion] 历史补全结果:', suggestions);
    return suggestions;
  }

  /**
   * 获取语法补全
   */
  private async getSyntaxCompletions(
    command: ShellParserTypes.Command,
    context: CompletionContext,
    commonData: { fileList: Array<{ name: string; isDirectory: boolean }>; envVars: Record<string, string> }
  ): Promise<CompletionSuggestion[]> {

    console.log('[FishStyleCompletion] 开始获取语法补全, 命令:', command);

    // 获取命令参数信息
    const commandInfo = {
      commandName: command.name,
      availableArgs: command.args,
      lastArg: command.args[command.args.length - 1] || '',
      hasTrailingSpace: command.hasTrailingSpace || false
    };
    console.log('[FishStyleCompletion] 命令参数信息:', commandInfo);

    // 如果命令名为空或者是部分输入，提供命令名补全
    if (!commandInfo.commandName || !this.isFullCommand(commandInfo.commandName)) {
      console.log('[FishStyleCompletion] 提供命令名补全');
      return this.getBasicCommandSuggestions(commandInfo.commandName);
    }

    // 处理特定命令的补全
    switch (commandInfo.commandName) {
      case 'ls':
        return this.getLsCompletions(command);
      case 'git':
        return this.getGitCompletions(command);
      case 'docker':
        return this.getDockerCompletions(command);
      default:
        return this.getDefaultCompletions(command);
    }
  }

  /**
   * 检查是否是完整的命令
   */
  private isFullCommand(name: string): boolean {
    const basicCommands = [
      'ls', 'll', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv',
      'cat', 'less', 'more', 'head', 'tail', 'grep', 'find',
      'sed', 'awk', 'ps', 'top', 'kill', 'pkill', 'git',
      'npm', 'node', 'python', 'curl', 'wget', 'ssh', 'scp',
      'vim', 'nano', 'chmod', 'chown', 'systemctl', 'service',
      'journalctl', 'docker', 'kubectl', 'helm'
    ];
    return basicCommands.includes(name);
  }

  /**
   * 判断是否是需要文件补全的命令
   */
  private isFileCompletionCommand(commandName: string): boolean {
    const fileCommands = ['cat', 'vim', 'nano', 'less', 'more', 'tail', 'head', 'cp', 'mv', 'rm'];
    const result = fileCommands.includes(commandName.toLowerCase());
    console.log('[FishStyleCompletion] 文件补全命令检查:', { commandName, isFileCommand: result });
    return result;
  }

  /**
   * 获取ls命令的补全
   */
  private getLsCompletions(command: ShellParserTypes.Command): CompletionSuggestion[] {
    console.log('[FishStyleCompletion] 获取ls命令补全');
    
    // 如果最后一个参数以-开头，提供选项补全
    const lastArg = command.args[command.args.length - 1] || '';
    if (lastArg.startsWith('-')) {
      return [
        { fullCommand: 'ls -l', suggestion: '-l', source: CompletionSource.LOCAL, score: 0.9 },
        { fullCommand: 'ls -la', suggestion: '-la', source: CompletionSource.LOCAL, score: 0.9 },
        { fullCommand: 'ls -lh', suggestion: '-lh', source: CompletionSource.LOCAL, score: 0.9 },
        { fullCommand: 'ls -lt', suggestion: '-lt', source: CompletionSource.LOCAL, score: 0.9 },
        { fullCommand: 'ls -ltr', suggestion: '-ltr', source: CompletionSource.LOCAL, score: 0.9 }
      ];
    }

    return [];
  }

  /**
   * 计算历史记录得分
   */
  private calculateHistoryScore(history: CompletionContext['commandHistory']): number {
    const frequencyScore = Math.min(history.frequency / 10, 1); // 最高1分
    const timeScore = Math.max(0, 1 - this.getDaysDifference(history.lastUsed) / 30); // 最近30天内,最高1分
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
   * 对补全建议进行排序
   */
  private rankSuggestions(suggestions: CompletionSuggestion[]): CompletionSuggestion[] {
    console.log('[FishStyleCompletion] 开始对补全建议排序');
    
    // 1. 按分数降序排序
    const sortedSuggestions = [...suggestions].sort((a, b) => b.score - a.score);
    
    // 2. 去重,保留分数最高的建议
    const uniqueSuggestions = new Map<string, CompletionSuggestion>();
    for (const suggestion of sortedSuggestions) {
      if (!uniqueSuggestions.has(suggestion.suggestion)) {
        uniqueSuggestions.set(suggestion.suggestion, suggestion);
      }
    }
    
    // 3. 限制返回数量
    const maxSuggestions = 10;
    const result = Array.from(uniqueSuggestions.values()).slice(0, maxSuggestions);
    
    console.log('[FishStyleCompletion] 排序后的建议:', result);
    return result;
  }

  /**
   * 获取文件名补全
   */
  private async getFileNameCompletions(
    partialPath: string,
    context: CompletionContext,
    fileList: Array<{ name: string; isDirectory: boolean }>,
    currentCommand?: ShellParserTypes.Command
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取文件名补全, 路径:', partialPath,'文件列表:', fileList,'当前命令:', currentCommand);
    try {
      // 获取命令前缀（如果有）
      const commandPrefix = currentCommand ? `${currentCommand.name} ` : '';
      
      // 过滤并转换为补全建议
      const suggestions = fileList
        .filter(file => {
          const matches = !partialPath || file.name.toLowerCase().startsWith(partialPath.toLowerCase());
          console.log('[FishStyleCompletion] 匹配文件:', { file, partialPath, matches });
          return matches;
        })
        .map(file => {
          const suggestion = {
            fullCommand: `${commandPrefix}${file.name}`,  // 加入命令前缀
            suggestion: file.name,
            source: CompletionSource.LOCAL,
            score: file.isDirectory ? 0.95 : 0.9  // 目录优先级略高
          };
          console.log('[FishStyleCompletion] 生成建议:', suggestion);
          return suggestion;
        });

      console.log('[FishStyleCompletion] 文件名补全建议:', suggestions);
      return suggestions;
    } catch (error) {
      console.error('[FishStyleCompletion] 获取文件名补全失败:', error);
      return [];
    }
  }

  /**
   * 获取变量补全
   */
  private async getVariableCompletions(
    partialVar: string
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取变量补全, 变量:', partialVar);
    try {
      // 常见的环境变量
      const commonVars = [
        'HOME', 'PATH', 'USER', 'SHELL', 'PWD', 'LANG',
        'TERM', 'DISPLAY', 'EDITOR', 'PAGER', 'TMPDIR'
      ];

      return commonVars
        .filter(v => v.toLowerCase().startsWith(partialVar.toLowerCase()))
        .map(v => ({
          fullCommand: '$' + v,
          suggestion: v.slice(partialVar.length),
          source: CompletionSource.LOCAL,
          score: 0.7
        }));
    } catch (error) {
      console.error('[FishStyleCompletion] 获取变量补全失败:', error);
      return [];
    }
  }

  /**
   * 获取命令名补全
   */
  private getBasicCommandSuggestions(input: string): CompletionSuggestion[] {
    console.log('[FishStyleCompletion] 获取命令名补全');
    
    // 基础命令列表
    const basicCommands = [
      'ls', 'll', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv',
      'cat', 'less', 'more', 'head', 'tail', 'grep', 'find',
      'sed', 'awk', 'ps', 'top', 'kill', 'pkill', 'git',
      'npm', 'node', 'python', 'curl', 'wget', 'ssh', 'scp',
      'vim', 'nano', 'chmod', 'chown', 'systemctl', 'service',
      'journalctl', 'docker', 'kubectl', 'helm'
    ];

    // 只返回以用户输入为前缀的命令
    return basicCommands
      .filter(cmd => cmd.startsWith(input))
      .map(cmd => ({
        fullCommand: cmd,
        suggestion: cmd,
        source: CompletionSource.LOCAL,
        score: 0.8
      }));
  }

  /**
   * 获取默认命令的补全
   */
  private getDefaultCompletions(command: ShellParserTypes.Command): CompletionSuggestion[] {
    console.log('[FishStyleCompletion] 获取默认命令补全');
    const lastArg = command.args[command.args.length - 1] || '';
    
    // 如果最后一个参数以-开头，提供通用选项补全
    if (lastArg.startsWith('-')) {
      return [
        { fullCommand: `${command.name} -h`, suggestion: '-h', source: CompletionSource.LOCAL, score: 0.7 },
        { fullCommand: `${command.name} --help`, suggestion: '--help', source: CompletionSource.LOCAL, score: 0.7 },
        { fullCommand: `${command.name} -v`, suggestion: '-v', source: CompletionSource.LOCAL, score: 0.7 },
        { fullCommand: `${command.name} --version`, suggestion: '--version', source: CompletionSource.LOCAL, score: 0.7 }
      ];
    }

    return [];
  }

  /**
   * 获取基于文件类型的补全
   */
  private async getFileTypeCompletions(
    command: ShellParserTypes.Command,
    context: CompletionContext
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取文件类型补全');
    const suggestions: CompletionSuggestion[] = [];

    // 常见的文件类型关联
    const fileTypeAssociations: Record<string, string[]> = {
      // 文本编辑器
      'vim': ['.txt', '.md', '.json', '.yaml', '.yml', '.conf'],
      'nano': ['.txt', '.md', '.conf'],
      'code': ['.ts', '.js', '.py', '.java', '.cpp', '.h'],
      
      // 文件查看
      'cat': ['.txt', '.log', '.conf', '.md'],
      'less': ['.log', '.txt'],
      'tail': ['.log'],
      
      // 编译和构建
      'gcc': ['.c', '.cpp'],
      'javac': ['.java'],
      'python': ['.py'],
      'node': ['.js', '.ts'],
      
      // 压缩和解压
      'tar': ['.tar.gz', '.tgz', '.tar'],
      'unzip': ['.zip'],
      'gunzip': ['.gz']
    };

    const commandName = command.name;
    if (!commandName || !(commandName in fileTypeAssociations)) {
      return suggestions;
    }

    const fileTypes = fileTypeAssociations[commandName];
    const lastArg = command.args[command.args.length - 1] || '';

    // 如果最后一个参数是路径的一部分，提供匹配的文件建议
    if (lastArg && !lastArg.startsWith('-')) {
      suggestions.push(...fileTypes.map(ext => ({
        fullCommand: `${commandName} ${lastArg}${ext}`,
        suggestion: ext,
        source: CompletionSource.LOCAL,
        score: 0.7
      })));
    }

    return suggestions;
  }

  /**
   * 获取基于目录操作模式的补全
   */
  private async getDirectoryPatternCompletions(
    command: ShellParserTypes.Command,
    context: CompletionContext
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取目录操作模式补全');
    const suggestions: CompletionSuggestion[] = [];

    // 常见的目录操作命令
    const directoryCommands = ['cd', 'ls', 'mkdir', 'rmdir', 'cp', 'mv'];
    if (!directoryCommands.includes(command.name || '')) {
      return suggestions;
    }

    const lastArg = command.args[command.args.length - 1] || '';
    if (!lastArg || lastArg.startsWith('-')) {
      return suggestions;
    }

    // 常见的目录模式
    const commonPatterns = [
      'src/', 'dist/', 'build/', 'docs/',
      'test/', 'tests/', 'config/', 'scripts/',
      'node_modules/', 'target/', 'bin/', 'lib/'
    ];

    suggestions.push(...commonPatterns
      .filter(pattern => pattern.startsWith(lastArg))
      .map(pattern => ({
        fullCommand: `${command.name} ${pattern}`,
        suggestion: pattern.slice(lastArg.length),
        source: CompletionSource.LOCAL,
        score: 0.8
      })));

    return suggestions;
  }

  /**
   * 获取基于错误修正的补全
   */
  private async getErrorCorrectionCompletions(
    command: ShellParserTypes.Command,
    context: CompletionContext
  ): Promise<CompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取错误修正补全');
    const suggestions: CompletionSuggestion[] = [];

    // 常见的命令拼写错误修正
    const commonMistakes: Record<string, string> = {
      'gti': 'git',
      'sl': 'ls',
      'grpe': 'grep',
      'pythno': 'python',
      'mkidr': 'mkdir',
      'rmd': 'rm -d',
      'cta': 'cat',
      'lesss': 'less',
      'cd..': 'cd ..',
      'gitp': 'git push',
      'gitc': 'git commit'
    };

    const inputCommand = command.name || '';
    const correction = commonMistakes[inputCommand];
    
    if (correction) {
      suggestions.push({
        fullCommand: correction,
        suggestion: correction,
        source: CompletionSource.LOCAL,
        score: 0.9
      });
    }

    return suggestions;
  }

} 