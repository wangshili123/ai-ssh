import { EventEmitter } from 'events';
import { SessionInfo } from '../../../types';

interface RefreshOptions {
  interval: number;      // 刷新间隔(毫秒)
  autoRefresh: boolean;  // 是否自动刷新
}

interface RefreshTask {
  sessionId: string;
  timerId: number;
  options: RefreshOptions;
}

/**
 * 数据刷新控制服务
 * 负责管理监控数据的刷新
 */
export class RefreshService extends EventEmitter {
  private static instance: RefreshService;
  private refreshTasks: Map<string, RefreshTask> = new Map();

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
   * @param session 会话信息
   */
  startRefresh(session: SessionInfo): void {
    // 如果已存在任务，先停止
    this.stopRefresh(session.id);

    const options: RefreshOptions = {
      interval: session.config?.refreshInterval || 5000,
      autoRefresh: session.config?.autoRefresh ?? true
    };

    // 如果不需要自动刷新，直接返回
    if (!options.autoRefresh) {
      return;
    }

    // 创建定时器
    const timerId = window.setInterval(() => {
      this.refresh(session.id);
    }, options.interval);

    // 保存任务信息
    this.refreshTasks.set(session.id, {
      sessionId: session.id,
      timerId,
      options
    });
  }

  /**
   * 停止刷新任务
   * @param sessionId 会话ID
   */
  stopRefresh(sessionId: string): void {
    const task = this.refreshTasks.get(sessionId);
    if (task) {
      clearInterval(task.timerId);
      this.refreshTasks.delete(sessionId);
    }
  }

  /**
   * 暂停刷新任务
   * @param sessionId 会话ID
   */
  pauseRefresh(sessionId: string): void {
    const task = this.refreshTasks.get(sessionId);
    if (task) {
      clearInterval(task.timerId);
    }
  }

  /**
   * 恢复刷新任务
   * @param sessionId 会话ID
   */
  resumeRefresh(sessionId: string): void {
    const task = this.refreshTasks.get(sessionId);
    if (task && task.options.autoRefresh) {
      const timerId = window.setInterval(() => {
        this.refresh(task.sessionId);
      }, task.options.interval);

      task.timerId = timerId;
    }
  }

  /**
   * 手动刷新
   * @param sessionId 会话ID
   */
  refresh(sessionId: string): void {
    // 触发刷新事件
    this.emit('refresh', sessionId);
  }

  /**
   * 更新刷新选项
   * @param sessionId 会话ID
   * @param options 新的选项
   */
  updateOptions(sessionId: string, options: Partial<RefreshOptions>): void {
    const task = this.refreshTasks.get(sessionId);
    if (task) {
      // 更新选项
      task.options = {
        ...task.options,
        ...options
      };

      // 重启任务以应用新选项
      this.stopRefresh(sessionId);
      if (task.options.autoRefresh) {
        const timerId = window.setInterval(() => {
          this.refresh(task.sessionId);
        }, task.options.interval);

        task.timerId = timerId;
      }
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
    const task = this.refreshTasks.get(sessionId);
    return {
      isRunning: !!task,
      options: task?.options
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