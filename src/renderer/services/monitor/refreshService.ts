import { EventEmitter } from 'events';
import { SessionInfo } from '../../types';
import { getServiceManager } from './serviceManager';

interface RefreshOptions {
  interval: number;      // 刷新间隔(毫秒)
  autoRefresh: boolean;  // 是否自动刷新
}

/**
 * 数据刷新控制服务
 * 负责管理监控数据的刷新
 */
export class RefreshService extends EventEmitter {
  private static instance: RefreshService;
  private refreshTasks: Map<string, number> = new Map();

  private constructor() {
    super();
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
   * 启动刷新任务
   */
  startRefresh(session: SessionInfo, options: RefreshOptions) {
    // 如果已存在任务则先停止
    this.stopRefresh(session.id);

    if (!options.autoRefresh) {
      return;
    }

    console.log(`[RefreshService] 启动刷新任务-${session.id}`, options);

    // 创建定时器
    const timerId = window.setInterval(async () => {
      const monitorManager = getServiceManager().getMonitorManager();
      const updatedData = await monitorManager.refreshSession(session.id);
      this.emit('refresh', session.id);
    }, options.interval);

    // 保存定时器ID
    this.refreshTasks.set(session.id, timerId);
  }

  /**
   * 停止刷新任务
   */
  stopRefresh(sessionId: string): void {
    const timerId = this.refreshTasks.get(sessionId);
    if (timerId) {
      window.clearInterval(timerId);
      this.refreshTasks.delete(sessionId);
      console.log(`[RefreshService] 停止刷新任务-${sessionId}`);
    }
  }

  /**
   * 暂停刷新任务
   * @param sessionId 会话ID
   */
  pauseRefresh(sessionId: string): void {
    const timerId = this.refreshTasks.get(sessionId);
    if (timerId) {
      window.clearInterval(timerId);
    }
  }

  /**
   * 恢复刷新任务
   * @param sessionId 会话ID
   */
  resumeRefresh(sessionId: string, options: RefreshOptions): void {
    const timerId = this.refreshTasks.get(sessionId);
    if (timerId) {
      const timer = window.setInterval(async () => {
        const monitorManager = getServiceManager().getMonitorManager();
        const updatedData = await monitorManager.refreshSession(sessionId);
        this.emit('refresh', sessionId);
      }, options.interval);
      this.refreshTasks.set(sessionId, timer);
    }
  }

  /**
   * 获取任务状态
   * @param sessionId 会话ID
   */
  getTaskStatus(sessionId: string): {
    isRunning: boolean;
    options?: RefreshOptions;
  } {
    const timerId = this.refreshTasks.get(sessionId);
    return {
      isRunning: !!timerId,
      options: timerId ? {
        interval: this.refreshTasks.get(sessionId) as number,
        autoRefresh: true
      } : undefined
    };
  }

  /**
   * 销毁实例
   */
  destroy(): void {
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