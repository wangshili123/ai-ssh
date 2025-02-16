import { SessionInfo } from '../../types';
import { MonitorData } from '../../types/monitor';
import { RefreshService } from './refreshService';
import { SSHService } from '../../types';
import { PerformanceManager } from './performance/performanceManager';

/**
 * 监控管理器
 * 用于统一管理所有监控相关服务
 */
class MonitorManager {
  private static instance: MonitorManager;
  private sessions: Map<string, SessionInfo> = new Map();
  private refreshService: RefreshService;
  private performanceManager: PerformanceManager;
  private sshService: SSHService;
  
  // 活动状态控制
  private activeTab: string = '';
  private activeCard: string = '';
  private activeDetailTab: { [key: string]: string } = {
    cpu: 'basic',
    memory: 'basic',
    disk: 'overview',
    network: 'basic'
  };


  private constructor(sshService: SSHService) {
    this.sshService = sshService;
    this.refreshService = RefreshService.getInstance();
    this.performanceManager = PerformanceManager.getInstance(sshService);
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
   * 设置当前激活的标签页
   */
  setActiveTab(tab: string): void {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
  }

  /**
   * 设置当前激活的卡片
   */
  setActiveCard(card: string): void {
    if (this.activeCard === card) return;
    this.activeCard = card;
  }

  /**
   * 设置当前激活的详情标签页
   */
  setActiveDetailTab(card: string, tab: string): void {
    console.log('[MonitorManager] setActiveDetailTab', card, tab);
    if (this.activeDetailTab[card] === tab) return;
    this.activeDetailTab[card] = tab;
  }

  /**
   * 创建新的监控会话
   */
  createSession(config: Partial<Omit<SessionInfo, 'id' | 'type' | 'status'>>): SessionInfo {
    console.time(`[Performance] 创建会话总耗时`);
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
    console.timeEnd(`[Performance] 创建会话总耗时`);
    return session;
  }

  /**
   * 连接会话
   */
  async connectSession(sessionId: string): Promise<void> {
    console.time(`[Performance] 连接会话总耗时 ${sessionId}`);
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'connecting';

    try {
      console.time(`[Performance] SSH连接耗时 ${sessionId}`);
      await this.sshService.connect(session);
      console.timeEnd(`[Performance] SSH连接耗时 ${sessionId}`);
      
      session.status = 'connected';

      // 初始化时立即刷新一次数据
      await this.refreshSession(sessionId);

      if (session.config?.autoRefresh) {
        console.time(`[Performance] 启动自动刷新耗时 ${sessionId}`);
        this.refreshService.startRefresh(session);
        console.timeEnd(`[Performance] 启动自动刷新耗时 ${sessionId}`);
      }
    } catch (error) {
      session.status = 'error';
      session.error = (error as Error).message;
      throw error;
    }
    console.timeEnd(`[Performance] 连接会话总耗时 ${sessionId}`);
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
    console.time(`[Performance] 刷新会话总耗时 ${sessionId}`);
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return;

    try {
      session.status = 'refreshing';
      console.log('[MonitorManager] 刷新会话数据:', {
        sessionId,
        activeTab: this.activeTab,
        activeCard: this.activeCard,
        activeDetailTab: this.activeDetailTab[this.activeCard]
      });


      const monitorData: MonitorData = {
        timestamp: Date.now()
      };
      
      if (this.activeTab === 'performance') {
        console.time(`[Performance] 性能指标采集耗时 ${sessionId}`);
        monitorData.performance = await this.performanceManager.collectMetrics(
          sessionId, 
          this.activeCard as 'cpu' | 'memory' | 'disk' | 'network',
          this.activeDetailTab[this.activeCard]
        );
        console.timeEnd(`[Performance] 性能指标采集耗时 ${sessionId}`);
        console.log('[MonitorManager] 性能指标采集结果:', monitorData.performance);
      }
      
      session.monitorData = monitorData;
      session.status = 'connected';
      session.lastUpdated = Date.now();
    } catch (error) {
      console.error('刷新会话数据失败:', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      session.status = 'error';
      session.error = (error as Error).message;
    }
    console.timeEnd(`[Performance] 刷新会话总耗时 ${sessionId}`);
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
    this.performanceManager.destroy();
    for (const [sessionId] of this.sessions) {
      this.disconnectSession(sessionId);
    }
    this.sessions.clear();
    MonitorManager.instance = null as any;
  }
}

// 只在底部导出
export { MonitorManager }; 