import { sshService } from '../../../services/ssh';
import { eventBus } from '../../../services/eventBus';
import { SSHConnectionManager } from '../../../../services/ssh/SSHConnectionManager';

interface CommandOptions {
  timeout?: number;       // 命令超时时间(毫秒)
  maxRetries?: number;    // 最大重试次数
  retryDelay?: number;    // 重试延迟(毫秒)
}

interface CommandResult {
  success: boolean;
  data?: string;
  error?: string;
}

/**
 * SSH命令执行器
 * 负责执行监控相关的SSH命令，处理超时和重试
 */
export class CommandService {
  private static instance: CommandService;
  private sshManager: SSHConnectionManager;

  private constructor() {
    this.sshManager = SSHConnectionManager.getInstance();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): CommandService {
    if (!CommandService.instance) {
      CommandService.instance = new CommandService();
    }
    return CommandService.instance;
  }

  /**
   * 执行SSH命令
   * @param command 要执行的命令
   * @param options 命令选项
   */
  async executeCommand(
    command: string,
    options: CommandOptions = {}
  ): Promise<CommandResult> {
    const {
      timeout = 30000,      // 默认30秒超时
      maxRetries = 3,       // 默认最多重试3次
      retryDelay = 1000     // 默认重试间隔1秒
    } = options;

    let retries = 0;

    while (retries <= maxRetries) {
      try {
        // 创建超时Promise
        const timeoutPromise = new Promise<CommandResult>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Command execution timed out after ${timeout}ms`));
          }, timeout);
        });

        // 创建命令执行Promise
        const commandPromise = new Promise<CommandResult>(async (resolve, reject) => {
          try {
            // 执行命令
            const result = await this.sshManager.executeCurrentSessionCommand(command);

            resolve({
              success: true,
              data: result.stdout,
              error: result.stderr
            });
          } catch (error) {
            reject(error);
          }
        });

        // 使用Promise.race实现超时控制
        const result = await Promise.race([commandPromise, timeoutPromise]);
        return result;

      } catch (error) {
        retries++;
        
        // 如果还有重试机会，等待后重试
        if (retries <= maxRetries) {
          console.log(`Command execution failed, retrying (${retries}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // 超过重试次数，返回错误
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    // 这里理论上不会执行到，但TypeScript需要
    return {
      success: false,
      error: 'Unknown error'
    };
  }

  /**
   * 执行多个命令
   * @param commands 命令列表
   * @param options 命令选项
   */
  async executeCommands(
    commands: string[],
    options: CommandOptions = {}
  ): Promise<CommandResult[]> {
    const results: CommandResult[] = [];

    for (const command of commands) {
      const result = await this.executeCommand(command, options);
      results.push(result);

      // 如果某个命令执行失败，停止执行后续命令
      if (!result.success) {
        break;
      }
    }

    return results;
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    CommandService.instance = null as any;
  }
}

// 导出单例
export const commandService = CommandService.getInstance(); 