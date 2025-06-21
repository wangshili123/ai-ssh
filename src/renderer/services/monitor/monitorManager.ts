import { SessionInfo } from '../../types';
import { MonitorData } from '../../types/monitor/monitor';
import { RefreshService } from './refreshService';
import { SSHService } from '../../types';
import { PerformanceManager } from './performance/performanceManager';
import { NetworkService } from './performance/network/networkService';
import { NetworkProcessService } from './performance/network/networkProcessService';
import { MonitorConfigManager } from '../config/MonitorConfig';

interface SessionStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'refreshing' | 'error';
  refCount: number;
  error?: string;
}

/**
 * 监控管理器
 * 用于统一管理所有监控相关服务
 */
export class MonitorManager {
  private static instance: MonitorManager;
  // 使用 tabId 存储监控数据
  private monitorData: Map<string, MonitorData> = new Map();
  // 记录会话状态
  private sessionStatus: Map<string, SessionStatus> = new Map();
  // 记录 tabId 和 sessionId 的关系
  private tabSessionMap: Map<string, string> = new Map();
  
  private refreshService: RefreshService;
  private performanceManager: PerformanceManager;
  private sshService: SSHService;
  private refreshRequestIds: Map<string, number> = new Map();
  private networkService: NetworkService;
  private configManager: MonitorConfigManager;
  
  // 活动状态控制
  private activeTab: string = '';
  private activeCard: string = 'cpu';
  private activeDetailTab: { [key: string]: string } = {
    cpu: 'basic',
    memory: 'basic',
    disk: 'basic',
    network: 'basic'
  };

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
    this.refreshService = RefreshService.getInstance();
    this.performanceManager = PerformanceManager.getInstance(sshService);
    this.networkService = NetworkService.getInstance(sshService);
    this.configManager = MonitorConfigManager.getInstance();
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
   * 设置当前激活的标签页
   */
  setActiveTab(tab: string): void {
    console.log('[MonitorManager] setActiveTab:', {
      oldTab: this.activeTab,
      newTab: tab,
      willUpdate: this.activeTab !== tab
    });
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    console.log('[MonitorManager] activeTab已更新为:', this.activeTab);
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
   * 创建并连接监控会话
   */
  async createSession(sessionInfo: SessionInfo, tabId: string): Promise<SessionStatus> {
    console.log('[MonitorManager] 创建监控会话:', {
      sessionId: sessionInfo.id,
      tabId
    });

    // 记录 tabId 和 sessionId 的关系
    this.tabSessionMap.set(tabId, sessionInfo.id);
    
    // 获取或初始化会话状态
    let status = this.sessionStatus.get(sessionInfo.id);
    if (!status) {
      status = {
        status: 'disconnected',
        refCount: 0
      };
      this.sessionStatus.set(sessionInfo.id, status);
    }

    // 增加引用计数
    status.refCount++;
    
    // 如果会话未连接，建立连接
    if (status.status === 'disconnected') {
      status.status = 'connecting';
      try {
        await this.sshService.connect(sessionInfo);
        status.status = 'connected';
        
        // 立即执行一次刷新
        await this.refreshSession(sessionInfo.id, tabId);
      } catch (error) {
        status.status = 'error';
        status.error = (error as Error).message;
        throw error;
      }
    }
    return status;
  }

  /**
   * 断开会话连接
   */
  disconnectSession(sessionId: string, tabId: string): void {
    console.log('[MonitorManager] 准备断开会话连接:', {
      sessionId,
      tabId,
      hasData: this.monitorData.has(tabId),
      hasTabSession: this.tabSessionMap.has(tabId),
      allTabSessions: Array.from(this.tabSessionMap.entries())
    });

    // 删除该标签页的数据
    this.monitorData.delete(tabId);
    this.tabSessionMap.delete(tabId);

    const status = this.sessionStatus.get(sessionId);
    if (!status) {
      console.log('[MonitorManager] 未找到会话状态:', { sessionId });
      return;
    }

    // 减少引用计数
    status.refCount--;
    console.log('[MonitorManager] 断开会话连接:', {
      sessionId,
      tabId,
      remainingRefs: status.refCount,
      currentStatus: status.status,
      remainingTabs: Array.from(this.tabSessionMap.entries())
        .filter(([_, sid]) => sid === sessionId)
        .map(([tid]) => tid)
    });
    
    // 如果没有其他标签页使用这个会话，则断开连接
    if (status.refCount <= 0) {
      console.log('[MonitorManager] 会话无引用，完全断开连接:', { 
        sessionId,
        finalStatus: status.status
      });
      this.sshService.disconnect(sessionId);
      this.sessionStatus.delete(sessionId);
    }
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): SessionInfo | undefined {
    return undefined;
  }

  /**
   * 获取指定标签页的监控数据
   */
  getTabData(tabId: string): MonitorData | undefined {
    return this.monitorData.get(tabId);
  }

  /**
   * 刷新会话数据
   */
  async refreshSession(sessionId: string, tabId: string): Promise<MonitorData> {
    console.time(`[Performance] 刷新会话总耗时-开始 ${sessionId}`);
    
    console.log('[MonitorManager] 开始刷新会话:', {
      sessionId,
      tabId,
      hasStatus: this.sessionStatus.has(sessionId),
      status: this.sessionStatus.get(sessionId)?.status,
      refCount: this.sessionStatus.get(sessionId)?.refCount,
      hasTabMapping: this.tabSessionMap.has(tabId),
      mappedSession: this.tabSessionMap.get(tabId)
    });

    const status = this.sessionStatus.get(sessionId);
    if (!status || status.status !== 'connected') {
      console.log('[MonitorManager] 会话状态不正确，跳过刷新:', {
        sessionId,
        status: status?.status,
        refCount: status?.refCount
      });
      return {} as MonitorData;
    }

    // 生成新的请求ID
    const requestId = Date.now();
    this.refreshRequestIds.set(tabId, requestId);

    try {
      status.status = 'refreshing';
      console.log('[MonitorManager] 刷新会话数据:', {
        sessionId,
        tabId,
        requestId,
        activeTab: this.activeTab,
        activeCard: this.activeCard,
        activeDetailTab: this.activeDetailTab[this.activeCard]
      });

      const monitorData: MonitorData = {
        timestamp: Date.now()
      };
      console.log('[MonitorManager] 当前活动标签页:', this.activeTab);
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
      
      // 检查请求ID是否仍然匹配
      if (this.refreshRequestIds.get(tabId) === requestId) {
        this.monitorData.set(tabId, monitorData);
        status.status = 'connected';
        console.log('[MonitorManager] 数据更新成功:', {
          tabId,
          sessionId,
          requestId,
          dataTimestamp: monitorData.timestamp
        });
      } else {
        console.log('[MonitorManager] 跳过数据更新：检测到更新的请求', {
          tabId,
          currentRequestId: this.refreshRequestIds.get(tabId),
          thisRequestId: requestId
        });
      }
      return monitorData;
    } catch (error) {
      console.error('[MonitorManager] 刷新会话数据失败:', {
        sessionId,
        tabId,
        requestId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      // 检查请求ID是否仍然匹配
      if (this.refreshRequestIds.get(tabId) === requestId) {
        status.status = 'error';
        status.error = (error as Error).message;
      }
      return {} as MonitorData;
    } finally {
      console.timeEnd(`[Performance] 刷新会话总耗时-开始 ${sessionId}`);
    }
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    this.refreshService.destroy();
    this.performanceManager.destroy();
    
    // 清理所有会话
    for (const [sessionId, status] of this.sessionStatus) {
      if (status.status === 'connected') {
        this.sshService.disconnect(sessionId);
      }
    }
    
    this.monitorData.clear();
    this.sessionStatus.clear();
    this.tabSessionMap.clear();
    MonitorManager.instance = null as any;
  }

  getNetworkService(): NetworkService {
    return this.networkService;
  }

  getNetworkProcessService(): NetworkProcessService {
    return NetworkProcessService.getInstance(this.sshService);
  }
} 