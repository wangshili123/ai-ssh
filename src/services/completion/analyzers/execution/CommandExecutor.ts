import { sshService } from '@/main/services/ssh';
import { eventBus } from '@/renderer/services/eventBus';

export class CommandExecutor {
  private static instance: CommandExecutor;

  private constructor() {}

  public static getInstance(): CommandExecutor {
    if (!CommandExecutor.instance) {
      CommandExecutor.instance = new CommandExecutor();
    }
    return CommandExecutor.instance;
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