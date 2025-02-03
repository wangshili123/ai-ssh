import { Client } from 'ssh2';
import { eventBus } from '@/renderer/services/eventBus';
import { sshService } from '@/renderer/services/ssh';
import type { SessionInfo } from '@/main/services/storage';

interface CachedSSHConnection {
  client: Client;
  lastUsed: number;
  isReady: boolean;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

export class CompletionSSHManager {
  private static instance: CompletionSSHManager;
  private connections: Map<string, CachedSSHConnection> = new Map();
  private currentDirectories: Map<string, string> = new Map(); // tabId -> currentDirectory
  private sessionMap: Map<string, SessionInfo> = new Map(); // tabId -> sessionInfo
  
  private constructor() {
    // 监听终端目录变更事件
    eventBus.on('terminal:directory-change', async ({ tabId, command }) => {
      await this.updateDirectory(tabId, command);
    });
  }

  // 更新目录（由终端 cd 命令触发）
  private async updateDirectory(tabId: string, command: string) {
    if (command.startsWith('cd ')) {
      console.log(`[CompletionSSHManager] Updating directory for tab ${tabId}, command: ${command}`);
      try {
        // 在补全连接中执行相同的 cd 命令
        const cdResult = await this.executeCommandForTab(tabId, command);
        console.log(`[CompletionSSHManager] CD command result:`, cdResult);
        
        // 获取新目录
        console.log(`[CompletionSSHManager] Executing PWD command for tab ${tabId}`);
        const result = await this.executeCommandForTab(tabId, 'pwd');
        console.log(`[CompletionSSHManager] PWD command result:`, result);
        
        if (result.stdout) {
          const newDirectory = result.stdout.trim();
          console.log(`[CompletionSSHManager] New directory for tab ${tabId}: ${newDirectory}`);
          // 更新目录映射
          this.currentDirectories.set(tabId, newDirectory);
        } else {
          console.error(`[CompletionSSHManager] PWD command returned empty output for tab ${tabId}`);
        }
      } catch (error) {
        console.error(`[CompletionSSHManager] Failed to update directory:`, error);
      }
    }
  }

  // 获取当前目录（用于补全）
  public getCurrentDirectory(tabId: string): string {
    const dir = this.currentDirectories.get(tabId);
    console.log(`[CompletionSSHManager] Getting directory for tab ${tabId}: ${dir || '~'}`);
    return dir || '~';
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
      console.log(`[CompletionSSHManager] 复用现有连接: ${sessionInfo.id}`);
      try {
        await this.testConnection(existingConnection.client);
        return existingConnection;
      } catch (error) {
        console.log(`[CompletionSSHManager] 现有连接已断开，创建新连接:`, error);
        // 确保关闭旧连接
        try {
          existingConnection.client.end();
        } catch (e) {
          console.error(`[CompletionSSHManager] 关闭旧连接失败:`, e);
        }
        this.connections.delete(sessionInfo.id);
      }
    }
    
    console.log(`[CompletionSSHManager] 创建新连接: ${sessionInfo.id}`);
    const client = new Client();
    
    return new Promise((resolve, reject) => {
      const connection: CachedSSHConnection = {
        client,
        lastUsed: Date.now(),
        isReady: false
      };

      let connectionTimeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        client.end();
      }, 10000); // 10秒超时
      
      client.on('ready', () => {
        console.log(`[CompletionSSHManager] 连接就绪: ${sessionInfo.id}`);
        clearTimeout(connectionTimeout);
        connection.isReady = true;
        this.connections.set(sessionInfo.id, connection);
        resolve(connection);
      });
      
      client.on('error', (err) => {
        console.error(`[CompletionSSHManager] 连接错误:`, err);
        clearTimeout(connectionTimeout);
        reject(err);
      });

      client.on('end', () => {
        console.log(`[CompletionSSHManager] 连接已结束: ${sessionInfo.id}`);
        this.connections.delete(sessionInfo.id);
      });

      client.on('close', () => {
        console.log(`[CompletionSSHManager] 连接已关闭: ${sessionInfo.id}`);
        this.connections.delete(sessionInfo.id);
      });
      
      // 连接配置
      const connectConfig = {
        host: sessionInfo.host,
        port: sessionInfo.port,
        username: sessionInfo.username,
        password: sessionInfo.password,
        privateKey: sessionInfo.privateKey,
        keepaliveInterval: 10000, // 每10秒发送一次心跳
        keepaliveCountMax: 3      // 最多重试3次
      };
      
      client.connect(connectConfig);
    });
  }
  
  // 测试连接是否有效
  private async testConnection(client: Client): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test connection timeout'));
      }, 5000);

      client.exec('echo 1', (err, stream) => {
        if (err) {
          clearTimeout(timeout);
          reject(err);
          return;
        }

        let testOutput = '';
        stream.on('data', (data: Buffer) => {
          testOutput += data.toString();
        });

        stream.on('close', (code: number) => {
          clearTimeout(timeout);
          if (code === 0 && testOutput.trim() === '1') {
            resolve();
          } else {
            reject(new Error(`Test connection failed with code ${code}`));
          }
        });

        stream.on('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
  }
  
  // 为特定会话执行命令
  public async executeCommand(sessionInfo: SessionInfo, command: string): Promise<CommandResult> {
    console.log(`[CompletionSSHManager] Executing command for session ${sessionInfo.id}: ${command}`);
    const connection = await this.getConnection(sessionInfo);
    
    // 等待连接就绪
    if (!connection.isReady) {
      console.log(`[CompletionSSHManager] Waiting for connection to be ready...`);
      await new Promise<void>((resolve) => {
        const checkReady = () => {
          if (connection.isReady) {
            resolve();
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      });
    }
    
    return new Promise<CommandResult>((resolve, reject) => {
      console.log(`[CompletionSSHManager] Connection ready, executing command: ${command}`);
      
      // 确保命令以换行符结尾
      if (!command.endsWith('\n')) {
        command += '\n';
      }
      
      connection.client.exec(command, (err, stream) => {
        if (err) {
          console.error(`[CompletionSSHManager] Command execution failed:`, err);
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';
        let ended = false;
        let closed = false;

        const checkComplete = () => {
          if (ended && closed) {
            console.log(`[CompletionSSHManager] Command execution complete:`, { command, stdout, stderr });
            resolve({ stdout, stderr });
          }
        };

        stream.on('data', (data: Buffer) => {
          const chunk = data.toString();
          console.log(`[CompletionSSHManager] Received stdout chunk:`, chunk);
          stdout += chunk;
        });

        stream.stderr?.on('data', (data: Buffer) => {
          const chunk = data.toString();
          console.log(`[CompletionSSHManager] Received stderr chunk:`, chunk);
          stderr += chunk;
        });

        stream.on('end', () => {
          console.log(`[CompletionSSHManager] Stream ended`);
          ended = true;
          checkComplete();
        });

        stream.on('close', (code: number) => {
          console.log(`[CompletionSSHManager] Stream closed with code:`, code);
          closed = true;
          if (code !== 0) {
            reject(new Error(`Command failed with code ${code}: ${stderr}`));
            return;
          }
          checkComplete();
        });

        stream.on('error', (err: Error) => {
          console.error(`[CompletionSSHManager] Stream error:`, err);
          reject(err);
        });
      });
    });
  }

  // 为特定标签页执行命令
  private async executeCommandForTab(tabId: string, command: string): Promise<CommandResult> {
    console.log(`[CompletionSSHManager] Executing command for tab ${tabId}: ${command}`);
    const sessionInfo = this.sessionMap.get(tabId);
    if (!sessionInfo) {
      console.error(`[CompletionSSHManager] No session found for tab ${tabId}`);
      throw new Error(`No session found for tab ${tabId}`);
    }
    try {
      // 去除命令两端的空格
      command = command.trim();
      const result = await this.executeCommand(sessionInfo, command);
      console.log(`[CompletionSSHManager] Command result for tab ${tabId}:`, result);
      return result;
    } catch (error) {
      console.error(`[CompletionSSHManager] Command failed for tab ${tabId}:`, error);
      throw error;
    }
  }

  // 设置标签页的会话信息
  public setSessionForTab(tabId: string, sessionInfo: SessionInfo) {
    this.sessionMap.set(tabId, sessionInfo);
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