import { Client, ClientChannel } from 'ssh2';
import { eventBus, TabInfo } from '@/renderer/services/eventBus';
import { sshService } from '@/renderer/services/ssh';
import type { SessionInfo } from '@/renderer/types/index';

interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ShellCommand {
  id: string;
  command: string;
}

interface ShellResponse {
  id: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface CachedSSHConnection {
  client: Client;
  shell: ClientChannel | null;
  isReady: boolean;
  shellReady: boolean;
  pendingCommands: Map<string, {
    resolve: (result: CommandResult) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }>;
  buffer: string;
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

    // 监听标签页移除事件
    eventBus.on('completion:tab-remove', (tabInfo: TabInfo) => {
      console.log(`[CompletionSSHManager] Tab removed, cleaning up connection for tab: ${tabInfo.tabId}`);
      this.closeConnectionForTab(tabInfo.tabId);
    });
  }

  public static getInstance(): CompletionSSHManager {
    if (!CompletionSSHManager.instance) {
      CompletionSSHManager.instance = new CompletionSSHManager();
    }
    return CompletionSSHManager.instance;
  }

  private async updateDirectory(tabId: string, command: string) {
    if (command.startsWith('cd')) {
      console.log(`[CompletionSSHManager] Updating directory for tab ${tabId}, command: ${command}`);
      try {
        const sessionInfo = this.sessionMap.get(tabId);
        if (!sessionInfo) {
          throw new Error(`No session found for tab ${tabId}`);
        }

        const connection = await this.getConnection(sessionInfo);
        
        // 执行 cd 命令
        const cdResult = await this.executeCommand(connection, command);
        if (cdResult.exitCode === 0) {
          // 如果 cd 成功，获取当前目录
          const pwdResult = await this.executeCommand(connection, 'pwd -P');
          if (pwdResult.exitCode === 0) {
            const newDirectory = pwdResult.stdout.trim();
            console.log(`[CompletionSSHManager] New directory for tab ${tabId}: ${newDirectory}`);
            this.currentDirectories.set(tabId, newDirectory);
          } else {
            console.error(`[CompletionSSHManager] Failed to get current directory:`, pwdResult.stderr);
          }
        } else {
          console.error(`[CompletionSSHManager] Failed to change directory:`, cdResult.stderr);
        }
      } catch (error) {
        console.error(`[CompletionSSHManager] Failed to update directory:`, error);
      }
    }
  }

  public getCurrentDirectory(tabId: string): string {
    const dir = this.currentDirectories.get(tabId);
    return dir || '~';
  }

  public getCurrentDirectoryN(): string {
    return this.getCurrentDirectory(eventBus.getCurrentTabId());
  }

  private async executeCommand(connection: CachedSSHConnection, command: string): Promise<CommandResult> {
    console.log(`[CompletionSSHManager] Executing command: ${command}`);
    
    if (!connection.shell || !connection.shellReady) {
      console.log('[CompletionSSHManager] Shell not ready, creating new session');
      await this.createShellSession(connection);
    }

    return new Promise((resolve, reject) => {
      if (!connection.shell) {
        console.error('[CompletionSSHManager] Shell still not available after creation');
        reject(new Error('Shell session not available'));
        return;
      }

      const commandId = Date.now().toString();
      const cmd: ShellCommand = {
        id: commandId,
        command: this.shouldPreserveOutput(command) ? command + ' | cat' : command
      };

      console.log(`[CompletionSSHManager] Sending command with ID: ${commandId}`);
      
      // 设置命令超时
      const timer = setTimeout(() => {
        const pending = connection.pendingCommands.get(commandId);
        if (pending) {
          console.error(`[CompletionSSHManager] Command timed out: ${command} (ID: ${commandId})`);
          console.log(`[CompletionSSHManager] Current buffer content:`, connection.buffer);
          pending.reject(new Error('Command execution timeout'));
          connection.pendingCommands.delete(commandId);
        }
      }, 60000);

      // 保存 promise 的 resolve 和 reject
      connection.pendingCommands.set(commandId, {
        resolve: (result: CommandResult) => {
          // 确保输出中的换行符被正确保留
          resolve({
            ...result,
            stdout: result.stdout.replace(/\\n/g, '\n'),
            stderr: result.stderr.replace(/\\n/g, '\n')
          });
        },
        reject,
        timer
      });

      // 发送 JSON 格式的命令，确保换行符被正确编码
      const jsonCmd = JSON.stringify({
        ...cmd,
        command: cmd.command.replace(/\n/g, '\\n')
      }) + '\n';
      console.log(`[CompletionSSHManager] Writing command to shell:`, jsonCmd);
      connection.shell.write(jsonCmd);
    });
  }

  private handleShellOutput(connection: CachedSSHConnection, data: string) {
    // console.log(`[CompletionSSHManager] Received shell output:`, data);
    connection.buffer += data;

    // 尝试解析完整的 JSON 响应
    const lines = connection.buffer.split('\n');
    let newBuffer = '';
    
    for (const line of lines) {
      if (line.trim().startsWith('{') && line.trim().endsWith('}')) {
        try {
          console.log(`[CompletionSSHManager] Found JSON line:`, line);
          const response = JSON.parse(line);
          
          // 查找并处理对应的命令
          const pending = connection.pendingCommands.get(response.id);
          if (pending) {
            console.log(`[CompletionSSHManager] Found pending command for ID ${response.id}`);
            clearTimeout(pending.timer);
            
            // 解码 base64 输出
            const stdout = Buffer.from(response.stdout, 'base64').toString();
            const stderr = Buffer.from(response.stderr, 'base64').toString();
            
            pending.resolve({
              exitCode: response.exitCode,
              stdout,
              stderr
            });
            connection.pendingCommands.delete(response.id);
          } else {
            console.log(`[CompletionSSHManager] No pending command found for ID ${response.id}`);
          }
        } catch (error) {
          console.error(`[CompletionSSHManager] JSON parse error:`, error);
          // 如果这行看起来像 JSON 但解析失败，保留它以防是不完整的
          newBuffer += line + '\n';
        }
      } else {
        // 保留非 JSON 行，以防后面需要调试
        newBuffer += line + '\n';
      }
    }

    // 更新缓冲区
    connection.buffer = newBuffer;

    // 如果缓冲区太大，只保留最后的部分
    if (connection.buffer.length > 1024 * 1024) {
      console.log(`[CompletionSSHManager] Truncating large buffer`);
      connection.buffer = connection.buffer.substring(connection.buffer.length - 1024 * 1024);
    }
  }

  private async createShellSession(connection: CachedSSHConnection): Promise<void> {
    console.log('[CompletionSSHManager] Creating shell session');
    if (connection.shell && connection.shellReady) {
      console.log('[CompletionSSHManager] Shell session already exists and ready');
      return;
    }

    return new Promise((resolve, reject) => {
      connection.client.shell((err, shell) => {
        if (err) {
          console.error('[CompletionSSHManager] Failed to create shell:', err);
          reject(err);
          return;
        }

        console.log('[CompletionSSHManager] Shell created, initializing...');
        connection.shell = shell;
        connection.buffer = '';
        connection.pendingCommands = new Map();
        
        // 设置编码
        shell.setEncoding('utf8');
        
        // 处理输出
        shell.on('data', (data: string) => {
          this.handleShellOutput(connection, data);
        });
        
        // 处理错误
        shell.on('error', (err: Error) => {
          console.error('[CompletionSSHManager] Shell error:', err);
          connection.shellReady = false;
        });

        // 处理关闭
        shell.on('close', () => {
          console.log('[CompletionSSHManager] Shell closed');
          connection.shellReady = false;
          connection.shell = null;
        });

        // 初始化 shell 环境
        //统计耗时
        const startTime = Date.now();
        // this.initializeShell(shell).then(() => {
        //   console.log(`[CompletionSSHManager] Shell initialization completed，time: ${Date.now() - startTime}ms`);
        //   connection.shellReady = true;
        //   resolve();
        // }).catch(reject);

      });
    });
  }



  public async executeCommandForTab(tabId: string, command: string): Promise<CommandResult> {
    console.log(`[CompletionSSHManager] Executing command for tab ${tabId}: ${command}`);
    const sessionInfo = this.sessionMap.get(tabId);
    if (!sessionInfo) {
      throw new Error(`No session found for tab ${tabId}`);
    }

    try {
      const connection = await this.getConnection(sessionInfo);
      return await this.executeCommand(connection, command);
    } catch (error) {
      console.error(`[CompletionSSHManager] Command failed for tab ${tabId}:`, error);
      throw error;
    }
  }

  public async setSessionForTab(tabId: string, sessionInfo: SessionInfo) {
    console.log(`[CompletionSSHManager] Setting session for tab ${tabId}:`, sessionInfo.id);
    this.sessionMap.set(tabId, sessionInfo);
    
    try {
      const connection = await this.getConnection(sessionInfo);
      await this.createShellSession(connection);
      const pwdResult = await this.executeCommand(connection, 'pwd -P');
      //初始化获取当前目录
      if (pwdResult.exitCode === 0) {
        const newDirectory = pwdResult.stdout.trim();
        console.log(`[CompletionSSHManager] New directory for tab ${tabId}: ${newDirectory}`);
        this.currentDirectories.set(tabId, newDirectory);
      } else {
        console.error(`[CompletionSSHManager] Failed to get current directory:`, pwdResult.stderr);
      }
      console.log(`[CompletionSSHManager] Connection and shell created for tab ${tabId}`);
    } catch (error) {
      console.error(`[CompletionSSHManager] Failed to create connection for tab ${tabId}:`, error);
    }
  }

  private async getConnection(sessionInfo: SessionInfo): Promise<CachedSSHConnection> {
    const existingConnection = this.connections.get(sessionInfo.id);
    if (existingConnection) {
      try {
        await this.testConnection(existingConnection.client);
        return existingConnection;
      } catch (error) {
        console.log(`[CompletionSSHManager] Existing connection is broken, creating new one:`, error);
        try {
          existingConnection.client.end();
        } catch (e) {
          console.error(`[CompletionSSHManager] Failed to close old connection:`, e);
        }
        this.connections.delete(sessionInfo.id);
      }
    }
    
    return this.createConnection(sessionInfo);
  }

  private async createConnection(sessionInfo: SessionInfo): Promise<CachedSSHConnection> {
    console.log(`[CompletionSSHManager] Creating new connection: ${sessionInfo.id}`);
    const client = new Client();
    
    return new Promise((resolve, reject) => {
      const connection: CachedSSHConnection = {
        client,
        shell: null,
        isReady: false,
        shellReady: false,
        pendingCommands: new Map(),
        buffer: ''
      };
      
      client.on('ready', () => {
        console.log(`[CompletionSSHManager] Connection ready: ${sessionInfo.id}`);
        connection.isReady = true;
        this.connections.set(sessionInfo.id, connection);
        resolve(connection);
      });
      
      client.on('error', (err: Error) => {
        console.error(`[CompletionSSHManager] Connection error:`, err);
        reject(err);
      });

      client.on('end', () => {
        console.log(`[CompletionSSHManager] Connection ended: ${sessionInfo.id}`);
        this.connections.delete(sessionInfo.id);
      });

      client.on('close', () => {
        console.log(`[CompletionSSHManager] Connection closed: ${sessionInfo.id}`);
        this.connections.delete(sessionInfo.id);
      });
      
      client.connect({
        host: sessionInfo.host,
        port: sessionInfo.port,
        username: sessionInfo.username,
        password: sessionInfo.password,
        privateKey: sessionInfo.privateKey
      });
    });
  }

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

  private closeConnectionForTab(tabId: string) {
    const sessionInfo = this.sessionMap.get(tabId);
    if (sessionInfo) {
      const connection = this.connections.get(sessionInfo.id);
      if (connection) {
        console.log(`[CompletionSSHManager] Closing connection for tab ${tabId}`);
        try {
          if (connection.shell) {
            connection.shell.end();
          }
          connection.client.end();
        } catch (error) {
          console.error(`[CompletionSSHManager] Error closing connection:`, error);
        }
        this.connections.delete(sessionInfo.id);
      }
      this.sessionMap.delete(tabId);
      this.currentDirectories.delete(tabId);
    }
  }

  /**
   * 判断是否需要保持命令输出格式
   */
  private shouldPreserveOutput(command: string): boolean {
    // 需要保持输出格式的命令列表
    const preserveOutputCommands = ['ls', 'find', 'grep', 'ps'];
    const cmdName = command.trim().split(/\s+/)[0];
    return preserveOutputCommands.some(cmd => cmdName === cmd);
  }
} 