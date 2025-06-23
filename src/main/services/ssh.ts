import { Client, Channel } from 'ssh2';
import type { SessionInfo } from '../../renderer/types';
import { BrowserWindow } from 'electron';
import { storageService } from './storage';
import { Pool, createPool } from 'generic-pool';
import { GlobalSSHManager, ConnectionType } from './GlobalSSHManager';

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

  // 全局SSH连接管理器
  private globalManager: GlobalSSHManager;

  // 连接池相关 (保留用于向后兼容，逐步迁移)
  private pools: Map<string, Pool<PooledConnection>> = new Map();
  private configs: Map<string, SessionInfo> = new Map();
  // 添加专用连接管理 (保留用于向后兼容，逐步迁移)
  private dedicatedConnections: Map<string, Client> = new Map();

  // 并发控制：防止同一会话的多个服务同时创建连接
  private connectionPromises: Map<string, Promise<void>> = new Map();
  
  private readonly DEFAULT_POOL_CONFIG: PoolConfig = {
    min: 5,                    // 增加核心连接数，支持更多并发
    max: 15,                   // 增加最大连接数，应对高并发场景
    idleTimeoutMillis: 900000, // 增加空闲超时时间到15分钟
    acquireTimeoutMillis: 10000, // 减少获取超时时间，快速失败
    priorityRange: 5,          // 增加优先级范围，支持更细粒度的优先级控制
  };

  constructor() {
    console.log('Initializing SSHService...');

    // 初始化全局SSH连接管理器
    this.globalManager = GlobalSSHManager.getInstance();

    // 移除定期清理任务，因为在渲染进程中可能会有问题
    // setInterval(() => this.cleanupPools(), 60 * 1000);

    // 启动时预热常用连接
    this.initializeFrequentConnections();
  }

  /**
   * 初始化常用连接预热
   */
  private async initializeFrequentConnections(): Promise<void> {
    // 延迟5秒后开始预热，避免影响应用启动速度
    setTimeout(async () => {
      try {
        console.log('[SSH] 开始预热常用连接...');
        const recentSessions = await this.getRecentSessions();
        await this.warmupFrequentConnections(recentSessions);
        console.log('[SSH] 常用连接预热完成');
      } catch (error) {
        console.error('[SSH] 预热常用连接失败:', error);
      }
    }, 5000);
  }

  /**
   * 获取最近使用的会话
   */
  private async getRecentSessions(): Promise<SessionInfo[]> {
    try {
      // TODO: 从存储服务获取最近使用的会话
      // 暂时返回空数组，后续可以实现会话历史记录功能
      console.log('[SSH] 暂未实现会话历史记录，跳过预热');
      return [];
    } catch (error) {
      console.error('[SSH] 获取最近会话失败:', error);
      return [];
    }
  }

  /**
   * 预热常用连接
   */
  private async warmupFrequentConnections(sessions: SessionInfo[]): Promise<void> {
    const warmupPromises = sessions.map(async (session, index) => {
      try {
        console.log(`[SSH] 预热连接 ${index + 1}/${sessions.length}: ${session.host}`);
        await this.connect(session);
        console.log(`[SSH] 预热连接成功: ${session.host}`);
      } catch (error) {
        console.warn(`[SSH] 预热连接失败 ${session.host}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
  }

  /**
   * 创建连接池
   */
  private createPool(sessionId: string, config: SessionInfo): Pool<PooledConnection> {
    const factory = {
      create: async (): Promise<PooledConnection> => {
        const createStartTime = Date.now();
        console.log(`[SSH] 连接池工厂开始创建新连接...`);
        const client = new Client();
        await new Promise<void>((resolve, reject) => {
          client.on('ready', () => {
            console.log(`[SSH] 连接池工厂连接建立成功, 耗时: ${Date.now() - createStartTime}ms`);
            resolve();
          });
          client.on('error', (err) => {
            console.error(`[SSH] 连接池工厂连接失败:`, err);
            reject(err);
          });

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

          console.log(`[SSH] 连接池工厂开始连接到 ${config.host}:${config.port}...`);
          client.connect(connConfig);
        });

        const connectionId = Math.random().toString(36).substr(2, 9);
        console.log(`[SSH] 连接池工厂创建连接完成, ID: ${connectionId}`);
        return {
          id: connectionId,
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
      testOnBorrow: false,     // 禁用借用时检查，提升性能
      autostart: true,         // 启用自动启动，立即创建核心连接
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

  /**
   * 检查SSH客户端连接是否有效
   */
  private isClientConnected(client: Client): boolean {
    try {
      // 检查客户端是否存在
      if (!client) return false;

      // 尝试检查连接状态，ssh2的Client没有直接的状态属性
      // 我们通过检查内部状态来判断
      const clientAny = client as any;

      // 检查是否已经关闭或销毁
      if (clientAny._sock && clientAny._sock.destroyed) {
        return false;
      }

      // 检查是否处于连接状态
      if (clientAny._state && clientAny._state !== 'authenticated') {
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SSH] 检查客户端连接状态时出错:', error);
      return false;
    }
  }

  /**
   * 重新连接会话
   */
  private async reconnectSession(sessionId: string, sessionInfo: SessionInfo): Promise<void> {
    console.log(`[SSH] 开始重新连接会话: ${sessionId}`);

    // 清理旧连接
    const oldClient = this.dedicatedConnections.get(sessionId);
    if (oldClient) {
      try {
        oldClient.end();
      } catch (error) {
        console.error(`[SSH] 清理旧连接时出错: ${sessionId}`, error);
      }
      this.dedicatedConnections.delete(sessionId);
    }

    // 创建新连接
    try {
      await this.connectWithGlobalManager(sessionInfo);
      console.log(`[SSH] 重新连接成功: ${sessionId}`);
    } catch (error) {
      console.error(`[SSH] 重新连接失败: ${sessionId}`, error);
      throw error;
    }
  }

  /**
   * 处理Shell断开连接
   */
  private handleShellDisconnection(shellId: string, sessionId: string): void {
    console.log(`[SSH] 处理Shell断开连接: ${shellId}`);

    // 检查是否还有其他活跃的Shell会话
    const hasOtherShells = Array.from(this.shells.keys()).some(id =>
      id !== shellId && id.startsWith(sessionId + '-')
    );

    console.log(`[SSH] 检查其他Shell会话 - sessionId: ${sessionId}, hasOtherShells: ${hasOtherShells}`);

    // 如果没有其他活跃的Shell会话，清理专用连接状态
    if (!hasOtherShells) {
      console.log(`[SSH] 没有其他活跃Shell，清理专用连接状态 - sessionId: ${sessionId}`);
      this.globalManager.setDedicatedConnectionStatus(sessionId, false);
    }

    // 获取主窗口
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      console.error('[SSH] 未找到主窗口');
      return;
    }

    // 通知渲染进程连接已断开
    mainWindow.webContents.send(`ssh:disconnected:${shellId}`, {
      shellId,
      sessionId,
      timestamp: Date.now()
    });

    console.log(`[SSH] 已通知渲染进程连接断开: ${shellId}`);
  }

  /**
   * 获取连接池（如果可用）
   */
  getPool(sessionId: string): Pool<PooledConnection> | undefined {
    return this.pools.get(sessionId);
  }

  /**
   * 检查连接池是否可用且有可用连接
   */
  isPoolAvailable(sessionId: string): boolean {
    const pool = this.pools.get(sessionId);
    if (!pool) return false;

    try {
      // 检查连接池是否有可用连接
      return pool.available > 0;
    } catch (error) {
      console.error(`[SSH] 检查连接池可用性失败 ${sessionId}:`, error);
      return false;
    }
  }

  /**
   * 获取专用连接
   */
  getDedicatedConnection(sessionId: string): Client | undefined {
    return this.dedicatedConnections.get(sessionId);
  }

  async connect(sessionInfo: SessionInfo): Promise<void> {
    console.log('SSHService.connect called with:', sessionInfo);
    const { id } = sessionInfo;

    // 并发控制：如果已有连接正在创建，等待其完成
    const existingPromise = this.connectionPromises.get(id);
    if (existingPromise) {
      console.log(`[SSH] 检测到并发连接请求，等待现有连接完成: ${id}`);
      await existingPromise;
      return;
    }

    // 使用新的GlobalSSHManager进行连接管理
    const connectionPromise = this.connectWithGlobalManager(sessionInfo);
    this.connectionPromises.set(id, connectionPromise);

    try {
      await connectionPromise;
    } finally {
      // 清理连接Promise
      this.connectionPromises.delete(id);
    }
  }

  /**
   * 使用GlobalSSHManager进行连接
   */
  private async connectWithGlobalManager(sessionInfo: SessionInfo): Promise<void> {
    console.log(`[SSH] 使用GlobalSSHManager连接: ${sessionInfo.id}`);

    // 注册会话信息到全局管理器
    await this.globalManager.registerSession(sessionInfo);

    // 为了向后兼容，仍然创建专用连接并存储到旧的映射中
    // 这样现有的代码仍然可以通过getDedicatedConnection获取连接
    const handle = await this.globalManager.getConnection(sessionInfo.id, ConnectionType.TERMINAL);
    this.dedicatedConnections.set(sessionInfo.id, handle.client);

    // 通知GlobalSSHManager专用连接已建立
    console.log(`[SSH] 通知GlobalSSHManager专用连接已建立 - sessionId: ${sessionInfo.id}`);
    this.globalManager.setDedicatedConnectionStatus(sessionInfo.id, true);

    // 存储配置信息（但不创建旧的连接池）
    this.configs.set(sessionInfo.id, sessionInfo);

    console.log(`[SSH] GlobalSSHManager连接建立完成: ${sessionInfo.id}`);
  }

  /**
   * 内部连接创建方法
   */
  private async createConnectionInternal(sessionInfo: SessionInfo): Promise<void> {
    const { id } = sessionInfo;
    const startTime = Date.now();

    // 1. 快速创建专用连接
    console.log(`[SSH] 开始创建专用连接 ${id}...`);
    const dedicatedClient = await this.createDedicatedConnection(sessionInfo);

    // 2. 存储专用连接
    this.dedicatedConnections.set(id, dedicatedClient);
    console.log(`[SSH] 专用连接已存储 ${id}`);
    console.log(`[SSH] 专用连接建立完成 ${id}, 总耗时: ${Date.now() - startTime}ms`);

    // 3. 异步初始化连接池（不阻塞返回）
    this.initializePoolAsync(id, sessionInfo);
  }

  /**
   * 创建专用连接
   */
  private async createDedicatedConnection(sessionInfo: SessionInfo): Promise<Client> {
    const dedicatedStartTime = Date.now();
    const dedicatedClient = new Client();

    await new Promise<void>((resolve, reject) => {
      dedicatedClient.on('ready', () => {
        console.log(`[SSH] 专用连接建立成功 ${sessionInfo.id}, 耗时: ${Date.now() - dedicatedStartTime}ms`);
        resolve();
      });
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

      console.log(`[SSH] 开始连接到 ${sessionInfo.host}:${sessionInfo.port}...`);
      dedicatedClient.connect(connConfig);
    });

    return dedicatedClient;
  }

  /**
   * 异步初始化连接池 - 优化预热策略
   */
  private initializePoolAsync(sessionId: string, sessionInfo: SessionInfo): void {
    console.log(`[SSH] 开始异步初始化连接池 ${sessionId}...`);

    // 立即初始化连接池，不延迟
    setImmediate(async () => {
      try {
        const poolStartTime = Date.now();

        // 存储配置信息并创建连接池
        this.configs.set(sessionId, sessionInfo);
        const pool = this.createPool(sessionId, sessionInfo);
        this.pools.set(sessionId, pool);
        console.log(`[SSH] 连接池创建完成 ${sessionId}`);

        // 积极预热连接池 - 并行创建连接
        console.log(`[SSH] 开始积极预热连接池 ${sessionId}, 需要创建 ${this.DEFAULT_POOL_CONFIG.min} 个连接...`);
        await this.aggressiveWarmupPool(pool, sessionId);

        console.log(`[SSH] 异步连接池初始化完成 ${sessionId}, 耗时: ${Date.now() - poolStartTime}ms`);
        console.log(`Connection pool initialized for session ${sessionId}`);
      } catch (error) {
        console.error(`[SSH] 异步连接池初始化失败 ${sessionId}:`, error);
        console.log(`[SSH] 回退到仅使用专用连接模式 ${sessionId}`);
      }
    });
  }

  /**
   * 积极预热连接池 - 优化版本
   */
  private async aggressiveWarmupPool(pool: Pool<PooledConnection>, sessionId: string): Promise<void> {
    const warmupStartTime = Date.now();

    // 并行创建所有核心连接，不等待单个连接完成
    const warmupPromises = Array(this.DEFAULT_POOL_CONFIG.min)
      .fill(0)
      .map(async (_, index) => {
        try {
          const connStartTime = Date.now();
          console.log(`[SSH] 开始创建连接池连接 ${index + 1}/${this.DEFAULT_POOL_CONFIG.min} (${sessionId})...`);
          const conn = await pool.acquire();
          console.log(`[SSH] 连接池连接 ${index + 1} 创建成功 (${sessionId}), 耗时: ${Date.now() - connStartTime}ms`);
          await pool.release(conn);
          console.log(`[SSH] 连接池连接 ${index + 1} 已释放回池中 (${sessionId})`);
        } catch (error) {
          console.error(`[SSH] 预热连接 ${index + 1} 失败 (${sessionId}):`, error);
        }
      });

    // 等待所有连接创建完成，但不阻塞主流程
    await Promise.allSettled(warmupPromises);
    console.log(`[SSH] 连接池预热完成 ${sessionId}, 总耗时: ${Date.now() - warmupStartTime}ms`);
  }

  /**
   * 预热连接池 - 保留原方法作为备用
   */
  private async warmupPool(pool: Pool<PooledConnection>, sessionId: string): Promise<void> {
    await Promise.all(
      Array(this.DEFAULT_POOL_CONFIG.min)
        .fill(0)
        .map(async (_, index) => {
          const connStartTime = Date.now();
          console.log(`[SSH] 开始创建连接池连接 ${index + 1}/${this.DEFAULT_POOL_CONFIG.min} (${sessionId})...`);
          const conn = await pool.acquire();
          console.log(`[SSH] 连接池连接 ${index + 1} 创建成功 (${sessionId}), 耗时: ${Date.now() - connStartTime}ms`);
          await pool.release(conn);
          console.log(`[SSH] 连接池连接 ${index + 1} 已释放回池中 (${sessionId})`);
        })
    );
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
   * 新架构：同时清理GlobalSSHManager的连接
   */
  async disconnect(sessionId: string): Promise<void> {
    console.log(`[SSH] Disconnecting session: ${sessionId}`);

    // 1. 清理相关的shells（优先处理，避免残留）
    const shellsToClean = [];
    for (const [shellId, shell] of this.shells.entries()) {
      if (shellId.startsWith(sessionId + '-') || shellId === sessionId) {
        shellsToClean.push({ shellId, shell });
      }
    }

    for (const { shellId, shell } of shellsToClean) {
      try {
        console.log(`[SSH] Cleaning up shell: ${shellId}`);
        // 移除所有监听器避免触发事件
        shell.removeAllListeners();
        // 关闭shell
        shell.end();
        // 从映射中删除
        this.shells.delete(shellId);
        console.log(`[SSH] Shell ${shellId} cleaned up successfully`);
      } catch (error) {
        console.error(`[SSH] Error cleaning up shell ${shellId}:`, error);
      }
    }

    // 2. 使用GlobalSSHManager断开连接（新架构）
    try {
      console.log(`[SSH] Disconnecting session via GlobalSSHManager: ${sessionId}`);
      await this.globalManager.disconnectSession(sessionId);
      // 通知GlobalSSHManager专用连接已断开
      this.globalManager.setDedicatedConnectionStatus(sessionId, false);
      console.log(`[SSH] GlobalSSHManager disconnection completed for: ${sessionId}`);
    } catch (error) {
      console.error(`[SSH] Error disconnecting via GlobalSSHManager for ${sessionId}:`, error);
    }

    // 3. 清理旧架构的连接池（向后兼容）
    const pool = this.pools.get(sessionId);
    if (pool) {
      try {
        console.log(`[SSH] Draining connection pool for: ${sessionId}`);
        await pool.drain();
        await pool.clear();
        this.pools.delete(sessionId);
        this.configs.delete(sessionId);
        console.log(`[SSH] Connection pool cleaned up for: ${sessionId}`);
      } catch (error) {
        console.error(`[SSH] Error cleaning up connection pool for ${sessionId}:`, error);
      }
    }

    // 4. 清理旧架构的专用连接（向后兼容）
    const dedicatedClient = this.dedicatedConnections.get(sessionId);
    if (dedicatedClient) {
      try {
        console.log(`[SSH] Closing dedicated connection for: ${sessionId}`);
        dedicatedClient.end();
        this.dedicatedConnections.delete(sessionId);
        console.log(`[SSH] Dedicated connection closed for: ${sessionId}`);
      } catch (error) {
        console.error(`[SSH] Error closing dedicated connection for ${sessionId}:`, error);
      }
    }

    // 5. 清理目录映射
    this.currentDirectories.delete(sessionId);

    console.log(`[SSH] Session ${sessionId} disconnected successfully`);
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

    console.log(`[SSH] 创建Shell ${shellId}, sessionId: ${sessionId}`);
    console.log(`[SSH] 当前专用连接列表:`, Array.from(this.dedicatedConnections.keys()));

    // 新架构：Shell会话始终使用专用连接，不再占用连接池
    console.log(`[SSH] Shell会话使用专用连接 ${sessionId}`);
    const dedicatedClient = this.dedicatedConnections.get(sessionId);
    console.log(`[SSH] 专用连接查找结果 - sessionId: ${sessionId}, found: ${!!dedicatedClient}`);

    if (!dedicatedClient) {
      console.error(`[SSH] 未找到专用连接: ${sessionId}`);
      console.log(`[SSH] 尝试通过GlobalSSHManager查找连接...`);
      throw new Error('No SSH connection found');
    }

    // 检查连接状态
    if (!this.isClientConnected(dedicatedClient)) {
      console.log(`[SSH] 专用连接已断开，尝试重新连接: ${sessionId}`);
      // 尝试重新连接
      const sessionInfo = this.configs.get(sessionId);
      if (sessionInfo) {
        try {
          await this.reconnectSession(sessionId, sessionInfo);
        } catch (error) {
          console.error(`[SSH] 重新连接失败: ${sessionId}`, error);
          throw new Error(`Connection lost and reconnection failed: ${error}`);
        }
      } else {
        throw new Error('Session configuration not found for reconnection');
      }
    }

    const conn = this.dedicatedConnections.get(sessionId);
    if (!conn) {
      throw new Error('Failed to establish SSH connection');
    }

    // 记录连接池状态用于调试
    const pool = this.pools.get(sessionId);
    if (pool) {
      const poolStatus = {
        size: pool.size,
        available: pool.available,
        borrowed: pool.borrowed,
        pending: pool.pending
      };
      console.log(`[SSH] 连接池状态 ${sessionId}:`, poolStatus);
    }

    // 如果这个 shellId 已经存在，先关闭它并等待清理完成
    if (this.shells.has(shellId)) {
      console.log(`[SSH] Shell ${shellId} already exists, closing it first`);
      const oldShell = this.shells.get(shellId);
      if (oldShell) {
        try {
          // 先移除监听器避免触发事件
          oldShell.removeAllListeners();
          // 关闭shell
          oldShell.end();
          // 从映射中删除
          this.shells.delete(shellId);
          console.log(`[SSH] Old shell ${shellId} cleaned up successfully`);
          // 等待一小段时间确保清理完成
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`[SSH] Error cleaning up old shell ${shellId}:`, error);
        }
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

          // 检查是否是意外断开，如果是则尝试重连
          this.handleShellDisconnection(shellId, sessionId);
        });

        // 监听错误事件
        stream.on('error', (error: Error) => {
          console.error(`Shell error [${shellId}]:`, error);
          mainWindow.webContents.send(`ssh:close:${shellId}`);
          this.shells.delete(shellId);

          // 检查是否是连接错误，如果是则尝试重连
          this.handleShellDisconnection(shellId, sessionId);
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
   * 新架构：使用GlobalSSHManager的共享连接池
   */
  async executeCommandDirect(sessionId: string, command: string): Promise<string> {
    console.log(`[SSH] Executing direct command: ${command}`);

    try {
      // 使用GlobalSSHManager的共享连接池执行命令
      const handle = await this.globalManager.getConnection(sessionId, ConnectionType.COMMAND);
      try {
        const result = await handle.execute(command);
        return result.stdout || result.stderr || '';
      } finally {
        await handle.release();
      }
    } catch (error) {
      console.error(`[SSH] GlobalSSHManager命令执行失败，回退到旧方式: ${error}`);

      // 回退到旧的实现方式
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

  /**
   * 获取SFTP连接（复用现有SSH连接）
   * 新架构：使用GlobalSSHManager的传输连接池
   */
  async getSFTPConnection(sessionId: string): Promise<any> {
    console.log(`[SSH] 获取SFTP连接: ${sessionId}`);

    try {
      // 使用GlobalSSHManager的传输连接池获取SFTP连接
      const handle = await this.globalManager.getConnection(sessionId, ConnectionType.TRANSFER);
      const sftp = await handle.sftp();

      return {
        sftp,
        handle, // 保存handle用于释放
        poolConn: null,
        pool: null
      };
    } catch (error) {
      console.error(`[SSH] GlobalSSHManager SFTP连接失败，回退到旧方式: ${error}`);

      // 回退到旧的实现方式
      // 1. 尝试从连接池获取连接
      const poolConn = await this.getPoolConnection(sessionId);
      if (poolConn) {
        try {
          return await new Promise((resolve, reject) => {
            poolConn.client.sftp((err, sftp) => {
              if (err) {
                reject(err);
                return;
              }
              resolve({ sftp, poolConn, pool: this.pools.get(sessionId) });
            });
          });
        } catch (error) {
          // 如果失败，释放连接
          await this.pools.get(sessionId)?.release(poolConn);
          throw error;
        }
      }

      // 2. 如果连接池不可用，使用专用连接
      const dedicatedClient = this.dedicatedConnections.get(sessionId);
      if (!dedicatedClient) {
        throw new Error('SSH connection not found');
      }

      return await new Promise((resolve, reject) => {
        dedicatedClient.sftp((err, sftp) => {
          if (err) {
            reject(err);
            return;
          }
          resolve({ sftp, poolConn: null, pool: null });
        });
      });
    }
  }

  /**
   * 释放SFTP连接
   * 新架构：支持GlobalSSHManager的连接释放
   */
  async releaseSFTPConnection(sessionId: string, sftpConnection: any): Promise<void> {
    console.log(`[SSH] 释放SFTP连接: ${sessionId}`);

    // 如果是新架构的连接句柄，使用handle释放
    if (sftpConnection.handle) {
      await sftpConnection.handle.release();
      return;
    }

    // 如果是从连接池获取的连接，需要释放回连接池
    if (sftpConnection.poolConn && sftpConnection.pool) {
      await sftpConnection.pool.release(sftpConnection.poolConn);
    }

    // SFTP对象会随着SSH连接的释放而自动关闭
  }
}

console.log('Creating SSH service instance...');
export const sshService = new SSHService();
console.log('SSH service instance created.');