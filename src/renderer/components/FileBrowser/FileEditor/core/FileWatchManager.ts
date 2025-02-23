/**
 * 文件监控管理器
 * 负责监控文件变化并实现实时更新功能
 */

import { EventEmitter } from 'events';
import chokidar from 'chokidar';
import { EditorEvents } from '../types/FileEditorTypes';
import fs from 'fs';
import { platform } from 'os';

export class FileWatchManager extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private fallbackInterval: NodeJS.Timeout | null = null;
  private lastModified: number = 0;
  private isWatching: boolean = false;
  private readonly isWindows: boolean = platform() === 'win32';

  constructor() {
    super();
  }

  /**
   * 开始监控文件变化
   * Windows: 使用轮询为主，事件监听为辅的策略
   * 其他平台: 使用事件监听为主，轮询为辅的策略
   */
  async startWatch(filePath: string): Promise<void> {
    try {
      // 如果已经在监听，先停止
      if (this.isWatching) {
        await this.stopWatch();
      }

      this.isWatching = true;

      // 获取文件初始状态
      try {
        const stats = await fs.promises.stat(filePath);
        this.lastModified = stats.mtimeMs;
      } catch (error) {
        console.warn('获取文件状态失败:', error);
      }

      // 根据平台配置不同的监听策略
      const watchOptions: chokidar.WatchOptions = {
        persistent: true,
        ignoreInitial: true,
        usePolling: this.isWindows, // Windows 下使用轮询
        interval: this.isWindows ? 1000 : undefined, // Windows 下设置轮询间隔
        awaitWriteFinish: {
          stabilityThreshold: this.isWindows ? 500 : 200,
          pollInterval: this.isWindows ? 200 : 100
        }
      };

      // 设置监听器
      this.watcher = chokidar.watch(filePath, watchOptions);

      this.watcher
        .on('change', async (path) => {
          try {
            const stats = await fs.promises.stat(path);
            if (stats.mtimeMs > this.lastModified) {
              this.lastModified = stats.mtimeMs;
              this.emit(EditorEvents.FILE_CHANGED);
            }
          } catch (error) {
            console.warn('检查文件变化失败:', error);
          }
        })
        .on('error', (error) => {
          this.emit(EditorEvents.ERROR_OCCURRED, error);
        });

      // 在非 Windows 平台上使用更短的轮询间隔作为备用
      // 在 Windows 平台上使用更长的轮询间隔作为主要机制
      this.startFallbackPolling(filePath);

    } catch (error) {
      this.emit(EditorEvents.ERROR_OCCURRED, error);
    }
  }

  /**
   * 启动轮询机制
   * Windows: 作为主要机制，使用较短的间隔
   * 其他平台: 作为备用机制，使用较长的间隔
   */
  private startFallbackPolling(filePath: string): void {
    const pollingInterval = this.isWindows ? 2000 : 5000;
    
    this.fallbackInterval = setInterval(async () => {
      if (!this.isWatching) return;

      try {
        const stats = await fs.promises.stat(filePath);
        if (stats.mtimeMs > this.lastModified) {
          this.lastModified = stats.mtimeMs;
          this.emit(EditorEvents.FILE_CHANGED);
        }
      } catch (error) {
        console.warn('轮询检查文件失败:', error);
      }
    }, pollingInterval);
  }

  /**
   * 停止文件监控
   */
  async stopWatch(): Promise<void> {
    this.isWatching = false;

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    if (this.fallbackInterval) {
      clearInterval(this.fallbackInterval);
      this.fallbackInterval = null;
    }
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    this.stopWatch();
    this.removeAllListeners();
  }
} 