import { SSHSession } from './SSHCompletion';

/**
 * 补全上下文接口
 */
export interface CompletionContext {
  /**
   * SSH会话信息
   */
  sshSession?: SSHSession;

  /**
   * 最近使用的命令
   */
  recentCommands: string[];

  /**
   * 命令执行历史
   */
  commandHistory: {
    frequency: number;
    lastUsed: Date;
  };

  /**
   * 当前命令的解析结果
   */
  currentCommand: {
    name: string;
    args: string[];
    options: string[];
    isIncomplete: boolean;
  };
} 