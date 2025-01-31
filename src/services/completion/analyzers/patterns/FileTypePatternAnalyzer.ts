import { FileTypePattern } from '../types/patterns.types';
import { CommandExecutionResult } from '../types/context.types';
import { ShellParserTypes } from '../../../parser/ShellParserTypes';
import { sshService } from '@/main/services/ssh';
import { eventBus } from '@/renderer/services/eventBus';

interface FileSystemSnapshot {
  files: Set<string>;
  timestamp: number;
  checksum: string;
}

interface FileTypeCache {
  patterns: FileTypePattern[];
  timestamp: number;
  directory: string;
}

export class FileTypePatternAnalyzer {
  private static instance: FileTypePatternAnalyzer;
  private fileTypePatterns: Map<string, FileTypePattern> = new Map();
  private fileSystemSnapshots: Map<string, FileSystemSnapshot> = new Map();
  private patternCache: Map<string, FileTypeCache> = new Map();
  
  private readonly CACHE_DURATION = {
    SNAPSHOT: 10000,  // 10s
    PATTERN: 30000,   // 30s
  };
  
  private constructor() {}
  
  public static getInstance(): FileTypePatternAnalyzer {
    if (!FileTypePatternAnalyzer.instance) {
      FileTypePatternAnalyzer.instance = new FileTypePatternAnalyzer();
    }
    return FileTypePatternAnalyzer.instance;
  }
  
  public async updatePattern(result: CommandExecutionResult): Promise<void> {
    try {
      console.log('[FileTypePatternAnalyzer] 更新文件类型模式');
      const startTime = Date.now();
      
      const commandParts = result.command.split(' ');
      const commandName = commandParts[0];
      const args = commandParts.slice(1);
      
      // 提取命令中涉及的文件
      const files = args.filter(arg => !arg.startsWith('-'));
      
      for (const file of files) {
        const parts = file.split('.');
        if (parts.length < 2) continue;
        
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
      
      const duration = Date.now() - startTime;
      console.log('[FileTypePatternAnalyzer] 更新完成, 耗时:', duration, 'ms');
    } catch (error) {
      console.error('[FileTypePatternAnalyzer] 更新文件类型模式失败:', error);
    }
  }
  
  public async getPatterns(
    cwd: string,
    parsedCommand: ShellParserTypes.ParseResult
  ): Promise<string[]> {
    try {
      console.log('[FileTypePatternAnalyzer] 获取文件类型模式');
      const startTime = Date.now();
      
      // 1. 检查缓存
      const cached = this.patternCache.get(cwd);
      if (cached && this.isPatternCacheValid(cached)) {
        console.log('[FileTypePatternAnalyzer] 使用缓存的模式');
        return this.getCommandsFromPatterns(cached.patterns);
      }
      
      // 2. 获取文件系统快照
      const snapshot = await this.getFileSystemSnapshot(cwd);
      
      // 3. 分析文件类型
      const patterns = await this.analyzeFileTypes(snapshot.files);
      
      // 4. 更新缓存
      this.patternCache.set(cwd, {
        patterns,
        timestamp: Date.now(),
        directory: cwd
      });
      
      const commands = this.getCommandsFromPatterns(patterns);
      
      const duration = Date.now() - startTime;
      console.log('[FileTypePatternAnalyzer] 获取完成, 耗时:', duration, 'ms');
      
      return commands;
    } catch (error) {
      console.error('[FileTypePatternAnalyzer] 获取文件类型模式失败:', error);
      return [];
    }
  }
  
  private async getFileSystemSnapshot(cwd: string): Promise<FileSystemSnapshot> {
    const existing = this.fileSystemSnapshots.get(cwd);
    if (existing && this.isSnapshotValid(existing)) {
      return existing;
    }
    
    const sessionInfo = await eventBus.getCurrentSessionInfo();
    if (!sessionInfo) {
      throw new Error('未找到会话信息');
    }
    
    const client = await sshService.getConnection(sessionInfo.id);
    const result = await this.executeCommand(client, 'ls -la');
    const files = new Set(result.split('\n').filter(Boolean));
    
    const snapshot: FileSystemSnapshot = {
      files,
      timestamp: Date.now(),
      checksum: this.calculateChecksum(files)
    };
    
    this.fileSystemSnapshots.set(cwd, snapshot);
    return snapshot;
  }
  
  private async analyzeFileTypes(files: Set<string>): Promise<FileTypePattern[]> {
    const patterns: FileTypePattern[] = [];
    const extensionMap = new Map<string, number>();
    
    for (const file of files) {
      const parts = file.split('.');
      if (parts.length < 2) continue;
      
      const extension = parts[parts.length - 1];
      extensionMap.set(extension, (extensionMap.get(extension) || 0) + 1);
      
      const pattern = this.fileTypePatterns.get(extension);
      if (pattern) {
        patterns.push(pattern);
      }
    }
    
    return patterns;
  }
  
  private getCommandsFromPatterns(patterns: FileTypePattern[]): string[] {
    const commands = new Set<string>();
    for (const pattern of patterns) {
      Object.keys(pattern.commands).forEach(cmd => commands.add(cmd));
    }
    return Array.from(commands);
  }
  
  private isSnapshotValid(snapshot: FileSystemSnapshot): boolean {
    const age = Date.now() - snapshot.timestamp;
    return age < this.CACHE_DURATION.SNAPSHOT;
  }
  
  private isPatternCacheValid(cache: FileTypeCache): boolean {
    const age = Date.now() - cache.timestamp;
    return age < this.CACHE_DURATION.PATTERN;
  }
  
  private calculateChecksum(files: Set<string>): string {
    return Array.from(files).sort().join('|');
  }
  
  private async executeCommand(client: any, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      client.exec(command, (err: Error | undefined, stream: any) => {
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
        
        stream.on('error', (err: Error) => {
          reject(err);
        });
      });
    });
  }
  
  public clearCache(directory: string): void {
    this.fileSystemSnapshots.delete(directory);
    this.patternCache.delete(directory);
  }
  
  public getCacheStats(): { 
    snapshotSize: number; 
    patternSize: number;
    patternCount: number;
  } {
    return {
      snapshotSize: this.fileSystemSnapshots.size,
      patternSize: this.patternCache.size,
      patternCount: this.fileTypePatterns.size
    };
  }
} 