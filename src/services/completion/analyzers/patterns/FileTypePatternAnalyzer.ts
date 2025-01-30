import { FileTypePattern } from '../types/patterns.types';
import { CommandExecutionResult } from '../types/context.types';
import { ShellParserTypes } from '../../../parser/ShellParserTypes';
import { sshService } from '@/main/services/ssh';
import { eventBus } from '@/renderer/services/eventBus';

export class FileTypePatternAnalyzer {
  private static instance: FileTypePatternAnalyzer;
  private fileTypePatterns: Map<string, FileTypePattern> = new Map();
  
  // 添加缓存
  private fileListCache: Map<string, {
    files: string[],
    timestamp: number
  }> = new Map();
  
  private readonly CACHE_EXPIRY = 5000; // 5秒缓存过期

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
      // 1. 检查缓存
      const cached = this.fileListCache.get(cwd);
      const now = Date.now();
      
      let files: string[];
      if (cached && (now - cached.timestamp < this.CACHE_EXPIRY)) {
        files = cached.files;
      } else {
        // 2. 如果缓存不存在或已过期，获取文件列表
        const result = await this.executeCommand('ls');
        files = result.split('\n').filter(Boolean);
        
        // 3. 更新缓存
        this.fileListCache.set(cwd, {
          files,
          timestamp: now
        });
      }
      
      // 4. 提取扩展名
      const extensions = new Set(
        files
          .map((f: string) => f.split('.').pop())
          .filter((ext: string | undefined): ext is string => ext !== undefined && ext !== '')
      );
      
      // 5. 收集相关命令
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