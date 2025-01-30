import { ShellParserTypes } from '../parser/ShellParserTypes';
import { CompletionContext } from './CompletionContext';
import { ICompletionSuggestion, CompletionSource } from './CompletionService';
import { SSHCompletion } from './SSHCompletion';

/**
 * Fish-shell风格的补全算法实现
 */
export class FishStyleCompletion {
  private static instance: FishStyleCompletion;
  private sshCompletion: SSHCompletion;

  /**
   * 补全建议缓存
   */
  private suggestionCache: Map<string, {
    suggestions: ICompletionSuggestion[];
    timestamp: number;
  }> = new Map();

  /**
   * 缓存过期时间(毫秒)
   */
  private readonly CACHE_EXPIRY = 5000;

  private constructor() {
    this.sshCompletion = SSHCompletion.getInstance();
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
  ): ICompletionSuggestion[] | null {
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
    suggestions: ICompletionSuggestion[]
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
      options: command.options,
      hasSSH: !!context.sshSession
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
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取补全建议');
    console.log('[FishStyleCompletion] 命令信息:', {
      name: command.name,
      args: command.args
    });
    console.log('[FishStyleCompletion] 上下文信息:', {
      hasSSHSession: !!context.sshSession,
      recentCommandsCount: context.recentCommands.length,
      commandHistoryInfo: {
        frequency: context.commandHistory.frequency,
        lastUsed: context.commandHistory.lastUsed
      }
    });

    // 1. 尝试从缓存获取
    const cachedSuggestions = this.getCachedSuggestions(command, context);
    if (cachedSuggestions) {
      console.log('[FishStyleCompletion] 使用缓存的建议');
      return cachedSuggestions;
    }

    const suggestions: ICompletionSuggestion[] = [];

    // 2. 基于命令语法的智能补全
    console.log('[FishStyleCompletion] 获取语法补全...');
    const syntaxSuggestions = await this.getIntelligentSyntaxCompletions(command, context);
    console.log('[FishStyleCompletion] 语法补全结果:', syntaxSuggestions);
    suggestions.push(...syntaxSuggestions);

    // 3. 基于SSH会话的补全
    if (context.sshSession) {
      console.log('[FishStyleCompletion] 获取SSH补全建议...');
      const sshSuggestions = await this.getSSHCompletions(command, context);
      console.log('[FishStyleCompletion] SSH补全建议:', sshSuggestions);
      suggestions.push(...sshSuggestions);
    }

    // 4. 基于命令历史的补全
    console.log('[FishStyleCompletion] 获取历史补全建议...');
    const historySuggestions = await this.getHistoryCompletions(command, context);
    console.log('[FishStyleCompletion] 历史补全建议:', historySuggestions);
    suggestions.push(...historySuggestions);

    // 5. 对所有建议进行排序和去重
    console.log('[FishStyleCompletion] 原始建议数量:', suggestions.length);
    const rankedSuggestions = this.rankSuggestions(suggestions);
    console.log('[FishStyleCompletion] 排序后建议数量:', rankedSuggestions.length);
    console.log('[FishStyleCompletion] 最终建议列表:', rankedSuggestions.map(s => ({
      suggestion: s.suggestion,
      score: s.score,
      source: s.source
    })));

    // 6. 缓存结果
    this.cacheSuggestions(command, context, rankedSuggestions);

    return rankedSuggestions;
  }

  /**
   * 获取基于语法的智能补全
   */
  private async getIntelligentSyntaxCompletions(
    command: ShellParserTypes.Command,
    context: CompletionContext
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取智能语法补全');
    console.log('[FishStyleCompletion] 命令类型检查:', {
      isGitCommand: this.isGitCommand(command),
      isDockerCommand: this.isDockerCommand(command)
    });

    const suggestions: ICompletionSuggestion[] = [];
    
    // 1. 基本命令补全
    const basicSuggestions = await this.getSyntaxCompletions(command, context);
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

    if (this.isInQuotes(lastArg)) {
      const fileNameSuggestions = await this.getFileNameCompletions(this.stripQuotes(lastArg));
      console.log('[FishStyleCompletion] 文件名补全结果:', fileNameSuggestions);
      suggestions.push(...fileNameSuggestions);
    } else if (this.isVariableExpansion(lastArg)) {
      const varSuggestions = await this.getVariableCompletions(lastArg);
      console.log('[FishStyleCompletion] 变量补全结果:', varSuggestions);
      suggestions.push(...varSuggestions);
    } else if (this.isRedirectionTarget(command, command.args.length - 1)) {
      const redirectionSuggestions = await this.getFileNameCompletions(lastArg);
      console.log('[FishStyleCompletion] 重定向补全结果:', redirectionSuggestions);
      suggestions.push(...redirectionSuggestions);
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
  ): Promise<ICompletionSuggestion[]> {
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
  ): Promise<ICompletionSuggestion[]> {
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
    context: CompletionContext
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取SSH补全, 命令:', command);
    const suggestions: ICompletionSuggestion[] = [];
    const session = context.sshSession!;

    try {
      // 获取当前目录
      const currentDirectory = await session.getCurrentDirectory();
      console.log('[FishStyleCompletion] 当前目录:', currentDirectory);

      // 1. 如果是空命令，获取命令补全
      if (!command.name) {
        console.log('[FishStyleCompletion] 获取空命令补全...');
        const cmdSuggestions = await this.sshCompletion.getCommandCompletions(session, '');
        console.log('[FishStyleCompletion] 命令补全结果:', cmdSuggestions);
        suggestions.push(...cmdSuggestions);
        return suggestions;
      }

      // 2. 如果命令存在且有参数，尝试路径补全
      if (command.args.length > 0) {
        const lastArg = command.args[command.args.length - 1];
        console.log('[FishStyleCompletion] 获取路径补全, 最后参数:', lastArg);
        const pathSuggestions = await this.sshCompletion.getPathCompletions(
          session,
          currentDirectory,
          lastArg
        );
        console.log('[FishStyleCompletion] 路径补全结果:', pathSuggestions);
        suggestions.push(...pathSuggestions);
      }

      // 3. 如果输入以$开头，获取环境变量补全
      const lastInput = command.args[command.args.length - 1] || command.name;
      if (lastInput.startsWith('$')) {
        console.log('[FishStyleCompletion] 获取环境变量补全, 输入:', lastInput);
        const envSuggestions = await this.sshCompletion.getEnvCompletions(
          session,
          lastInput.slice(1)
        );
        console.log('[FishStyleCompletion] 环境变量补全结果:', envSuggestions);
        suggestions.push(...envSuggestions);
      }

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
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取历史补全, 命令:', command);
    console.log('[FishStyleCompletion] 补全上下文:', context);
    
    const suggestions: ICompletionSuggestion[] = [];
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
    context: CompletionContext
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取语法补全, 命令:', command);

    // 如果命令名为空，提供命令名补全
    if (!command.name) {
      console.log('[FishStyleCompletion] 提供命令名补全');
      return this.getCommandNameCompletions(command, context);
    }

    // 获取命令参数信息
    const commandInfo = {
      commandName: command.name,
      availableArgs: command.args,
      lastArg: command.args[command.args.length - 1] || ''
    };
    console.log('[FishStyleCompletion] 命令参数信息:', commandInfo);

    // 处理特定命令的补全
    switch (command.name) {
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
   * 获取ls命令的补全
   */
  private getLsCompletions(command: ShellParserTypes.Command): ICompletionSuggestion[] {
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
  private rankSuggestions(suggestions: ICompletionSuggestion[]): ICompletionSuggestion[] {
    console.log('[FishStyleCompletion] 开始对补全建议排序');
    
    // 1. 按分数降序排序
    const sortedSuggestions = [...suggestions].sort((a, b) => b.score - a.score);
    
    // 2. 去重,保留分数最高的建议
    const uniqueSuggestions = new Map<string, ICompletionSuggestion>();
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
    partialPath: string
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取文件名补全, 路径:', partialPath);
    try {
      // 这里应该根据当前目录和部分路径获取匹配的文件列表
      // 暂时返回一些示例建议
      return [
        {
          fullCommand: partialPath + 'file1.txt',
          suggestion: 'file1.txt',
          source: CompletionSource.LOCAL,
          score: 0.7
        },
        {
          fullCommand: partialPath + 'file2.txt',
          suggestion: 'file2.txt',
          source: CompletionSource.LOCAL,
          score: 0.7
        }
      ];
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
  ): Promise<ICompletionSuggestion[]> {
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
  private getCommandNameCompletions(command: ShellParserTypes.Command, context: CompletionContext): ICompletionSuggestion[] {
    console.log('[FishStyleCompletion] 获取命令名补全');
    const commonCommands = [
      'ls', 'll', 'cd', 'pwd', 'mkdir', 'rm', 'cp', 'mv',
      'cat', 'less', 'more', 'head', 'tail',
      'grep', 'find', 'sed', 'awk',
      'ps', 'top', 'kill', 'pkill',
      'git', 'npm', 'node', 'python',
      'curl', 'wget', 'ssh', 'scp',
      'vim', 'nano', 'chmod', 'chown',
      'systemctl', 'service', 'journalctl',
      'docker', 'kubectl', 'helm'
    ];

    // 根据当前输入过滤命令
    const inputCommand = command.name || '';
    return commonCommands
      .filter(cmd => cmd.startsWith(inputCommand))
      .map(cmd => ({
        fullCommand: cmd,
        suggestion: cmd.slice(inputCommand.length),
        source: CompletionSource.LOCAL,
        score: 0.8
      }));
  }

  /**
   * 获取默认命令的补全
   */
  private getDefaultCompletions(command: ShellParserTypes.Command): ICompletionSuggestion[] {
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
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取文件类型补全');
    const suggestions: ICompletionSuggestion[] = [];

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
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取目录操作模式补全');
    const suggestions: ICompletionSuggestion[] = [];

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
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 获取错误修正补全');
    const suggestions: ICompletionSuggestion[] = [];

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