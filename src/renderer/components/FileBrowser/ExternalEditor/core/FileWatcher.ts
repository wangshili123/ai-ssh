import * as fs from 'fs';
import { message } from 'antd';
import { eventBus } from '../../../../services/eventBus';
import type {
  ActiveEditorSession,
  FileWatchOptions,
  UploadProgress
} from '../types/ExternalEditorTypes';
import { TempFileManager } from './TempFileManager';

/**
 * 文件监控器
 * 负责监控临时文件的变化并触发自动上传
 */
export class FileWatcher {
  private watchers: Map<string, fs.StatWatcher> = new Map();
  private uploadTimers: Map<string, NodeJS.Timeout> = new Map();
  private sessions: Map<string, ActiveEditorSession> = new Map();
  private tempFileManager: TempFileManager;
  private defaultDebounceDelay: number = 2000;

  constructor(tempFileManager: TempFileManager) {
    this.tempFileManager = tempFileManager;
  }

  /**
   * 开始监控文件变化
   */
  startWatching(session: ActiveEditorSession, options?: Partial<FileWatchOptions>): void {
    const { id, tempFilePath, file } = session;

    if (this.watchers.has(id)) {
      console.log('[FileWatcher] 会话已在监控中:', id);
      return;
    }

    try {
      console.log('[FileWatcher] 开始监控文件:', tempFilePath);

      // 存储session信息
      this.sessions.set(id, session);

      // 使用fs.watchFile监控文件变化
      const watcher = fs.watchFile(tempFilePath, { interval: 1000 }, (curr, prev) => {
        // 检查文件是否真的被修改了
        if (curr.mtime.getTime() !== prev.mtime.getTime()) {
          console.log('[FileWatcher] 检测到文件变化:', file.name);
          this.handleFileChange(session, options?.debounceDelay);
        }
      });

      this.watchers.set(id, watcher);

      console.log('[FileWatcher] 文件监控已启动:', file.name);

    } catch (error) {
      console.error('[FileWatcher] 启动文件监控失败:', error);
      message.error(`启动文件监控失败: ${(error as Error).message}`);
    }
  }

  /**
   * 停止监控文件变化
   */
  stopWatching(sessionId: string): void {
    try {
      // 停止文件监控
      const session = this.sessions.get(sessionId);
      if (session) {
        fs.unwatchFile(session.tempFilePath);
        this.watchers.delete(sessionId);
        this.sessions.delete(sessionId);
        console.log('[FileWatcher] 停止文件监控:', sessionId);
      }

      // 清除上传定时器
      const timer = this.uploadTimers.get(sessionId);
      if (timer) {
        clearTimeout(timer);
        this.uploadTimers.delete(sessionId);
        console.log('[FileWatcher] 清除上传定时器:', sessionId);
      }

    } catch (error) {
      console.error('[FileWatcher] 停止文件监控失败:', error);
    }
  }

  /**
   * 停止所有文件监控
   */
  stopAllWatching(): void {
    console.log('[FileWatcher] 停止所有文件监控');
    
    // 停止所有监控器
    for (const [sessionId] of this.watchers) {
      this.stopWatching(sessionId);
    }
  }

  /**
   * 处理文件变化事件
   */
  private async handleFileChange(session: ActiveEditorSession, debounceDelay?: number): Promise<void> {
    const { id, tempFilePath, file, lastModified } = session;
    
    try {
      // 检查文件是否真的被修改了
      const isModified = await this.tempFileManager.isFileModified(id);
      if (!isModified) {
        console.log('[FileWatcher] 文件未实际修改，跳过上传:', file.name);
        return;
      }
      
      console.log('[FileWatcher] 文件已修改，准备上传:', file.name);
      
      // 清除之前的上传定时器
      const existingTimer = this.uploadTimers.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        console.log('[FileWatcher] 清除之前的上传定时器:', id);
      }
      
      // 设置延迟上传（防抖机制）
      const delay = debounceDelay || this.defaultDebounceDelay;
      const timer = setTimeout(async () => {
        await this.performUpload(session);
        this.uploadTimers.delete(id);
      }, delay);
      
      this.uploadTimers.set(id, timer);
      
      console.log('[FileWatcher] 设置延迟上传，延迟时间:', delay, 'ms');
      
    } catch (error) {
      console.error('[FileWatcher] 处理文件变化失败:', error);
      message.error(`处理文件变化失败: ${(error as Error).message}`);
    }
  }

  /**
   * 执行文件上传
   */
  private async performUpload(session: ActiveEditorSession): Promise<void> {
    const { id, file, tabId } = session;
    
    try {
      console.log('[FileWatcher] 开始上传文件:', file.name);
      
      // 设置上传状态
      session.isUploading = true;
      
      // 发送上传开始事件
      this.emitUploadProgress({
        sessionId: id,
        fileName: file.name,
        progress: 0,
        status: 'uploading'
      });
      
      // 执行文件上传
      const result = await this.tempFileManager.uploadFile(session);
      
      if (result.success) {
        console.log('[FileWatcher] 文件上传成功:', file.name);
        
        // 显示成功通知
        message.success(`文件 ${file.name} 已自动上传到服务器`);
        
        // 发送上传完成事件
        this.emitUploadProgress({
          sessionId: id,
          fileName: file.name,
          progress: 100,
          status: 'completed'
        });
        
        // 通知文件列表刷新
        eventBus.emit('file-uploaded', {
          tabId,
          fileName: file.name,
          filePath: file.path,
          success: true
        });
        
      } else {
        throw new Error(result.error || '上传失败');
      }
      
    } catch (error) {
      console.error('[FileWatcher] 文件上传失败:', error);
      
      const errorMessage = (error as Error).message;
      message.error(`文件 ${file.name} 上传失败: ${errorMessage}`);
      
      // 发送上传失败事件
      this.emitUploadProgress({
        sessionId: id,
        fileName: file.name,
        progress: 0,
        status: 'error',
        error: errorMessage
      });
      
      // 通知文件上传失败
      eventBus.emit('file-uploaded', {
        tabId,
        fileName: file.name,
        filePath: file.path,
        success: false,
        error: errorMessage
      });
      
    } finally {
      // 重置上传状态
      session.isUploading = false;
    }
  }

  /**
   * 立即上传文件（跳过防抖延迟）
   */
  async uploadImmediately(sessionId: string): Promise<void> {
    // 清除延迟上传定时器
    const timer = this.uploadTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.uploadTimers.delete(sessionId);
    }
    
    // 查找对应的会话（这里需要从外部传入或通过其他方式获取）
    // 暂时先记录日志
    console.log('[FileWatcher] 立即上传请求:', sessionId);
  }

  /**
   * 设置默认防抖延迟
   */
  setDefaultDebounceDelay(delay: number): void {
    this.defaultDebounceDelay = Math.max(500, delay); // 最小500ms
    console.log('[FileWatcher] 设置默认防抖延迟:', this.defaultDebounceDelay);
  }

  /**
   * 获取监控状态
   */
  getWatchingStatus(): { sessionId: string; filePath: string; isUploading: boolean }[] {
    const status: { sessionId: string; filePath: string; isUploading: boolean }[] = [];

    for (const [sessionId] of this.watchers) {
      const hasUploadTimer = this.uploadTimers.has(sessionId);
      const session = this.sessions.get(sessionId);

      if (session) {
        status.push({
          sessionId,
          filePath: session.tempFilePath,
          isUploading: hasUploadTimer
        });
      }
    }

    return status;
  }

  /**
   * 检查是否正在监控指定会话
   */
  isWatching(sessionId: string): boolean {
    return this.watchers.has(sessionId);
  }

  /**
   * 检查是否有待上传的文件
   */
  hasPendingUploads(): boolean {
    return this.uploadTimers.size > 0;
  }

  /**
   * 获取待上传文件数量
   */
  getPendingUploadCount(): number {
    return this.uploadTimers.size;
  }

  /**
   * 发送上传进度事件
   */
  private emitUploadProgress(progress: UploadProgress): void {
    eventBus.emit('external-editor-upload-progress', progress);
  }

  /**
   * 销毁文件监控器
   */
  destroy(): void {
    console.log('[FileWatcher] 销毁文件监控器');
    this.stopAllWatching();
    this.sessions.clear();
  }
}
