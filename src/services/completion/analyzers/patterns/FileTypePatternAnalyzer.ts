import { FileTypePattern } from '../types/patterns.types';
import { CommandExecutionResult } from '../types/context.types';
import { ShellParserTypes } from '../../../parser/ShellParserTypes';
import { sshService } from '@/main/services/ssh';
import { eventBus } from '@/renderer/services/eventBus';

export class FileTypePatternAnalyzer {
  private static instance: FileTypePatternAnalyzer;
  private fileTypePatterns: Map<string, FileTypePattern> = new Map();

  private constructor() {}

  public static getInstance(): FileTypePatternAnalyzer {
    if (!FileTypePatternAnalyzer.instance) {
      FileTypePatternAnalyzer.instance = new FileTypePatternAnalyzer();
    }
    return FileTypePatternAnalyzer.instance;
  }

  public async updatePattern(result: CommandExecutionResult): Promise<void> {
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

  public async getPatterns(
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