import { SessionInfo } from '../../types';

/**
 * 监控管理器
 * 用于统一管理所有监控相关服务
 */
export class MonitorManager {
  private static instance: MonitorManager;
  private sessions: Map<string, SessionInfo> = new Map();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): MonitorManager {
    if (!MonitorManager.instance) {
      MonitorManager.instance = new MonitorManager();
    }
    return MonitorManager.instance;
  }

  /**
   * 创建新的监控会话
   */
  createSession(config: Partial<Omit<SessionInfo, 'id' | 'type' | 'status'>>): SessionInfo {
    const session: SessionInfo = {
      id: Date.now().toString(),
      type: 'monitor',
      status: 'disconnected',
      host: config.host || '',
      port: config.port || 22,
      username: config.username || '',
      authType: config.authType || 'password',
      ...config,
      config: {
        refreshInterval: 5000,
        autoRefresh: true,
        enableCache: true,
        cacheExpiration: 30000,
        ...config.config
      }
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * 连接会话
   */
  async connectSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // 更新状态为连接中
    session.status = 'connecting';

    try {
      // TODO: 实现SSH连接
      // 临时模拟连接成功
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 更新状态为已连接
      session.status = 'connected';

      // 如果配置了自动刷新，启动刷新任务
      if (session.config?.autoRefresh) {
        this.startAutoRefresh(sessionId);
      }
    } catch (error) {
      session.status = 'error';
      session.error = (error as Error).message;
      throw error;
    }
  }

  /**
   * 断开会话连接
   */
  disconnectSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // 停止自动刷新
    this.stopAutoRefresh(sessionId);

    // 更新状态
    session.status = 'disconnected';
  }

  /**
   * 刷新会话数据
   */
  async refreshSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return;

    try {
      session.status = 'refreshing';
      // TODO: 实现数据刷新
      await new Promise(resolve => setTimeout(resolve, 1000));
      session.status = 'connected';
      session.lastUpdated = Date.now();
    } catch (error) {
      session.status = 'error';
      session.error = (error as Error).message;
      throw error;
    }
  }

  private refreshTasks: Map<string, number> = new Map();

  /**
   * 启动自动刷新
   */
  private startAutoRefresh(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.config?.autoRefresh) return;

    // 停止现有的刷新任务
    this.stopAutoRefresh(sessionId);

    // 创建新的刷新任务
    const timerId = window.setInterval(
      () => this.refreshSession(sessionId),
      session.config.refreshInterval
    );

    this.refreshTasks.set(sessionId, timerId);
  }

  /**
   * 停止自动刷新
   */
  private stopAutoRefresh(sessionId: string): void {
    const timerId = this.refreshTasks.get(sessionId);
    if (timerId) {
      clearInterval(timerId);
      this.refreshTasks.delete(sessionId);
    }
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 获取活跃会话
   */
  getActiveSessions(): SessionInfo[] {
    return Array.from(this.sessions.values()).filter(
      session => session.status === 'connected'
    );
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    // 停止所有刷新任务
    for (const [sessionId] of this.refreshTasks) {
      this.stopAutoRefresh(sessionId);
    }

    // 清除所有会话
    this.sessions.clear();

    // 清除单例
    MonitorManager.instance = null as any;
  }
} 