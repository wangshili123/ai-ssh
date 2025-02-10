import { sshService } from '@/main/services/ssh';
import { eventBus, TabInfo } from '@/renderer/services/eventBus';

export class CommandExecutor {
  private static instance: CommandExecutor = CommandExecutor.getInstance();

  private constructor() {
    // 监听标签页删除事件
    eventBus.on('completion:tab-remove', (tabInfo: TabInfo) => {
      //todo 清理之前先判断同一个sessionId的tab是否存在
      
      console.log('[CommandExecutor] 标签页被删除，清理连接:', tabInfo.tabId);
      if (tabInfo.sessionInfo?.id) {
        sshService.cleanupConnection(tabInfo.sessionInfo.id);
      }

    });
  }

  public static getInstance(): CommandExecutor {
    if (!CommandExecutor.instance) {
      CommandExecutor.instance = new CommandExecutor();
    }
    return CommandExecutor.instance;
  }

  public static async initializeConnection(): Promise<void> {
    console.log('[CommandExecutor] 开始初始化补全执行命令的SSH连接');
    try {
      const sessionId = eventBus.getCurrentSessionId();
      if (!sessionId) {
        return;
      }

      let connection = sshService.getConnection(sessionId);
      if (!connection) {
        const sessionInfo = eventBus.getCurrentSessionInfo();
        if (!sessionInfo) {
          return;
        }

        console.log('[CommandExecutor] 正在预初始化SSH连接...');
        await sshService.connect(sessionInfo);
        console.log('[CommandExecutor] SSH连接预初始化完成');
      }
    } catch (error) {
      console.error('[CommandExecutor] 初始化SSH连接失败:', error);
    }
  }

  public async executeCommand(command: string): Promise<string> {
    try {
      const sessionId = eventBus.getCurrentSessionId();
      if (!sessionId) {
        throw new Error('No active shell session found');
      }

      let connection = sshService.getConnection(sessionId);
      if (!connection) {
        const sessionInfo = eventBus.getCurrentSessionInfo();
        if (!sessionInfo) {
          throw new Error('No session information found');
        }

        await sshService.connect(sessionInfo);
        connection = sshService.getConnection(sessionId);
        
        if (!connection) {
          throw new Error('Failed to create SSH connection');
        }
      }

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