import { EventEmitter } from 'events';
import { SessionInfo } from '../../types';
import { getServiceManager } from './serviceManager';
import { eventBus } from '../../services/eventBus';
import { MonitorConfigManager } from '../config/MonitorConfig';

interface RefreshOptions {
  interval: number;      // 刷新间隔(毫秒)
}

interface RefreshTask {
  timerId: number;
  sessionId: string;
  tabId: string;
  options: RefreshOptions;
}

/**
 * 数据刷新控制服务
 * 负责管理监控数据的刷新
 */
export class RefreshService extends EventEmitter {
  private static instance: RefreshService;
  private refreshTasks: Map<string, RefreshTask> = new Map();  // key 为 tabId
  private globalRefreshTimer: number | null = null;
  private configManager: MonitorConfigManager;
  private initialized: boolean = false;

  private constructor() {
    super();
    this.configManager = MonitorConfigManager.getInstance();
    // 延迟初始化，等待配置加载完成
    this.init();
  }

  /**
   * 初始化服务
   */
  private async init() {
    try {
      // 获取配置
      const config = await this.configManager.getConfig();
      this.initGlobalRefresh();
      this.initialized = true;
      console.log('[RefreshService] 初始化完成');
    } catch (error) {
      console.error('[RefreshService] 初始化失败:', error);
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(): RefreshService {
    if (!RefreshService.instance) {
      RefreshService.instance = new RefreshService();
    }
    return RefreshService.instance;
  }

  /**
   * 初始化全局刷新定时器
   */
  private async initGlobalRefresh() {
    if (this.globalRefreshTimer) {
      window.clearInterval(this.globalRefreshTimer);
    }

    const config = await this.configManager.getConfig();
    console.log('[RefreshService] 初始化全局刷新定时器:', config);
    this.globalRefreshTimer = window.setInterval(() => {
      const currentTabId = eventBus.getCurrentTabId();
      if (!currentTabId) return;

      // 查找当前标签页对应的刷新任务
      const task = this.refreshTasks.get(currentTabId);
      if (task) {
        this.refreshSession(task);
      }
    }, config.refreshInterval * 1000); // 使用配置的刷新间隔（秒转毫秒）

    console.log('[RefreshService] 初始化全局刷新定时器:', {
      interval: config.refreshInterval
    });
  }

  /**
   * 刷新指定会话的数据
   */
  private async refreshSession(task: RefreshTask) {
    console.log('[RefreshService] 开始刷新会话数据:', {
      sessionId: task.sessionId,
      tabId: task.tabId,
      timestamp: new Date().toISOString()
    });

    const monitorManager = getServiceManager().getMonitorManager();
    const updatedData = await monitorManager.refreshSession(task.sessionId, task.tabId);
    
    console.log('[RefreshService] 会话数据刷新完成:', {
      sessionId: task.sessionId,
      tabId: task.tabId,
      hasData: !!updatedData,
      timestamp: new Date().toISOString()
    });

    this.emit('refresh', task.sessionId, task.tabId);
  }

  /**
   * 启动刷新任务
   */
  async startRefresh(sessionInfo: SessionInfo, tabId: string) {
    // 确保服务已初始化
    if (!this.initialized) {
      console.log('[RefreshService] 等待服务初始化...');
      await this.init();
    }

    // 如果已存在任务则先停止（使用 tabId 检查）
    this.stopRefresh(tabId);

    // 使用全局配置
    const config = await this.configManager.getConfig();

    console.log(`[RefreshService] 启动刷新任务:`, { 
      sessionId: sessionInfo.id,
      tabId, 
      config
    });

    // 创建刷新任务
    const task: RefreshTask = {
      timerId: 0,
      sessionId: sessionInfo.id,
      tabId,
      options: {
        interval: config.refreshInterval * 1000
      }
    };

    // 立即执行一次刷新
    void this.refreshSession(task);

    // 保存任务（使用 tabId 作为 key）
    this.refreshTasks.set(tabId, task);
  }

  /**
   * 停止刷新任务
   */
  stopRefresh(tabId: string): void {
    console.log('[RefreshService] 准备停止刷新任务:', {
      tabId,
      existingTasks: Array.from(this.refreshTasks.keys()),
      hasTask: this.refreshTasks.has(tabId)
    });

    const task = this.refreshTasks.get(tabId);
    if (task) {
      console.log('[RefreshService] 找到要停止的任务:', {
        sessionId: task.sessionId,
        tabId: task.tabId,
        options: task.options
      });
      
      this.refreshTasks.delete(tabId);
      console.log(`[RefreshService] 停止刷新任务:`, {
        tabId,
        remainingTasks: Array.from(this.refreshTasks.keys())
      });
    } else {
      console.log('[RefreshService] 未找到要停止的任务:', { tabId });
    }
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    // 停止全局定时器
    if (this.globalRefreshTimer) {
      window.clearInterval(this.globalRefreshTimer);
      this.globalRefreshTimer = null;
    }

    // 停止所有刷新任务
    for (const [tabId] of this.refreshTasks) {
      this.stopRefresh(tabId);
    }
    
    this.removeAllListeners();
    RefreshService.instance = null as any;
  }
}

// 导出单例
export const refreshService = RefreshService.getInstance(); 