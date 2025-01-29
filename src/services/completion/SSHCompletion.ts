import { ICompletionSuggestion, CompletionSource } from './CompletionService';

/**
 * SSH会话接口
 */
export interface SSHSession {
  execute(command: string): Promise<{ stdout: string; stderr: string }>;
  getCurrentDirectory(): Promise<string>;
  getEnvironmentVars(): Promise<Record<string, string>>;
}

/**
 * SSH补全服务
 */
export class SSHCompletion {
  private static instance: SSHCompletion;
  
  private constructor() {}

  public static getInstance(): SSHCompletion {
    if (!SSHCompletion.instance) {
      SSHCompletion.instance = new SSHCompletion();
    }
    return SSHCompletion.instance;
  }

  /**
   * 获取路径补全
   */
  public async getPathCompletions(
    session: SSHSession,
    currentPath: string,
    prefix: string
  ): Promise<ICompletionSuggestion[]> {
    console.log('[SSHCompletion] 开始获取路径补全:', {
      currentPath,
      prefix
    });
    try {
      // 使用ls命令获取目录内容
      const command = `ls -a "${currentPath}" 2>/dev/null`;
      console.log('[SSHCompletion] 执行命令:', command);
      const { stdout } = await session.execute(command);
      const files = stdout.split('\n').filter(Boolean);
      console.log('[SSHCompletion] 获取到的文件列表:', files);

      const suggestions = files
        .filter(file => file.startsWith(prefix))
        .map(file => ({
          fullCommand: file,
          suggestion: file.slice(prefix.length),
          source: CompletionSource.LOCAL,
          score: 0.9 // 路径补全给予较高的分数
        }));
      
      console.log('[SSHCompletion] 路径补全结果:', suggestions);
      return suggestions;
    } catch (error) {
      console.error('[SSHCompletion] 获取路径补全失败:', error);
      return [];
    }
  }

  /**
   * 获取命令补全
   */
  public async getCommandCompletions(
    session: SSHSession,
    prefix: string
  ): Promise<ICompletionSuggestion[]> {
    console.log('[SSHCompletion] 开始获取命令补全, 前缀:', prefix);
    try {
      // 使用compgen获取所有可用命令
      const command = `compgen -c "${prefix}" 2>/dev/null`;
      console.log('[SSHCompletion] 执行命令:', command);
      const { stdout } = await session.execute(command);
      const commands = stdout.split('\n').filter(Boolean);
      console.log('[SSHCompletion] 获取到的命令列表:', commands);

      const suggestions = commands.map(cmd => ({
        fullCommand: cmd,
        suggestion: cmd.slice(prefix.length),
        source: CompletionSource.LOCAL,
        score: 0.8 // 命令补全给予较高的分数
      }));

      console.log('[SSHCompletion] 命令补全结果:', suggestions);
      return suggestions;
    } catch (error) {
      console.error('[SSHCompletion] 获取命令补全失败:', error);
      return [];
    }
  }

  /**
   * 获取环境变量补全
   */
  public async getEnvCompletions(
    session: SSHSession,
    prefix: string
  ): Promise<ICompletionSuggestion[]> {
    console.log('[SSHCompletion] 开始获取环境变量补全, 前缀:', prefix);
    try {
      const vars = await session.getEnvironmentVars();
      console.log('[SSHCompletion] 获取到的环境变量:', vars);
      
      const suggestions = Object.keys(vars)
        .filter(key => key.startsWith(prefix))
        .map(key => ({
          fullCommand: `$${key}`,
          suggestion: key.slice(prefix.length),
          source: CompletionSource.LOCAL,
          score: 0.7
        }));

      console.log('[SSHCompletion] 环境变量补全结果:', suggestions);
      return suggestions;
    } catch (error) {
      console.error('[SSHCompletion] 获取环境变量补全失败:', error);
      return [];
    }
  }
} 