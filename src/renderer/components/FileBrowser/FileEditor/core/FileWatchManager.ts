/**
 * 文件监控管理器
 * 负责监控文件变化并实时更新内容
 */

import { EventEmitter } from 'events';
import { EditorEvents, FileWatchConfig, FileWatchState, FileWatchEventData } from '../types/FileEditorTypes';

/**
 * 文件监控管理器
 * 负责监控文件变化并实时更新内容
 */
export class FileWatchManager extends EventEmitter {
  private watchStates: Map<string, FileWatchState> = new Map();
  private config: FileWatchConfig;
  private isDisposed: boolean = false;

  /**
   * 构造函数
   * @param config 监控配置
   */
  constructor(config?: Partial<FileWatchConfig>) {
    super();
    
    // 默认配置
    const defaultConfig: FileWatchConfig = {
      minInterval: 1000,
      maxInterval: 10000,
      initialInterval: 2000,
      backoffFactor: 1.5,
      maxRetries: 5,
      bufferSizeLimit: 10 * 1024 * 1024, // 10MB
      incrementalSize: 1024 * 1024, // 1MB
      batchSize: 1000,
      throttleInterval: 500
    };
    
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * 开始监控文件
   * @param sessionId 会话ID
   * @param filePath 文件路径
   */
  public async startWatch(sessionId: string, filePath: string): Promise<void> {
    if (this.isDisposed) {
      throw new Error('FileWatchManager已被销毁');
    }
    
    // 生成唯一键
    const key = `${sessionId}:${filePath}`;
    
    // 如果已经在监控，先停止
    if (this.watchStates.has(key)) {
      await this.stopWatch(sessionId, filePath);
    }
    
    // 初始化监控状态
    const watchState: FileWatchState = {
      isWatching: true,
      currentInterval: this.config.initialInterval,
      lastCheckTime: Date.now(),
      lastSize: 0,
      lastReadPosition: 0,
      retryCount: 0,
      isPaused: false,
      bufferUsage: 0,
      sessionId,
      filePath,
      lastModified: 0,
      stats: {
        totalUpdates: 0,
        failedUpdates: 0,
        lastUpdateTime: 0,
        averageUpdateSize: 0,
        newLines: 0,
        totalLines: 0,
        updateSize: 0
      }
    };
    
    this.watchStates.set(key, watchState);
    
    // 发出监控开始事件
    this.emit(EditorEvents.WATCH_STARTED, {
      type: 'info',
      filePath,
      sessionId,
      timestamp: Date.now(),
      info: `开始监控文件: ${filePath}`,
      stats: watchState.stats
    } as FileWatchEventData);
    
    // 开始轮询
    this.poll(key);
  }

  /**
   * 停止监控文件
   * @param sessionId 会话ID
   * @param filePath 文件路径
   */
  public async stopWatch(sessionId: string, filePath: string): Promise<void> {
    const key = `${sessionId}:${filePath}`;
    
    if (this.watchStates.has(key)) {
      const state = this.watchStates.get(key)!;
      state.isWatching = false;
      
      // 发出监控停止事件
      this.emit(EditorEvents.WATCH_STOPPED, {
        type: 'info',
        filePath,
        sessionId,
        timestamp: Date.now(),
        info: `停止监控文件: ${filePath}`,
        stats: state.stats
      } as FileWatchEventData);
      
      this.watchStates.delete(key);
    }
  }

  /**
   * 暂停监控
   * @param sessionId 会话ID
   * @param filePath 文件路径
   */
  public pauseWatch(sessionId: string, filePath: string): void {
    const key = `${sessionId}:${filePath}`;
    
    if (this.watchStates.has(key)) {
      const state = this.watchStates.get(key)!;
      state.isPaused = true;
    }
  }

  /**
   * 恢复监控
   * @param sessionId 会话ID
   * @param filePath 文件路径
   */
  public resumeWatch(sessionId: string, filePath: string): void {
    const key = `${sessionId}:${filePath}`;
    
    if (this.watchStates.has(key)) {
      const state = this.watchStates.get(key)!;
      state.isPaused = false;
    }
  }

  /**
   * 轮询检查文件变化
   * @param key 监控键
   */
  private async poll(key: string): Promise<void> {
    if (!this.watchStates.has(key) || this.isDisposed) {
      return;
    }
    
    const state = this.watchStates.get(key)!;
    
    if (!state.isWatching || state.isPaused) {
      return;
    }
    
    try {
      // 检查文件变化
      await this.checkFileChanges(key);
      
      // 重置重试计数
      state.retryCount = 0;
      
      // 根据文件变化频率动态调整轮询间隔
      this.adjustPollingInterval(key);
    } catch (error) {
      // 增加重试计数
      state.retryCount++;
      
      // 记录失败
      state.stats.failedUpdates++;
      
      // 发出错误事件
      this.emit(EditorEvents.ERROR_OCCURRED, {
        type: 'error',
        filePath: state.filePath,
        sessionId: state.sessionId,
        timestamp: Date.now(),
        error: error instanceof Error ? error : new Error(String(error)),
        stats: state.stats
      } as FileWatchEventData);
      
      // 如果超过最大重试次数，停止监控
      if (state.retryCount > this.config.maxRetries) {
        this.stopWatch(state.sessionId, state.filePath);
        return;
      }
      
      // 增加轮询间隔
      state.currentInterval = Math.min(
        state.currentInterval * this.config.backoffFactor,
        this.config.maxInterval
      );
    }
    
    // 安排下一次轮询
    if (state.isWatching) {
      setTimeout(() => this.poll(key), state.currentInterval);
    }
  }

  /**
   * 检查文件变化
   * @param key 监控键
   */
  private async checkFileChanges(key: string): Promise<void> {
    // 实际实现中，这里需要根据不同的文件系统和远程连接方式来实现
    // 这里只是一个示例框架
    
    const state = this.watchStates.get(key)!;
    
    // 更新状态
    state.lastCheckTime = Date.now();
    
    // 模拟文件变化检测
    // 在实际实现中，这里需要通过SFTP或其他方式获取文件信息
    const newContent = ['模拟的新内容行1', '模拟的新内容行2'];
    
    // 发出更新事件
    this.emit(EditorEvents.FILE_CHANGED, {
      type: 'update',
      filePath: state.filePath,
      sessionId: state.sessionId,
      timestamp: Date.now(),
      content: newContent,
      stats: {
        ...state.stats,
        totalUpdates: state.stats.totalUpdates + 1,
        lastUpdateTime: Date.now(),
        newLines: newContent.length,
        updateSize: newContent.join('\n').length
      }
    } as FileWatchEventData);
  }

  /**
   * 调整轮询间隔
   * @param key 监控键
   */
  private adjustPollingInterval(key: string): void {
    const state = this.watchStates.get(key)!;
    
    // 根据文件变化频率动态调整轮询间隔
    // 如果文件经常变化，减少间隔；如果很少变化，增加间隔
    if (state.stats.totalUpdates > 0 && state.stats.lastUpdateTime > 0) {
      const timeSinceLastUpdate = Date.now() - state.stats.lastUpdateTime;
      
      if (timeSinceLastUpdate < 5000) {
        // 文件频繁变化，减少间隔
        state.currentInterval = Math.max(
          state.currentInterval / this.config.backoffFactor,
          this.config.minInterval
        );
      } else if (timeSinceLastUpdate > 30000) {
        // 文件很少变化，增加间隔
        state.currentInterval = Math.min(
          state.currentInterval * this.config.backoffFactor,
          this.config.maxInterval
        );
      }
    }
  }

  /**
   * 获取监控状态
   * @param sessionId 会话ID
   * @param filePath 文件路径
   */
  public getWatchState(sessionId: string, filePath: string): FileWatchState | null {
    const key = `${sessionId}:${filePath}`;
    return this.watchStates.get(key) || null;
  }

  /**
   * 清理资源
   */
  public destroy(): void {
    if (this.isDisposed) {
      return;
    }
    
    this.isDisposed = true;
    
    // 停止所有监控
    for (const [key, state] of this.watchStates.entries()) {
      this.stopWatch(state.sessionId, state.filePath);
    }
    
    this.watchStates.clear();
    this.removeAllListeners();
  }
} 