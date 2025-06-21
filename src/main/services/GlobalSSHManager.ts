/**
 * 全局SSH连接管理器
 * 统一管理不同类型的SSH连接，解决连接池超时问题
 */

import { Client } from 'ssh2';
import { createPool, Pool } from 'generic-pool';
import type { SessionInfo } from '../../renderer/types/index';

// 连接类型枚举
export enum ConnectionType {
  TERMINAL = 'terminal',      // 终端专用连接
  COMMAND = 'command',        // 命令执行（监控、补全）
  TRANSFER = 'transfer'       // 文件传输
}

// 连接池配置接口
export interface PoolConfig {
  min: number;
  max: number;
  acquireTimeoutMillis: number;
  idleTimeoutMillis: number;
  evictionRunIntervalMillis?: number;
}

// 连接句柄接口
export interface ConnectionHandle {
  client: Client;
  type: ConnectionType;
  sessionId: string;
  release(): Promise<void>;
  execute(command: string): Promise<{ stdout: string; stderr: string }>;
  sftp(): Promise<any>;
}

// 连接池中的连接对象
export interface PooledConnection {
  client: Client;
  sessionId: string;
  createdAt: number;
  lastUsed: number;
}

/**
 * 全局SSH连接管理器
 * 负责管理所有SSH连接的生命周期和资源分配
 */
export class GlobalSSHManager {
  private static instance: GlobalSSHManager;
  
  // 不同类型的连接管理
  private dedicatedConnections: Map<string, Client> = new Map(); // 终端专用连接
  private sharedPools: Map<string, Pool<PooledConnection>> = new Map(); // 共享连接池
  private transferPools: Map<string, Pool<PooledConnection>> = new Map(); // 传输连接池
  
  // 会话信息缓存
  private sessionInfoCache: Map<string, SessionInfo> = new Map();
  
  // 连接创建Promise缓存，用于并发控制
  private connectionPromises: Map<string, Promise<void>> = new Map();
  
  // 不同类型连接池的配置
  private readonly POOL_CONFIGS = {
    // 共享池：用于短期命令执行
    SHARED: {
      min: 2,
      max: 8,
      acquireTimeoutMillis: 5000,
      idleTimeoutMillis: 300000, // 5分钟
      evictionRunIntervalMillis: 60000, // 1分钟检查一次
    } as PoolConfig,
    
    // 传输池：用于文件操作
    TRANSFER: {
      min: 1,
      max: 5,
      acquireTimeoutMillis: 10000,
      idleTimeoutMillis: 600000, // 10分钟
      evictionRunIntervalMillis: 120000, // 2分钟检查一次
    } as PoolConfig
  };

  private constructor() {
    console.log('[GlobalSSHManager] 初始化全局SSH连接管理器');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): GlobalSSHManager {
    if (!GlobalSSHManager.instance) {
      GlobalSSHManager.instance = new GlobalSSHManager();
    }
    return GlobalSSHManager.instance;
  }

  /**
   * 统一连接获取接口
   * @param sessionId 会话ID
   * @param type 连接类型
   * @returns 连接句柄
   */
  public async getConnection(sessionId: string, type: ConnectionType): Promise<ConnectionHandle> {
    console.log(`[GlobalSSHManager] 获取连接: sessionId=${sessionId}, type=${type}`);
    
    switch (type) {
      case ConnectionType.TERMINAL:
        return this.getDedicatedConnection(sessionId);
      case ConnectionType.COMMAND:
        return this.getSharedPoolConnection(sessionId);
      case ConnectionType.TRANSFER:
        return this.getTransferPoolConnection(sessionId);
      default:
        throw new Error(`不支持的连接类型: ${type}`);
    }
  }

  /**
   * 注册会话信息
   * @param sessionInfo 会话信息
   */
  public async registerSession(sessionInfo: SessionInfo): Promise<void> {
    console.log(`[GlobalSSHManager] 注册会话: ${sessionInfo.id}`);
    this.sessionInfoCache.set(sessionInfo.id, sessionInfo);
  }

  /**
   * 获取专用连接（用于终端）
   * @param sessionId 会话ID
   * @returns 连接句柄
   */
  private async getDedicatedConnection(sessionId: string): Promise<ConnectionHandle> {
    console.log(`[GlobalSSHManager] 获取专用连接: ${sessionId}`);
    
    // 检查是否已有专用连接
    let client = this.dedicatedConnections.get(sessionId);
    
    if (!client || !this.isClientConnected(client)) {
      // 创建新的专用连接
      client = await this.createDedicatedConnection(sessionId);
      this.dedicatedConnections.set(sessionId, client);
    }
    
    return this.createConnectionHandle(client, ConnectionType.TERMINAL, sessionId);
  }

  /**
   * 获取共享池连接（用于命令执行）
   * @param sessionId 会话ID
   * @returns 连接句柄
   */
  private async getSharedPoolConnection(sessionId: string): Promise<ConnectionHandle> {
    console.log(`[GlobalSSHManager] 获取共享池连接: ${sessionId}`);
    
    const pool = await this.getOrCreateSharedPool(sessionId);
    const pooledConn = await pool.acquire();
    
    return this.createPooledConnectionHandle(pooledConn, pool, ConnectionType.COMMAND, sessionId);
  }

  /**
   * 获取传输池连接（用于文件传输）
   * @param sessionId 会话ID
   * @returns 连接句柄
   */
  private async getTransferPoolConnection(sessionId: string): Promise<ConnectionHandle> {
    console.log(`[GlobalSSHManager] 获取传输池连接: ${sessionId}`);

    const pool = await this.getOrCreateTransferPool(sessionId);
    const pooledConn = await pool.acquire();

    return this.createPooledConnectionHandle(pooledConn, pool, ConnectionType.TRANSFER, sessionId);
  }

  /**
   * 创建专用连接
   * @param sessionId 会话ID
   * @returns SSH客户端
   */
  private async createDedicatedConnection(sessionId: string): Promise<Client> {
    console.log(`[GlobalSSHManager] 创建专用连接: ${sessionId}`);
    
    const sessionInfo = this.sessionInfoCache.get(sessionId);
    if (!sessionInfo) {
      throw new Error(`会话信息未找到: ${sessionId}`);
    }
    
    return this.createSSHClient(sessionInfo);
  }

  /**
   * 创建SSH客户端
   * @param sessionInfo 会话信息
   * @returns SSH客户端
   */
  private async createSSHClient(sessionInfo: SessionInfo): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = new Client();
      
      client.on('ready', () => {
        console.log(`[GlobalSSHManager] SSH连接建立成功: ${sessionInfo.id}`);
        resolve(client);
      });
      
      client.on('error', (err) => {
        console.error(`[GlobalSSHManager] SSH连接失败: ${sessionInfo.id}`, err);
        reject(err);
      });
      
      // 连接配置
      const connectConfig: any = {
        host: sessionInfo.host,
        port: sessionInfo.port || 22,
        username: sessionInfo.username,
        readyTimeout: 30000,
        keepaliveInterval: 30000,
        keepaliveCountMax: 3,
      };
      
      // 认证方式
      if (sessionInfo.password) {
        connectConfig.password = sessionInfo.password;
      } else if (sessionInfo.privateKey) {
        connectConfig.privateKey = sessionInfo.privateKey;
        if (sessionInfo.passphrase) {
          connectConfig.passphrase = sessionInfo.passphrase;
        }
      }
      
      client.connect(connectConfig);
    });
  }

  /**
   * 检查客户端是否已连接
   * @param client SSH客户端
   * @returns 是否已连接
   */
  private isClientConnected(client: Client): boolean {
    try {
      // 检查客户端的内部状态
      // @ts-ignore - 访问内部属性
      const state = client._sock?.readyState;
      // @ts-ignore - 访问内部属性
      const connected = client._sock && !client._sock.destroyed;

      return connected && (state === 'open' || state === undefined);
    } catch (error) {
      console.error('[GlobalSSHManager] 检查连接状态失败:', error);
      return false;
    }
  }

  /**
   * 创建连接句柄
   * @param client SSH客户端
   * @param type 连接类型
   * @param sessionId 会话ID
   * @returns 连接句柄
   */
  private createConnectionHandle(client: Client, type: ConnectionType, sessionId: string): ConnectionHandle {
    return {
      client,
      type,
      sessionId,
      async release() {
        // 专用连接不需要释放
        if (type === ConnectionType.TERMINAL) {
          return;
        }
        // 其他类型的连接释放逻辑在pooled版本中实现
      },
      async execute(command: string) {
        return new Promise((resolve, reject) => {
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
            
            stream.stderr.on('data', (data: Buffer) => {
              stderr += data.toString();
            });
            
            stream.on('close', () => {
              resolve({ stdout, stderr });
            });
          });
        });
      },
      async sftp() {
        return new Promise((resolve, reject) => {
          client.sftp((err, sftp) => {
            if (err) {
              reject(err);
              return;
            }
            resolve(sftp);
          });
        });
      }
    };
  }

  /**
   * 创建池化连接句柄
   * @param pooledConn 池化连接
   * @param pool 连接池
   * @param type 连接类型
   * @param sessionId 会话ID
   * @returns 连接句柄
   */
  private createPooledConnectionHandle(
    pooledConn: PooledConnection, 
    pool: Pool<PooledConnection>, 
    type: ConnectionType, 
    sessionId: string
  ): ConnectionHandle {
    const baseHandle = this.createConnectionHandle(pooledConn.client, type, sessionId);
    
    return {
      ...baseHandle,
      async release() {
        console.log(`[GlobalSSHManager] 释放池化连接: sessionId=${sessionId}, type=${type}`);
        await pool.release(pooledConn);
      }
    };
  }

  /**
   * 获取或创建共享连接池
   * @param sessionId 会话ID
   * @returns 连接池
   */
  private async getOrCreateSharedPool(sessionId: string): Promise<Pool<PooledConnection>> {
    let pool = this.sharedPools.get(sessionId);

    if (!pool) {
      console.log(`[GlobalSSHManager] 创建共享连接池: ${sessionId}`);
      pool = await this.createConnectionPool(sessionId, this.POOL_CONFIGS.SHARED);
      this.sharedPools.set(sessionId, pool);
    }

    return pool;
  }

  /**
   * 获取或创建传输连接池
   * @param sessionId 会话ID
   * @returns 连接池
   */
  private async getOrCreateTransferPool(sessionId: string): Promise<Pool<PooledConnection>> {
    let pool = this.transferPools.get(sessionId);

    if (!pool) {
      console.log(`[GlobalSSHManager] 创建传输连接池: ${sessionId}`);
      pool = await this.createConnectionPool(sessionId, this.POOL_CONFIGS.TRANSFER);
      this.transferPools.set(sessionId, pool);
    }

    return pool;
  }

  /**
   * 创建连接池
   * @param sessionId 会话ID
   * @param config 池配置
   * @returns 连接池
   */
  private async createConnectionPool(sessionId: string, config: PoolConfig): Promise<Pool<PooledConnection>> {
    const sessionInfo = this.sessionInfoCache.get(sessionId);
    if (!sessionInfo) {
      throw new Error(`会话信息未找到: ${sessionId}`);
    }

    const factory = {
      create: async (): Promise<PooledConnection> => {
        console.log(`[GlobalSSHManager] 创建池化连接: ${sessionId}`);
        const client = await this.createSSHClient(sessionInfo);
        return {
          client,
          sessionId,
          createdAt: Date.now(),
          lastUsed: Date.now()
        };
      },
      destroy: async (pooledConn: PooledConnection): Promise<void> => {
        console.log(`[GlobalSSHManager] 销毁池化连接: ${sessionId}`);
        pooledConn.client.end();
      },
      validate: async (pooledConn: PooledConnection): Promise<boolean> => {
        // 更新最后使用时间
        pooledConn.lastUsed = Date.now();
        // 检查连接是否仍然有效
        return this.isClientConnected(pooledConn.client);
      }
    };

    return createPool(factory, {
      min: config.min,
      max: config.max,
      acquireTimeoutMillis: config.acquireTimeoutMillis,
      idleTimeoutMillis: config.idleTimeoutMillis,
      evictionRunIntervalMillis: config.evictionRunIntervalMillis || 0,
    });
  }

  /**
   * 断开会话的所有连接
   * @param sessionId 会话ID
   */
  public async disconnectSession(sessionId: string): Promise<void> {
    console.log(`[GlobalSSHManager] 断开会话所有连接: ${sessionId}`);

    // 断开专用连接
    const dedicatedClient = this.dedicatedConnections.get(sessionId);
    if (dedicatedClient) {
      dedicatedClient.end();
      this.dedicatedConnections.delete(sessionId);
    }

    // 销毁共享连接池
    const sharedPool = this.sharedPools.get(sessionId);
    if (sharedPool) {
      await sharedPool.drain();
      await sharedPool.clear();
      this.sharedPools.delete(sessionId);
    }

    // 销毁传输连接池
    const transferPool = this.transferPools.get(sessionId);
    if (transferPool) {
      await transferPool.drain();
      await transferPool.clear();
      this.transferPools.delete(sessionId);
    }

    // 清除会话信息缓存
    this.sessionInfoCache.delete(sessionId);

    console.log(`[GlobalSSHManager] 会话连接断开完成: ${sessionId}`);
  }

  /**
   * 设置专用连接状态（由SSHService调用）
   * @param sessionId 会话ID
   * @param connected 是否已连接
   */
  public setDedicatedConnectionStatus(sessionId: string, connected: boolean): void {
    if (connected) {
      // 创建一个占位符客户端对象，表示专用连接存在
      this.dedicatedConnections.set(sessionId, {} as any);
    } else {
      this.dedicatedConnections.delete(sessionId);
    }
  }

  /**
   * 获取连接状态统计
   * @param sessionId 会话ID
   * @returns 连接状态
   */
  public getConnectionStats(sessionId: string): {
    dedicated: boolean;
    sharedPool?: { size: number; available: number; borrowed: number; pending: number };
    transferPool?: { size: number; available: number; borrowed: number; pending: number };
  } {
    const stats: any = {
      dedicated: this.dedicatedConnections.has(sessionId)
    };

    const sharedPool = this.sharedPools.get(sessionId);
    if (sharedPool) {
      stats.sharedPool = {
        size: sharedPool.size,
        available: sharedPool.available,
        borrowed: sharedPool.borrowed,
        pending: sharedPool.pending
      };
    }

    const transferPool = this.transferPools.get(sessionId);
    if (transferPool) {
      stats.transferPool = {
        size: transferPool.size,
        available: transferPool.available,
        borrowed: transferPool.borrowed,
        pending: transferPool.pending
      };
    }

    return stats;
  }

  /**
   * 健康检查
   * 检查所有连接的健康状态
   */
  public async healthCheck(): Promise<void> {
    console.log('[GlobalSSHManager] 开始健康检查');

    // 检查专用连接
    for (const [sessionId, client] of this.dedicatedConnections) {
      if (!this.isClientConnected(client)) {
        console.warn(`[GlobalSSHManager] 专用连接异常，移除: ${sessionId}`);
        this.dedicatedConnections.delete(sessionId);
      }
    }

    console.log('[GlobalSSHManager] 健康检查完成');
  }

  /**
   * 销毁管理器
   * 清理所有连接和资源
   */
  public async destroy(): Promise<void> {
    console.log('[GlobalSSHManager] 销毁连接管理器');

    // 断开所有会话
    const sessionIds = Array.from(this.sessionInfoCache.keys());
    await Promise.all(sessionIds.map(sessionId => this.disconnectSession(sessionId)));

    // 清理实例
    GlobalSSHManager.instance = null as any;

    console.log('[GlobalSSHManager] 连接管理器销毁完成');
  }
}
