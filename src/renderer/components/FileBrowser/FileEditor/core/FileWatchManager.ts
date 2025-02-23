/**
 * 文件监控管理器
 * 负责监控文件变化并实现实时更新功能
 */

import { EventEmitter } from 'events';
import * as chokidar from 'chokidar';
import { debounceTime, Subject } from 'rxjs';
import { EditorEvents } from '../types/FileEditorTypes';

export class FileWatchManager extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private fileChangeSubject = new Subject<void>();
  private currentFile: string | null = null;
  private isWatching: boolean = false;
  private debounceInterval: number = 300; // 防抖间隔，单位毫秒

  constructor() {
    super();
    this.setupChangeHandler();
  }

  /**
   * 开始监控文件
   * @param filePath 文件路径
   */
  public startWatch(filePath: string): void {
    // 如果已经在监控同一个文件，则不需要重新启动
    if (this.currentFile === filePath && this.isWatching) {
      return;
    }

    // 如果正在监控其他文件，先停止
    this.stopWatch();

    this.currentFile = filePath;
    
    try {
      // 创建文件监控器
      this.watcher = chokidar.watch(filePath, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 100
        }
      });

      // 监听文件变化事件
      this.watcher
        .on('change', () => {
          this.fileChangeSubject.next();
        })
        .on('unlink', () => {
          this.emit(EditorEvents.ERROR_OCCURRED, new Error('文件已被删除'));
          this.stopWatch();
        })
        .on('error', (error) => {
          this.emit(EditorEvents.ERROR_OCCURRED, error);
          this.stopWatch();
        });

      this.isWatching = true;
      this.emit(EditorEvents.WATCH_STARTED, filePath);
    } catch (error) {
      this.emit(EditorEvents.ERROR_OCCURRED, error);
    }
  }

  /**
   * 停止文件监控
   */
  public stopWatch(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.currentFile = null;
    this.isWatching = false;
    this.emit(EditorEvents.WATCH_STOPPED);
  }

  /**
   * 设置变化检测的防抖间隔
   * @param interval 间隔时间（毫秒）
   */
  public setDebounceInterval(interval: number): void {
    this.debounceInterval = interval;
    this.setupChangeHandler();
  }

  /**
   * 获取当前监控状态
   */
  public getStatus(): {
    isWatching: boolean;
    currentFile: string | null;
    debounceInterval: number;
  } {
    return {
      isWatching: this.isWatching,
      currentFile: this.currentFile,
      debounceInterval: this.debounceInterval
    };
  }

  /**
   * 设置变化处理器
   */
  private setupChangeHandler(): void {
    // 使用 RxJS 的 debounceTime 操作符来防抖
    this.fileChangeSubject.pipe(
      debounceTime(this.debounceInterval)
    ).subscribe(() => {
      if (this.currentFile) {
        this.emit(EditorEvents.FILE_CHANGED, this.currentFile);
      }
    });
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    this.stopWatch();
    this.fileChangeSubject.complete();
    this.removeAllListeners();
  }
} 