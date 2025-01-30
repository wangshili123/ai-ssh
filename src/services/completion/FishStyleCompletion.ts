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
   * 获取补全建议
   */
  public async getSuggestions(
    command: ShellParserTypes.Command,
    context: CompletionContext
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取补全建议, 命令:', command);
    const suggestions: ICompletionSuggestion[] = [];

    // 1. 基于命令语法的智能补全
    const syntaxSuggestions = await this.getIntelligentSyntaxCompletions(command);
    suggestions.push(...syntaxSuggestions);

    // 2. 基于SSH会话的补全
    if (context.sshSession) {
      console.log('[FishStyleCompletion] 获取SSH补全建议...');
      const sshSuggestions = await this.getSSHCompletions(command, context);
      console.log('[FishStyleCompletion] SSH补全建议:', sshSuggestions);
      suggestions.push(...sshSuggestions);
    }

    // 3. 基于命令历史的补全
    console.log('[FishStyleCompletion] 获取历史补全建议...');
    const historySuggestions = await this.getHistoryCompletions(command, context);
    console.log('[FishStyleCompletion] 历史补全建议:', historySuggestions);
    suggestions.push(...historySuggestions);

    const rankedSuggestions = this.rankSuggestions(suggestions);
    console.log('[FishStyleCompletion] 最终排序后的建议:', rankedSuggestions);
    return rankedSuggestions;
  }

  /**
   * 获取基于语法的智能补全
   */
  private async getIntelligentSyntaxCompletions(
    command: ShellParserTypes.Command
  ): Promise<ICompletionSuggestion[]> {
    const suggestions: ICompletionSuggestion[] = [];
    
    // 1. 基本命令补全
    const basicSuggestions = await this.getSyntaxCompletions(command);
    suggestions.push(...basicSuggestions);

    // 2. 根据命令类型提供特定补全
    if (this.isGitCommand(command)) {
      suggestions.push(...await this.getGitCompletions(command));
    } else if (this.isDockerCommand(command)) {
      suggestions.push(...await this.getDockerCompletions(command));
    }

    // 3. 根据参数位置提供特定补全
    const lastArg = command.args[command.args.length - 1] || '';
    if (this.isInQuotes(lastArg)) {
      // 在引号内提供文件名补全
      suggestions.push(...await this.getFileNameCompletions(this.stripQuotes(lastArg)));
    } else if (this.isVariableExpansion(lastArg)) {
      // 在变量展开中提供变量名补全
      suggestions.push(...await this.getVariableCompletions(lastArg));
    } else if (this.isRedirectionTarget(command, command.args.length - 1)) {
      // 在重定向后提供文件名补全
      suggestions.push(...await this.getFileNameCompletions(lastArg));
    }

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
    const suggestions: ICompletionSuggestion[] = [];
    const subCommand = command.args[0];

    if (!subCommand) {
      // 提供 git 子命令补全
      return this.getGitSubcommands();
    } else if (subCommand === 'checkout') {
      // 提供分支名补全
      return this.getGitBranches();
    } else if (subCommand === 'add') {
      // 提供未暂存文件补全
      return this.getGitUnstagedFiles();
    }

    return suggestions;
  }

  /**
   * 获取 Docker 特定的补全
   */
  private async getDockerCompletions(
    command: ShellParserTypes.Command
  ): Promise<ICompletionSuggestion[]> {
    const suggestions: ICompletionSuggestion[] = [];
    const subCommand = command.args[0];

    if (!subCommand) {
      // 提供 docker 子命令补全
      return this.getDockerSubcommands();
    } else if (subCommand === 'exec' || subCommand === 'logs') {
      // 提供容器ID/名称补全
      return this.getDockerContainers();
    } else if (subCommand === 'run' || subCommand === 'pull') {
      // 提供镜像名补全
      return this.getDockerImages();
    }

    return suggestions;
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
   * 获取基于语法的补全
   */
  private async getSyntaxCompletions(
    command: ShellParserTypes.Command
  ): Promise<ICompletionSuggestion[]> {
    console.log('[FishStyleCompletion] 开始获取语法补全, 命令:', command);
    const suggestions: ICompletionSuggestion[] = [];

    // 常见命令列表
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

    // 常见命令的参数提示
    const commonArgs: Record<string, string[]> = {
      ls: ['-l', '-a', '-h', '--color', '-R', '-t', '-S', '-r'],
      grep: ['-i', '-r', '-n', '-v', '-l', '-c', '-w', '-x', '-E'],
      git: ['status', 'add', 'commit', 'push', 'pull', 'checkout', 'branch', 'merge', 'rebase', 'log', 'fetch', 'clone'],
      npm: ['install', 'start', 'run', 'test', 'build', 'update', 'publish', 'link', 'uninstall'],
      docker: ['ps', 'images', 'run', 'build', 'stop', 'rm', 'rmi', 'exec', 'logs', 'pull', 'push'],
      kubectl: ['get', 'describe', 'create', 'delete', 'apply', 'logs', 'exec', 'port-forward', 'rollout'],
      systemctl: ['start', 'stop', 'restart', 'status', 'enable', 'disable', 'reload'],
      find: ['-name', '-type', '-size', '-mtime', '-exec', '-print', '-delete'],
      ps: ['-ef', '-aux', '-u', '-p', '--sort'],
      curl: ['-X', '-H', '-d', '-i', '-v', '-L', '-o', '--data'],
      mkdir: ['-p', '-v', '-m'],
      rm: ['-r', '-f', '-i', '-v'],
      cp: ['-r', '-f', '-i', '-v', '-p'],
      chmod: ['-R', '-v', '+x', '-x', 'u+x', 'g+x', 'o+x']
    };

    // 1. 如果命令名不完整，提供命令名补全
    if (!command.args.length) {
      console.log('[FishStyleCompletion] 提供命令名补全');
      const matchingCommands = commonCommands
        .filter(cmd => cmd.startsWith(command.name))
        .map(cmd => ({
          fullCommand: cmd,
          suggestion: cmd.slice(command.name.length),
          source: CompletionSource.LOCAL,
          score: 0.8
        }));
      suggestions.push(...matchingCommands);
    }

    // 2. 如果命令存在且有参数列表，提供参数补全
    const args = commonArgs[command.name] || [];
    const lastArg = command.args[command.args.length - 1] || '';
    console.log('[FishStyleCompletion] 命令参数信息:', {
      commandName: command.name,
      availableArgs: args,
      lastArg
    });

    // 添加命令参数建议
    if (command.name in commonArgs) {
      const argSuggestions = args
        .filter(arg => arg.startsWith(lastArg))
        .map(arg => ({
          fullCommand: `${command.name} ${arg}`,
          suggestion: arg.slice(lastArg.length),
          source: CompletionSource.LOCAL,
          score: 0.7
        }));
      suggestions.push(...argSuggestions);
    }

    console.log('[FishStyleCompletion] 语法补全结果:', suggestions);
    return suggestions;
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
  private rankSuggestions(
    suggestions: ICompletionSuggestion[]
  ): ICompletionSuggestion[] {
    return suggestions
      .sort((a, b) => {
        // 1. 首先按得分排序
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        
        // 2. 然后按建议长度排序（优先显示较短的建议）
        return a.suggestion.length - b.suggestion.length;
      })
      .slice(0, 5); // 最多返回5个建议
  }

  /**
   * 获取文件名补全
   */
  private async getFileNameCompletions(prefix: string): Promise<ICompletionSuggestion[]> {
    // 这里应该通过 SSH 会话或本地文件系统获取文件列表
    // 暂时返回空数组，等待实现
    return [];
  }

  /**
   * 获取变量名补全
   */
  private async getVariableCompletions(prefix: string): Promise<ICompletionSuggestion[]> {
    // 这里应该从环境变量或上下文中获取变量列表
    // 暂时返回一些常见的环境变量
    const commonVars = [
      'HOME', 'PATH', 'USER', 'SHELL', 'PWD', 'LANG',
      'TERM', 'DISPLAY', 'EDITOR', 'PAGER'
    ];

    return commonVars
      .filter(v => v.startsWith(prefix.replace(/^\$\{?/, '')))
      .map(v => ({
        fullCommand: prefix.startsWith('${') ? '${' + v + '}' : '$' + v,
        suggestion: v.slice(prefix.replace(/^\$\{?/, '').length),
        source: CompletionSource.LOCAL,
        score: 0.6
      }));
  }

  /**
   * 获取 Git 子命令列表
   */
  private async getGitSubcommands(): Promise<ICompletionSuggestion[]> {
    const gitCommands = [
      'add', 'commit', 'push', 'pull', 'fetch', 'merge',
      'rebase', 'checkout', 'branch', 'tag', 'log',
      'status', 'diff', 'stash', 'reset', 'remote'
    ];

    return gitCommands.map(cmd => ({
      fullCommand: 'git ' + cmd,
      suggestion: cmd,
      source: CompletionSource.LOCAL,
      score: 0.9
    }));
  }

  /**
   * 获取 Git 分支列表
   */
  private async getGitBranches(): Promise<ICompletionSuggestion[]> {
    // 这里应该通过执行 git branch 命令获取实际的分支列表
    // 暂时返回空数组，等待实现
    return [];
  }

  /**
   * 获取 Git 未暂存文件列表
   */
  private async getGitUnstagedFiles(): Promise<ICompletionSuggestion[]> {
    // 这里应该通过执行 git status 命令获取实际的未暂存文件列表
    // 暂时返回空数组，等待实现
    return [];
  }

  /**
   * 获取 Docker 子命令列表
   */
  private async getDockerSubcommands(): Promise<ICompletionSuggestion[]> {
    const dockerCommands = [
      'run', 'start', 'stop', 'restart', 'kill', 'rm',
      'ps', 'images', 'pull', 'push', 'build', 'exec',
      'logs', 'inspect', 'network', 'volume', 'compose'
    ];

    return dockerCommands.map(cmd => ({
      fullCommand: 'docker ' + cmd,
      suggestion: cmd,
      source: CompletionSource.LOCAL,
      score: 0.9
    }));
  }

  /**
   * 获取 Docker 容器列表
   */
  private async getDockerContainers(): Promise<ICompletionSuggestion[]> {
    // 这里应该通过执行 docker ps 命令获取实际的容器列表
    // 暂时返回空数组，等待实现
    return [];
  }

  /**
   * 获取 Docker 镜像列表
   */
  private async getDockerImages(): Promise<ICompletionSuggestion[]> {
    // 这里应该通过执行 docker images 命令获取实际的镜像列表
    // 暂时返回空数组，等待实现
    return [];
  }
} 