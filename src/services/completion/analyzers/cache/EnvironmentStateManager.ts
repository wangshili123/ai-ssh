import { EnvironmentState } from '../types/context.types';
import { SSHConnectionManager } from '../../../ssh/SSHConnectionManager';
import { eventBus } from '../../../../renderer/services/eventBus';
import { SessionInfo } from '../../../../main/services/storage';

interface EnvironmentStateCache {
  state: EnvironmentState;
  timestamp: number;
  source: 'memory' | 'storage' | 'computed';
}

export class EnvironmentStateManager {
  private static instance: EnvironmentStateManager;
  private memoryCache: Map<string, EnvironmentStateCache> = new Map();
  private sshManager: SSHConnectionManager;
  
  private readonly CACHE_DURATION = {
    MEMORY: 5000,    // 5s
    STORAGE: 30000,  // 30s
  };
  
  private constructor() {
    this.sshManager = SSHConnectionManager.getInstance();
  }
  
  public static getInstance(): EnvironmentStateManager {
    if (!EnvironmentStateManager.instance) {
      EnvironmentStateManager.instance = new EnvironmentStateManager();
    }
    return EnvironmentStateManager.instance;
  }
  
  public async getState(sessionId: string): Promise<EnvironmentState> {
    console.log('[EnvironmentStateManager] 获取环境状态:', sessionId);
    
    // 1. 检查内存缓存
    const cached = this.memoryCache.get(sessionId);
    if (cached && this.isCacheValid(cached)) {
      console.log('[EnvironmentStateManager] 使用内存缓存');
      return cached.state;
    }
    
    try {
      // 2. 获取会话配置
      const sessionInfo = await eventBus.getCurrentSessionInfo();
      if (!sessionInfo) {
        throw new Error('未找到会话信息');
      }
      
      const config = {
        host: sessionInfo.host,
        port: sessionInfo.port,
        username: sessionInfo.username,
        password: sessionInfo.password,
      };
      
      // 3. 并行获取环境状态
      console.log('[EnvironmentStateManager] 并行获取环境状态');
      const startTime = Date.now();
      
      const client = await this.sshManager.getConnection(sessionId, config);
      const [
        currentDirectory,
        gitStatus,
        recentFiles,
        processes,
        modifiedFiles
      ] = await Promise.all([
        this.executeCommand(client, 'pwd'),
        this.executeCommand(client, 'git rev-parse --is-inside-work-tree').catch(() => ''),
        this.executeCommand(client, 'ls -t | head -n 10'),
        this.executeCommand(client, 'ps -ef | head -n 10'),
        this.executeCommand(client, 'find . -type f -mtime -1 | head -n 10')
      ]);
      
      // 4. 构建环境状态
      const state: EnvironmentState = {
        currentDirectory: currentDirectory.trim(),
        isGitRepository: gitStatus.trim() === 'true',
        recentFiles: recentFiles.split('\n').filter(Boolean),
        runningProcesses: processes.split('\n').filter(Boolean),
        lastModifiedFiles: modifiedFiles.split('\n').filter(Boolean)
      };
      
      // 5. 更新缓存
      this.memoryCache.set(sessionId, {
        state,
        timestamp: Date.now(),
        source: 'computed'
      });
      
      const duration = Date.now() - startTime;
      console.log('[EnvironmentStateManager] 环境状态获取完成, 耗时:', duration, 'ms');
      
      return state;
    } catch (error) {
      console.error('[EnvironmentStateManager] 获取环境状态失败:', error);
      
      // 6. 返回默认状态
      return {
        currentDirectory: '/',
        isGitRepository: false,
        recentFiles: [],
        runningProcesses: [],
        lastModifiedFiles: []
      };
    }
  }
  
  private isCacheValid(cache: EnvironmentStateCache): boolean {
    const age = Date.now() - cache.timestamp;
    return age < this.CACHE_DURATION.MEMORY;
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
  
  public clearCache(sessionId: string): void {
    this.memoryCache.delete(sessionId);
  }
  
  public getCacheStats(): { size: number; sources: Record<string, number> } {
    const stats = {
      size: this.memoryCache.size,
      sources: {
        memory: 0,
        storage: 0,
        computed: 0
      }
    };
    
    for (const cache of this.memoryCache.values()) {
      stats.sources[cache.source]++;
    }
    
    return stats;
  }
} 