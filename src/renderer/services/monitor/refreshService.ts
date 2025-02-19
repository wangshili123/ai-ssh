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
  private refreshTasks: Map<string, RefreshTask> = new Map();
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
    // 等待配置加载完成
    await this.waitForConfig();
    this.initGlobalRefresh();
    this.initialized = true;
    console.log('[RefreshService] 初始化完成');
  }

  /**
   * 等待配置加载完成
   */
  private async waitForConfig() {
    return new Promise<void>((resolve) => {
      const checkConfig = () => {
        const config = this.configManager.getConfig();
        if (config && config.refreshInterval) {
          console.log('[RefreshService] 配置加载完成:', config);
          resolve();
        } else {
          console.log('[RefreshService] 等待配置加载...');
          setTimeout(checkConfig, 100);
        }
      };
      checkConfig();
    });
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
  private initGlobalRefresh() {
    if (this.globalRefreshTimer) {
      window.clearInterval(this.globalRefreshTimer);
    }

    const config = this.configManager.getConfig();
    console.log('[RefreshService] 初始化全局刷新定时器:', config);
    this.globalRefreshTimer = window.setInterval(() => {
      const currentTabId = eventBus.getCurrentTabId();
      if (!currentTabId) return;

      // 查找当前标签页对应的刷新任务
      for (const [_, task] of this.refreshTasks) {
        if (task.tabId === currentTabId) {
          this.refreshSession(task);
        }
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
    const monitorManager = getServiceManager().getMonitorManager();
    const updatedData = await monitorManager.refreshSession(task.sessionId);
    this.emit('refresh', task.sessionId);
  }

  /**
   * 启动刷新任务
   */
  async startRefresh(session: SessionInfo, tabId: string) {
    // 确保服务已初始化
    if (!this.initialized) {
      console.log('[RefreshService] 等待服务初始化...');
      await this.waitForConfig();
    }

    // 如果已存在任务则先停止
    this.stopRefresh(session.id);

    // 使用全局配置
    const config = this.configManager.getConfig();

    console.log(`[RefreshService] 启动刷新任务-${session.id}`, { 
      tabId, 
      config
    });

    // 创建刷新任务
    const task: RefreshTask = {
      timerId: 0,
      sessionId: session.id,
      tabId,
      options: {
        interval: config.refreshInterval * 1000
      
      }
    };

    // 立即执行一次刷新
    void this.refreshSession(task);

    // 保存任务
    this.refreshTasks.set(session.id, task);
  }

  /**
   * 停止刷新任务
   */
  stopRefresh(sessionId: string): void {
    const task = this.refreshTasks.get(sessionId);
    if (task) {
      this.refreshTasks.delete(sessionId);
      console.log(`[RefreshService] 停止刷新任务-${sessionId}`);
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
    for (const [sessionId] of this.refreshTasks) {
      this.stopRefresh(sessionId);
    }
    
    this.removeAllListeners();
    RefreshService.instance = null as any;
  }
}

// 导出单例
export const refreshService = RefreshService.getInstance(); 