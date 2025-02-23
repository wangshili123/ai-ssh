/**
 * 文件监控管理器
 * 负责监控远程文件变化并实现实时更新功能
 */

import { EventEmitter } from 'events';
import { EditorEvents } from '../types/FileEditorTypes';
import { sftpService } from '../../../../services/sftp';

export class FileWatchManager extends EventEmitter {
  private isWatching: boolean = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastModified: number = 0;
  private sessionId: string = '';
  private filePath: string = '';

  constructor() {
    super();
  }

  /**
   * 开始监控文件变化
   * 使用轮询方式检查远程文件的修改时间
   */
  async startWatch(sessionId: string, filePath: string): Promise<void> {
    try {
      // 如果已经在监听，先停止
      if (this.isWatching) {
        await this.stopWatch();
      }

      this.sessionId = sessionId;
      this.filePath = filePath;
      this.isWatching = true;

      // 获取文件初始状态
      try {
        const stats = await sftpService.stat(this.sessionId, this.filePath);
        this.lastModified = stats.modifyTime;
      } catch (error) {
        console.warn('获取文件状态失败:', error);
      }

      // 设置轮询检查
      this.startPolling();

    } catch (error) {
      this.emit(EditorEvents.ERROR_OCCURRED, error);
    }
  }

  /**
   * 启动轮询机制
   */
  private startPolling(): void {
    const pollingInterval = 3000; // 3秒检查一次
    
    this.pollInterval = setInterval(async () => {
      if (!this.isWatching) return;

      try {
        const stats = await sftpService.stat(this.sessionId, this.filePath);
        if (stats.modifyTime > this.lastModified) {
          this.lastModified = stats.modifyTime;
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

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
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