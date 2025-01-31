import { Client, ConnectConfig } from 'ssh2';
import { EventEmitter } from 'events';

interface SSHConnectionPool {
  client: Client;
  lastUsed: number;
  isConnecting: boolean;
  connectionPromise?: Promise<Client>;
  metrics: ConnectionMetrics;
  isClosed: boolean;
}

interface ConnectionMetrics {
  establishTime: number;
  lastUsed: number;
  commandCount: number;
  errorCount: number;
  avgResponseTime: number;
}

export class SSHConnectionManager extends EventEmitter {
  private static instance: SSHConnectionManager;
  private connections: Map<string, SSHConnectionPool> = new Map();
  
  private readonly CONNECTION_TIMEOUT = 30000; // 30s
  private readonly MAX_POOL_SIZE = 5;
  private readonly CLEANUP_INTERVAL = 60000; // 1min
  
  private constructor() {
    super();
    this.startCleanupTimer();
  }
  
  public static getInstance(): SSHConnectionManager {
    if (!SSHConnectionManager.instance) {
      SSHConnectionManager.instance = new SSHConnectionManager();
    }
    return SSHConnectionManager.instance;
  }
  
  public async getConnection(sessionId: string, config: ConnectConfig): Promise<Client> {
    console.log('[SSHConnectionManager] 获取连接:', sessionId);
    
    // 1. 检查现有连接
    const existing = this.connections.get(sessionId);
    if (existing) {
      // 如果连接正在建立中，等待其完成
      if (existing.isConnecting && existing.connectionPromise) {
        console.log('[SSHConnectionManager] 等待现有连接建立完成');
        return existing.connectionPromise;
      }
      
      // 如果连接未超时且可用，直接返回
      if (this.isConnectionValid(existing)) {
        console.log('[SSHConnectionManager] 复用现有连接');
        this.updateConnectionMetrics(sessionId);
        return existing.client;
      }
      
      // 连接已失效，移除
      console.log('[SSHConnectionManager] 移除失效连接');
      this.connections.delete(sessionId);
    }
    
    // 2. 创建新连接
    console.log('[SSHConnectionManager] 创建新连接');
    const connectionPromise = this.createConnection(sessionId, config);
    
    // 3. 更新连接池
    this.connections.set(sessionId, {
      client: await connectionPromise,
      lastUsed: Date.now(),
      isConnecting: true,
      connectionPromise,
      metrics: this.initializeMetrics(),
      isClosed: false
    });
    
    return connectionPromise;
  }
  
  private async createConnection(sessionId: string, config: ConnectConfig): Promise<Client> {
    const startTime = Date.now();
    const client = new Client();
    
    try {
      const connection = await new Promise<Client>((resolve, reject) => {
        client.on('ready', () => {
          console.log('[SSHConnectionManager] 连接建立成功:', sessionId);
          this.updateMetricsOnConnect(sessionId, startTime);
          resolve(client);
        });
        
        client.on('error', (err) => {
          console.error('[SSHConnectionManager] 连接错误:', err);
          this.updateMetricsOnError(sessionId);
          const conn = this.connections.get(sessionId);
          if (conn) {
            conn.isClosed = true;
          }
          reject(err);
        });
        
        client.on('end', () => {
          console.log('[SSHConnectionManager] 连接已关闭:', sessionId);
          const conn = this.connections.get(sessionId);
          if (conn) {
            conn.isClosed = true;
          }
        });
        
        client.connect(config);
      });
      
      return connection;
    } catch (error) {
      console.error('[SSHConnectionManager] 创建连接失败:', error);
      throw error;
    }
  }
  
  private isConnectionValid(connection: SSHConnectionPool): boolean {
    const age = Date.now() - connection.lastUsed;
    return age < this.CONNECTION_TIMEOUT && !connection.isClosed;
  }
  
  private initializeMetrics(): ConnectionMetrics {
    return {
      establishTime: 0,
      lastUsed: Date.now(),
      commandCount: 0,
      errorCount: 0,
      avgResponseTime: 0
    };
  }
  
  private updateMetricsOnConnect(sessionId: string, startTime: number): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.metrics.establishTime = Date.now() - startTime;
      connection.isConnecting = false;
    }
  }
  
  private updateMetricsOnError(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.metrics.errorCount++;
    }
  }
  
  private updateConnectionMetrics(sessionId: string): void {
    const connection = this.connections.get(sessionId);
    if (connection) {
      connection.lastUsed = Date.now();
      connection.metrics.commandCount++;
    }
  }
  
  private startCleanupTimer(): void {
    setInterval(() => this.cleanupConnections(), this.CLEANUP_INTERVAL);
  }
  
  private cleanupConnections(): void {
    console.log('[SSHConnectionManager] 开始清理过期连接');
    const now = Date.now();
    
    for (const [sessionId, connection] of this.connections.entries()) {
      const age = now - connection.lastUsed;
      if (age > this.CONNECTION_TIMEOUT || connection.isClosed) {
        console.log('[SSHConnectionManager] 清理连接:', sessionId);
        connection.client.end();
        this.connections.delete(sessionId);
      }
    }
  }
  
  public getConnectionMetrics(sessionId: string): ConnectionMetrics | null {
    const connection = this.connections.get(sessionId);
    return connection ? connection.metrics : null;
  }
  
  public getActiveConnectionsCount(): number {
    return this.connections.size;
  }
} 