import { Client } from 'ssh2';
import { eventBus } from '@/renderer/services/eventBus';
import { sshService } from '@/renderer/services/ssh';
import type { SessionInfo } from '@/main/services/storage';

interface CachedSSHConnection {
  client: Client;
  lastUsed: number;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

export class CompletionSSHManager {
  private static instance: CompletionSSHManager;
  private connections: Map<string, CachedSSHConnection> = new Map();
  
  private constructor() {
    // 不再需要监听目录变更事件
  }
  
  public static getInstance(): CompletionSSHManager {
    if (!CompletionSSHManager.instance) {
      CompletionSSHManager.instance = new CompletionSSHManager();
    }
    return CompletionSSHManager.instance;
  }
  
  // 获取或创建连接
  private async getConnection(sessionInfo: SessionInfo): Promise<CachedSSHConnection> {
    const existingConnection = this.connections.get(sessionInfo.id);
    if (existingConnection) {
      try {
        await this.testConnection(existingConnection.client);
        return existingConnection;
      } catch (error) {
        console.log(`[CompletionSSHManager] 连接已断开，创建新连接:`, error);
        this.connections.delete(sessionInfo.id);
      }
    }
    
    console.log(`[CompletionSSHManager] 创建新连接: ${sessionInfo.id}`);
    const client = new Client();
    
    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        console.log(`[CompletionSSHManager] 连接就绪: ${sessionInfo.id}`);
        const connection: CachedSSHConnection = {
          client,
          lastUsed: Date.now()
        };
        this.connections.set(sessionInfo.id, connection);
        resolve(connection);
      });
      
      client.on('error', (err) => {
        console.error(`[CompletionSSHManager] 连接错误:`, err);
        reject(err);
      });
      
      // 连接配置
      const connectConfig = {
        host: sessionInfo.host,
        port: sessionInfo.port,
        username: sessionInfo.username,
        password: sessionInfo.password,
        privateKey: sessionInfo.privateKey
      };
      
      client.connect(connectConfig);
    });
  }
  
  // 测试连接是否有效
  private testConnection(client: Client): Promise<void> {
    return new Promise((resolve, reject) => {
      client.exec('echo 1', (err, stream) => {
        if (err) {
          reject(err);
          return;
        }
        stream.on('close', () => resolve());
        stream.on('error', reject);
      });
    });
  }
  
  // 执行后台命令
  public async executeCommand(sessionInfo: SessionInfo, command: string): Promise<CommandResult> {
    console.log(`[CompletionSSHManager] 执行补全命令: ${command}`);
    const connection = await this.getConnection(sessionInfo);
    connection.lastUsed = Date.now();

    try {
      // 从 SessionInfo 中获取当前目录
      const currentDirectory = sessionInfo.currentDirectory || '~';
      console.log(`[CompletionSSHManager] 当前目录: ${currentDirectory}`);

      // 在补全连接中执行命令
      const result = await new Promise<CommandResult>((resolve, reject) => {
        // 使用 cd 命令切换到终端的当前目录，然后执行实际命令
        const wrappedCommand = `cd "${currentDirectory}" && ${command}`;
        console.log(`[CompletionSSHManager] 执行完整命令: ${wrappedCommand}`);
        
        connection.client.exec(wrappedCommand, (err, stream) => {
          if (err) {
            console.error(`[CompletionSSHManager] 执行命令失败:`, err);
            reject(err);
            return;
          }

          let stdout = '';
          let stderr = '';

          stream.on('data', (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString();
          });

          stream.on('close', () => {
            resolve({ stdout, stderr });
          });
        });
      });
      
      console.log('[CompletionSSHManager] 执行命令结果:', result);
      return result;
    } catch (error) {
      console.error(`[CompletionSSHManager] 执行命令失败:`, error);
      throw error;
    }
  }
  
  // 关闭连接
  public async closeConnection(sessionId: string): Promise<void> {
    const connection = this.connections.get(sessionId);
    if (connection) {
      console.log(`[CompletionSSHManager] 关闭连接: ${sessionId}`);
      connection.client.end();
      this.connections.delete(sessionId);
    }
  }
} 