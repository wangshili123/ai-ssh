import { SessionInfo } from '../../types';
import { CpuInfo, MemoryInfo, DiskInfo, NetworkInfo, MonitorData } from '../../types/monitor';
import { RefreshService } from './metrics/refreshService';
import { CpuMetricsService } from './metrics/cpuService';
import { SSHService } from '../../types';

/**
 * 监控管理器
 * 用于统一管理所有监控相关服务
 */
export class MonitorManager {
  private static instance: MonitorManager;
  private sessions: Map<string, SessionInfo> = new Map();
  private refreshService: RefreshService;
  private cpuMetricsService: CpuMetricsService;
  private sshService: SSHService;

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
    this.refreshService = RefreshService.getInstance();
    this.cpuMetricsService = CpuMetricsService.getInstance(sshService);
    this.setupRefreshListener();
  }

  /**
   * 获取单例实例
   */
  static getInstance(sshService: SSHService): MonitorManager {
    if (!MonitorManager.instance) {
      MonitorManager.instance = new MonitorManager(sshService);
    }
    return MonitorManager.instance;
  }

  /**
   * 设置刷新监听器
   */
  private setupRefreshListener(): void {
    this.refreshService.on('refresh', async (sessionId: string) => {
      await this.refreshSession(sessionId);
    });
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
        refreshInterval: 1000, // 默认1秒更新一次
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

    session.status = 'connecting';

    try {
      await this.sshService.connect(session);
      session.status = 'connected';

      if (session.config?.autoRefresh) {
        this.refreshService.startRefresh(session);
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

    this.refreshService.stopRefresh(sessionId);
    this.sshService.disconnect(sessionId);
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
      
      // 采集CPU指标
      const cpuInfo = await this.cpuMetricsService.collectMetrics(sessionId);

      // TODO: 采集其他指标
      const memoryInfo: MemoryInfo = {
        total: 0,
        used: 0,
        free: 0,
        cached: 0,
        buffers: 0,
        usagePercent: 0
      };

      const diskInfo: DiskInfo = {
        devices: [],
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0
      };

      const networkInfo: NetworkInfo = {
        interfaces: [],
        totalRx: 0,
        totalTx: 0,
        rxSpeed: 0,
        txSpeed: 0
      };

      // 更新会话数据
      session.monitorData = {
        cpu: cpuInfo,
        memory: memoryInfo,
        disk: diskInfo,
        network: networkInfo,
        timestamp: Date.now()
      };

      session.status = 'connected';
      session.lastUpdated = Date.now();
    } catch (error) {
      session.status = 'error';
      session.error = (error as Error).message;
      throw error;
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
    this.refreshService.destroy();
    this.cpuMetricsService.destroy();
    for (const [sessionId] of this.sessions) {
      this.disconnectSession(sessionId);
    }
    this.sessions.clear();
    MonitorManager.instance = null as any;
  }
}

// 导出类定义
export { MonitorManager };

// 不在这里导出实例，而是在使用时创建
// 因为需要传入 sshService 参数 