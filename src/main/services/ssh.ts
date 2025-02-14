import { Client, Channel } from 'ssh2';
import type { SessionInfo } from '../../renderer/types';
import { BrowserWindow } from 'electron';
import { sftpManager } from './sftp';
import { storageService } from './storage';
import { Pool, Factory, Options, createPool } from 'generic-pool';

console.log('Loading SSH service...');

interface PooledConnection {
  id: string;
  client: Client;
  lastUsed: number;
}

interface PoolConfig {
  min: number;           // 核心连接数
  max: number;           // 最大连接数
  idleTimeoutMillis: number;  // 空闲超时时间
  acquireTimeoutMillis: number;  // 获取连接超时时间
  priorityRange: number;      // 优先级范围
}

class SSHService {
  private shells: Map<string, Channel> = new Map();
  private currentDirectories: Map<string, string> = new Map();
  
  // 连接池相关
  private pools: Map<string, Pool<PooledConnection>> = new Map();
  private configs: Map<string, SessionInfo> = new Map();
  // 添加专用连接管理
  private dedicatedConnections: Map<string, Client> = new Map();
  
  private readonly DEFAULT_POOL_CONFIG: PoolConfig = {
    min: 5,                    // 增加核心连接数
    max: 10,                   // 保持最大连接数
    idleTimeoutMillis: 600000, // 增加空闲超时时间到10分钟
    acquireTimeoutMillis: 30000, // 保持获取超时时间
    priorityRange: 3,          // 优先级范围
  };

  constructor() {
    console.log('Initializing SSHService...');
    // 移除定期清理任务，因为在渲染进程中可能会有问题
    // setInterval(() => this.cleanupPools(), 60 * 1000);
  }

  /**
   * 创建连接池
   */
  private createPool(sessionId: string, config: SessionInfo): Pool<PooledConnection> {
    const factory = {
      create: async (): Promise<PooledConnection> => {
        const client = new Client();
        await new Promise<void>((resolve, reject) => {
          client.on('ready', resolve);
          client.on('error', reject);
          
          const connConfig: any = {
            host: config.host,
            port: config.port,
            username: config.username,
            keepaliveInterval: 10000,  // 每10秒发送一次心跳
            keepaliveCountMax: 3       // 最多重试3次
          };

          if (config.authType === 'password' && config.password) {
            connConfig.password = config.password;
          } else if (config.authType === 'privateKey' && config.privateKey) {
            connConfig.privateKey = config.privateKey;
          }

          client.connect(connConfig);
        });

        return {
          id: Math.random().toString(36).substr(2, 9),
          client,
          lastUsed: Date.now()
        };
      },
      destroy: async (conn: PooledConnection): Promise<void> => {
        try {
          conn.client.end();
        } catch (error) {
          console.error('Failed to close connection:', error);
        }
      },
      validate: async (conn: PooledConnection): Promise<boolean> => {
        // 如果连接最后使用时间在30秒内，直接返回true
        if (Date.now() - conn.lastUsed < 30000) {
          return true;
        }
        return new Promise((resolve) => {
          conn.client.exec('echo 1', (err) => {
            resolve(!err);
          });
        });
      }
    };

    return createPool(factory, {
      ...this.DEFAULT_POOL_CONFIG,
      testOnBorrow: true,      // 保持借用时检查
      autostart: false,        // 禁用自动启动
      evictionRunIntervalMillis: 0, // 禁用定时清理
      fifo: false,             // 后进先出，优化性能
    });
  }

  /**
   * 清理连接池
   */
  private async cleanupPools(): Promise<void> {
    const now = Date.now();
    for (const [sessionId, pool] of this.pools.entries()) {
      try {
        // 检查池的使用情况
        const status = await pool.size;
        const available = await pool.available;
        
        // 如果所有连接都空闲，且超过一定时间，则清理非核心连接
        if (status === available && available > this.DEFAULT_POOL_CONFIG.min) {
          const borrowed = await pool.borrowed;
          if (borrowed === 0) {
            // 收缩到核心连接数
            await pool.drain();
            await pool.clear();
            const config = this.configs.get(sessionId);
            if (config) {
              const newPool = this.createPool(sessionId, config);
              this.pools.set(sessionId, newPool);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to cleanup pool for session ${sessionId}:`, error);
      }
    }
  }

  /**
   * 获取连接池状态
   */
  async getPoolStatus(sessionId: string): Promise<{
    size: number;
    available: number;
    borrowed: number;
    pending: number;
    max: number;
    min: number;
  }> {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      throw new Error('Session not found');
    }

    return {
      size: await pool.size,
      available: await pool.available,
      borrowed: await pool.borrowed,
      pending: await pool.pending,
      max: this.DEFAULT_POOL_CONFIG.max,
      min: this.DEFAULT_POOL_CONFIG.min
    };
  }

  /**
   * 获取SSH连接
   */
  getConnection(sessionId: string): Client | undefined {
    // 优先返回专用连接
    return this.dedicatedConnections.get(sessionId);
  }

  /**
   * 检查连接状态
   */
  isConnected(sessionId: string): boolean {
    console.log(`[SSH] 检查连接状态: ${sessionId}`);
    // 检查是否有专用连接或连接池
    return this.dedicatedConnections.has(sessionId) || this.pools.has(sessionId);
  }

  async connect(sessionInfo: SessionInfo): Promise<void> {
    console.log('SSHService.connect called with:', sessionInfo);
    const { id } = sessionInfo;

    // 1. 创建专用连接
    const dedicatedClient = new Client();
    await new Promise<void>((resolve, reject) => {
      dedicatedClient.on('ready', resolve);
      dedicatedClient.on('error', reject);
      
      const connConfig: any = {
        host: sessionInfo.host,
        port: sessionInfo.port,
        username: sessionInfo.username
      };

      if (sessionInfo.authType === 'password' && sessionInfo.password) {
        connConfig.password = sessionInfo.password;
      } else if (sessionInfo.authType === 'privateKey' && sessionInfo.privateKey) {
        connConfig.privateKey = sessionInfo.privateKey;
      }

      dedicatedClient.connect(connConfig);
    });
    
    // 2. 存储专用连接
    this.dedicatedConnections.set(id, dedicatedClient);

    // 3. 存储配置信息并创建连接池
    this.configs.set(id, sessionInfo);
    const pool = this.createPool(id, sessionInfo);
    this.pools.set(id, pool);

    // 4. 预热连接池，创建核心连接
    try {
      await Promise.all(
        Array(this.DEFAULT_POOL_CONFIG.min)
          .fill(0)
          .map(async () => {
            const conn = await pool.acquire();
            await pool.release(conn);
          })
      );
      console.log(`Connection pool initialized for session ${id}`);
    } catch (error) {
      console.error('Failed to initialize connection pool:', error);
      // 连接池初始化失败不抛出错误，因为还有专用连接可用
      console.log('Falling back to dedicated connection only');
    }
  }

  /**
   * 执行命令的新方法
   */
  async executeCommand(sessionId: string, command: string, priority: number = 1): Promise<string> {
    const pool = this.pools.get(sessionId);
    if (!pool) {
      throw new Error('Session not found');
    }

    const conn = await pool.acquire(priority);
    try {
      return await new Promise<string>((resolve, reject) => {
        conn.client.exec(command, (err, stream) => {
          if (err) {
            reject(err);
            return;
          }

          let output = '';
          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });
          stream.on('end', () => resolve(output));
          stream.on('error', reject);
        });
      });
    } finally {
      await pool.release(conn);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(sessionId: string): Promise<void> {
    // 1. 清理连接池
    const pool = this.pools.get(sessionId);
    if (pool) {
      await pool.drain();
      await pool.clear();
      this.pools.delete(sessionId);
      this.configs.delete(sessionId);
    }

    // 2. 清理专用连接
    const dedicatedClient = this.dedicatedConnections.get(sessionId);
    if (dedicatedClient) {
      dedicatedClient.end();
      this.dedicatedConnections.delete(sessionId);
    }

    // 3. 清理相关的shells
    for (const [shellId, shell] of this.shells.entries()) {
      if (shellId.startsWith(sessionId + '-')) {
        shell.end();
        this.shells.delete(shellId);
      }
    }
  }

  /**
   * 清理指定会话的连接
   */
  async cleanupConnection(sessionId: string) {
    console.log(`[SSH] 清理连接: ${sessionId}`);
    
    // 1. 清理连接池
    const pool = this.pools.get(sessionId);
    if (pool) {
      await pool.drain();
      await pool.clear();
      this.pools.delete(sessionId);
      this.configs.delete(sessionId);
    }

    // 2. 清理专用连接
    const dedicatedClient = this.dedicatedConnections.get(sessionId);
    if (dedicatedClient) {
      dedicatedClient.end();
      this.dedicatedConnections.delete(sessionId);
    }

    // 3. 清理相关的shells
    for (const [shellId, shell] of this.shells.entries()) {
      if (shellId.startsWith(sessionId + '-')) {
        shell.end();
        this.shells.delete(shellId);
      }
    }
    
    console.log(`[SSH] 连接已清理: ${sessionId}`);
  }

  async createShell(
    shellId: string,
    initialSize?: { rows: number; cols: number }
  ) {
    // 从 shellId 中提取 sessionId
    const sessionId = shellId.split('-')[0];
    
    // 从连接池获取连接
    const pool = this.pools.get(sessionId);
    if (!pool) {
      throw new Error('No SSH connection found');
    }

    // 获取一个专用连接用于shell（优先级最高）
    const pooledConn = await pool.acquire(0);
    const conn = pooledConn.client;

    // 如果这个 shellId 已经存在，先关闭它
    if (this.shells.has(shellId)) {
      console.log(`Shell ${shellId} already exists, closing it first`);
      const oldShell = this.shells.get(shellId);
      if (oldShell) {
        oldShell.end();
        this.shells.delete(shellId);
      }
    }

    console.log(`[SSH] Creating shell with config:`, initialSize);
    return new Promise<void>((resolve, reject) => {
      // 设置 PTY 选项，启用正确的终端模式
      const ptyConfig = {
        term: 'xterm-256color',
        pty: true,
        rows: initialSize?.rows || 24,
        cols: initialSize?.cols || 80
      };

      console.log(`[SSH] Creating shell with config:`, ptyConfig);

      conn.shell(ptyConfig, (err, stream) => {
        if (err) {
          console.error('Failed to create shell:', err);
          pool.release(pooledConn).catch(console.error);
          reject(err);
          return;
        }

        // 设置流的编码
        stream.setEncoding('utf8');

        console.log(`Shell created successfully: ${shellId}`);
        this.shells.set(shellId, stream);

        // 获取主窗口
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (!mainWindow) {
          console.error('No main window found');
          pool.release(pooledConn).catch(console.error);
          reject(new Error('No main window found'));
          return;
        }

        // 初始化目录为用户主目录
        this.updateCurrentDirectory(shellId, '~');

        // 监听数据事件
        stream.on('data', (data: Buffer) => {
          const dataStr = data.toString();
          console.log(`Sending shell data to renderer [${shellId}]:`, dataStr);
          mainWindow.webContents.send(`ssh:data:${shellId}`, dataStr);

          // 检查是否是 cd 命令
          if (this.isChangeDirectoryCommand(dataStr)) {
            this.handleDirectoryChange(shellId, dataStr);
          }
        });

        // 监听关闭事件
        stream.on('close', () => {
          console.log(`Shell session closed [${shellId}]`);
          mainWindow.webContents.send(`ssh:close:${shellId}`);
          this.shells.delete(shellId);
          // 释放连接回连接池
          pool.release(pooledConn).catch(console.error);
        });

        // 监听错误事件
        stream.on('error', (error: Error) => {
          console.error(`Shell error [${shellId}]:`, error);
          mainWindow.webContents.send(`ssh:close:${shellId}`);
          this.shells.delete(shellId);
          // 释放连接回连接池
          pool.release(pooledConn).catch(console.error);
        });
        
        resolve();
      });
    });
  }

  async write(shellId: string, data: string) {
    console.log(`Writing to shell [${shellId}]:`, data);
    const shell = this.shells.get(shellId);
    if (!shell) {
      throw new Error('No shell session found');
    }
    shell.write(data);
  }

  async resize(shellId: string, cols: number, rows: number) {
    console.log(`Resizing shell [${shellId}] to ${cols}x${rows}`);
    const shell = this.shells.get(shellId);
    if (!shell) {
      throw new Error('No shell session found');
    }
    shell.setWindow(rows, cols, 0, 0);
  }

  // 检查是否是 cd 命令
  private isChangeDirectoryCommand(data: string): boolean {
    // 匹配 cd 命令，包括带参数的情况
    const cdPattern = /^cd\s+.+$/;
    const isCD = cdPattern.test(data.trim());
    console.log('[SSH] isChangeDirectoryCommand check:', { data: data.trim(), isCD });
    return isCD;
  }

  // 处理目录变更
  private async handleDirectoryChange(shellId: string, command: string) {
    console.log('[SSH] handleDirectoryChange:', { shellId, command });
    try {
      // 执行 pwd 命令获取新的工作目录
      const shell = this.shells.get(shellId);
      if (!shell) {
        console.log('[SSH] Shell not found for directory change:', shellId);
        return;
      }

      shell.write('pwd\n');
      console.log('[SSH] Sent pwd command to get new directory');
      
      // 等待并处理 pwd 命令的输出
      const output = await new Promise<string>((resolve) => {
        const handler = (data: Buffer) => {
          const pwd = data.toString().trim();
          console.log('[SSH] Received pwd output:', pwd);
          if (pwd.startsWith('/')) {  // 确保是有效的路径
            shell.removeListener('data', handler);
            resolve(pwd);
          }
        };
        shell.on('data', handler);
      });

      // 更新当前目录
      await this.updateCurrentDirectory(shellId, output);
    } catch (error) {
      console.error(`[SSH] Failed to handle directory change [${shellId}]:`, error);
    }
  }

  // 更新当前目录
  private async updateCurrentDirectory(shellId: string, directory: string) {
    console.log('[SSH] Updating current directory:', { shellId, directory });
    
    // 更新目录映射
    this.currentDirectories.set(shellId, directory);
    
    // 更新 SessionInfo 中的 currentDirectory
    const sessionId = shellId.split('-')[0];
    try {
      const sessions = await storageService.loadSessions();
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1) {
        sessions[sessionIndex].currentDirectory = directory;
        await storageService.saveSessions(sessions);
        console.log('[SSH] Updated SessionInfo currentDirectory:', { sessionId, directory });
      } else {
        console.log('[SSH] Session not found:', sessionId);
      }
    } catch (error) {
      console.error('[SSH] Failed to update SessionInfo:', error);
    }
  }

  // 获取当前目录
  getCurrentDirectory(shellId: string): string {
    const directory = this.currentDirectories.get(shellId);
    console.log('[SSH] Getting current directory:', { shellId, directory });
    return directory || '~';
  }

  // 内部方法：从连接池获取连接
  private async getPoolConnection(sessionId: string, priority: number = 1): Promise<PooledConnection | undefined> {
    const pool = this.pools.get(sessionId);
    if (!pool) return undefined;
    console.log('[SSH] getPoolConnection获取连接池连接:', pool );
    try {
      return await pool.acquire(priority);
    } catch (error) {
      console.error(`[SSH] 获取连接池连接失败: ${sessionId}`, error);
      return undefined;
    }
  }

  // 抽取命令执行逻辑为独立方法
  private async execCommand(client: Client, command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      client.exec(command, (err, stream) => {
        if (err) {
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
          resolve(stdout || stderr);
        });

        stream.on('error', reject);
      });
    });
  }

  /**
   * 直接执行命令（不依赖shell session）
   */
  async executeCommandDirect(sessionId: string, command: string): Promise<string> {
    console.log(`[SSH] Executing direct command: ${command}`);
    
    // 1. 尝试从连接池获取连接
    const poolConn = await this.getPoolConnection(sessionId);
    if (poolConn) {
      try {
        return await this.execCommand(poolConn.client, command);
      } finally {
        await this.pools.get(sessionId)?.release(poolConn);
      }
    }
    
    // 2. 如果连接池不可用，回退到专用连接
    const dedicatedClient = this.dedicatedConnections.get(sessionId);
    if (!dedicatedClient) {
      throw new Error('SSH connection not found');
    }
    
    return await this.execCommand(dedicatedClient, command);
  }
}

console.log('Creating SSH service instance...');
export const sshService = new SSHService();
console.log('SSH service instance created.');