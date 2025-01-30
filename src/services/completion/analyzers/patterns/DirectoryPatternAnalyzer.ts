import { DirectoryPattern } from '../types/patterns.types';
import { CommandExecutionResult } from '../types/context.types';
import { sshService } from '@/main/services/ssh';
import { eventBus } from '@/renderer/services/eventBus';

export class DirectoryPatternAnalyzer {
  private static instance: DirectoryPatternAnalyzer;
  private directoryPatterns: Map<string, DirectoryPattern> = new Map();

  private constructor() {}

  public static getInstance(): DirectoryPatternAnalyzer {
    if (!DirectoryPatternAnalyzer.instance) {
      DirectoryPatternAnalyzer.instance = new DirectoryPatternAnalyzer();
    }
    return DirectoryPatternAnalyzer.instance;
  }

  public async updatePattern(result: CommandExecutionResult): Promise<void> {
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

  public getPatterns(cwd: string): string[] {
    const pattern = this.directoryPatterns.get(cwd);
    if (!pattern) return [];
    
    return Object.entries(pattern.commands)
      .sort((a, b) => b[1] - a[1])
      .map(([cmd]) => cmd);
  }

  private async executeCommand(command: string): Promise<string> {
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