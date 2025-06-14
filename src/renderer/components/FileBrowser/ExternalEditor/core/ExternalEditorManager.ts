import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';
import { message, Modal } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import { eventBus } from '../../../../services/eventBus';
import { unifiedEditorConfig } from '../config/UnifiedEditorConfig';
import { TempFileManager } from './TempFileManager';
import { FileWatcher } from './FileWatcher';
import type { 
  ActiveEditorSession, 
  EditorConfig, 
  EditingStatus,
  EditorLaunchOptions,
  FileOperationResult
} from '../types/ExternalEditorTypes';
import type { FileEntry } from '../../../../../main/types/file';
import type { SessionInfo } from '../../../../types';

/**
 * 外部编辑器核心管理器
 * 负责协调各个组件，管理编辑器会话的完整生命周期
 */
export class ExternalEditorManager {
  private tempFileManager: TempFileManager;
  private fileWatcher: FileWatcher;
  private activeEditors: Map<string, ActiveEditorSession> = new Map();
  private editorSelectorCallback?: (file: FileEntry, editors: EditorConfig[]) => Promise<string | null>;

  constructor() {
    // 初始化临时文件管理器
    // 使用默认临时目录，稍后会在第一次使用时更新
    this.tempFileManager = new TempFileManager('');

    // 初始化文件监控器
    this.fileWatcher = new FileWatcher(this.tempFileManager);

    // 监听配置变化
    this.setupConfigListeners();

    // 异步初始化配置
    this.initializeConfig();

    console.log('[ExternalEditorManager] 外部编辑器管理器已初始化');
  }

  /**
   * 设置编辑器选择回调
   */
  setEditorSelectorCallback(callback: (file: FileEntry, editors: EditorConfig[]) => Promise<string | null>): void {
    this.editorSelectorCallback = callback;
  }

  /**
   * 使用外部编辑器打开文件
   */
  async openFileWithExternalEditor(
    file: FileEntry,
    sessionInfo: SessionInfo,
    tabId: string,
    editorId?: string
  ): Promise<void> {
    try {
      console.log('[ExternalEditorManager] 开始打开文件:', file.name);
      
      // 1. 选择编辑器
      const editor = await this.selectEditor(file, editorId);
      if (!editor) {
        console.log('[ExternalEditorManager] 用户取消选择编辑器');
        return;
      }
      
      // 2. 创建编辑会话
      const session = this.createEditorSession(file, sessionInfo, tabId, editor);
      
      // 3. 下载文件到临时目录
      await this.downloadFile(session);
      
      // 4. 启动外部编辑器
      await this.launchEditor(session);
      
      // 5. 开始监控文件变化（如果启用自动上传）
      const settings = await unifiedEditorConfig.getSettings();
      if (settings.autoUpload) {
        await this.startFileWatching(session);
      }
      
      // 6. 发送会话开始事件
      eventBus.emit('external-editor-session-started', session);
      
      console.log('[ExternalEditorManager] 文件打开成功:', file.name);
      message.success(`已使用 ${editor.name} 打开文件 ${file.name}`);
      
    } catch (error) {
      console.error('[ExternalEditorManager] 打开文件失败:', error);
      message.error(`打开文件失败: ${(error as Error).message}`);
    }
  }

  /**
   * 关闭编辑器会话
   */
  async closeEditorSession(sessionId: string): Promise<void> {
    const session = this.activeEditors.get(sessionId);
    if (!session) {
      console.warn('[ExternalEditorManager] 会话不存在:', sessionId);
      return;
    }
    
    try {
      console.log('[ExternalEditorManager] 关闭编辑器会话:', session.file.name);
      
      // 1. 停止文件监控
      this.fileWatcher.stopWatching(sessionId);
      
      // 2. 检查是否有未保存的更改
      const hasChanges = await this.tempFileManager.isFileModified(sessionId);
      if (hasChanges) {
        const shouldUpload = await this.confirmFinalUpload(session);
        if (shouldUpload) {
          await this.tempFileManager.uploadFile(session);
        }
      }
      
      // 3. 清理临时文件
      await this.tempFileManager.cleanupTempFile(sessionId);
      
      // 4. 终止编辑器进程（如果仍在运行）
      if (session.editorProcess && !session.editorProcess.killed) {
        session.editorProcess.kill();
      }
      
      // 5. 从活动会话中移除
      this.activeEditors.delete(sessionId);
      
      // 6. 发送会话结束事件
      eventBus.emit('external-editor-session-ended', sessionId);
      
      console.log('[ExternalEditorManager] 编辑器会话已关闭:', session.file.name);
      
    } catch (error) {
      console.error('[ExternalEditorManager] 关闭会话失败:', error);
    }
  }

  /**
   * 获取活动的编辑器会话
   */
  getActiveEditorSessions(): ActiveEditorSession[] {
    return Array.from(this.activeEditors.values());
  }

  /**
   * 获取指定会话
   */
  getEditorSession(sessionId: string): ActiveEditorSession | undefined {
    return this.activeEditors.get(sessionId);
  }

  /**
   * 立即上传文件
   */
  async uploadFileImmediately(sessionId: string): Promise<void> {
    const session = this.activeEditors.get(sessionId);
    if (!session) {
      throw new Error('会话不存在');
    }

    const result = await this.tempFileManager.uploadFile(session);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  /**
   * 测试编辑器启动
   */
  async testEditorLaunch(editorConfig: EditorConfig, testFilePath?: string): Promise<boolean> {
    try {
      const filePath = testFilePath || 'test.txt';
      const args = this.buildCommandArgs(editorConfig, filePath);

      console.log('[ExternalEditorManager] 测试启动编辑器:', editorConfig.name);
      console.log('[ExternalEditorManager] 命令:', editorConfig.executablePath, args);

      const process = spawn(editorConfig.executablePath, args, {
        detached: true,
        stdio: 'ignore'
      });

      process.unref();

      // 简单检查进程是否启动成功
      return new Promise((resolve) => {
        process.on('error', () => resolve(false));
        process.on('spawn', () => resolve(true));

        // 超时检查
        setTimeout(() => resolve(false), 3000);
      });

    } catch (error) {
      console.error('[ExternalEditorManager] 测试启动失败:', error);
      return false;
    }
  }

  /**
   * 选择编辑器
   */
  private async selectEditor(file: FileEntry, editorId?: string): Promise<EditorConfig | null> {
    const config = await unifiedEditorConfig.getSettings();
    const editors = await unifiedEditorConfig.getEditors();

    if (editors.length === 0) {
      message.warning('请先配置外部编辑器');
      return null;
    }

    // 如果指定了编辑器ID，直接使用
    if (editorId) {
      const editor = editors.find(e => e.id === editorId);
      if (editor) return editor;
    }

    // 根据打开模式选择编辑器
    switch (config.openMode) {
      case 'default':
        return await unifiedEditorConfig.getDefaultEditor() || null;

      case 'remember':
        // 检查文件关联
        const associatedEditor = await unifiedEditorConfig.getEditorForFile(file.name);
        if (associatedEditor) return associatedEditor;
        // 如果没有关联，继续到询问模式

      case 'ask':
      default:
        // 显示编辑器选择对话框
        if (this.editorSelectorCallback) {
          const selectedEditorId = await this.editorSelectorCallback(file);
          return selectedEditorId ? editors.find(e => e.id === selectedEditorId) || null : null;
        }
        return null;
    }
  }

  /**
   * 创建编辑器会话
   */
  private createEditorSession(
    file: FileEntry,
    sessionInfo: SessionInfo,
    tabId: string,
    editor: EditorConfig
  ): ActiveEditorSession {
    const sessionId = uuidv4();
    
    const session: ActiveEditorSession = {
      id: sessionId,
      file,
      sessionInfo,
      tabId,
      editor,
      tempFilePath: '', // 将在下载时设置
      lastModified: 0,
      isUploading: false
    };
    
    this.activeEditors.set(sessionId, session);
    console.log('[ExternalEditorManager] 创建编辑器会话:', sessionId);
    
    return session;
  }

  /**
   * 下载文件
   */
  private async downloadFile(session: ActiveEditorSession): Promise<void> {
    console.log('[ExternalEditorManager] 下载文件:', session.file.name);
    
    const result = await this.tempFileManager.downloadFile(session);
    if (!result.success) {
      throw new Error(result.error || '文件下载失败');
    }
  }

  /**
   * 启动外部编辑器
   */
  private async launchEditor(session: ActiveEditorSession): Promise<void> {
    const { editor, tempFilePath, file } = session;
    
    try {
      console.log('[ExternalEditorManager] 启动编辑器:', editor.name);
      
      // 构建启动参数
      const args = this.buildCommandArgs(editor, tempFilePath);
      
      // 启动编辑器进程
      const process = spawn(editor.executablePath, args, {
        detached: true,
        stdio: 'ignore'
      });
      
      // 监听进程事件
      process.on('error', (error) => {
        console.error('[ExternalEditorManager] 编辑器启动失败:', error);
        message.error(`启动编辑器失败: ${error.message}`);
      });
      
      process.on('spawn', () => {
        console.log('[ExternalEditorManager] 编辑器已启动:', editor.name);
      });
      
      // 允许父进程退出而不等待子进程
      process.unref();
      
      session.editorProcess = process;
      
    } catch (error) {
      console.error('[ExternalEditorManager] 启动编辑器异常:', error);
      throw new Error(`启动编辑器失败: ${(error as Error).message}`);
    }
  }

  /**
   * 开始文件监控
   */
  private async startFileWatching(session: ActiveEditorSession): Promise<void> {
    const config = await unifiedEditorConfig.getSettings();
    this.fileWatcher.startWatching(session, {
      session,
      onFileChange: async (session) => {
        // 文件变化处理逻辑已在FileWatcher中实现
      },
      debounceDelay: config.uploadDelay
    });
  }

  /**
   * 构建命令行参数
   */
  private buildCommandArgs(editor: EditorConfig, filePath: string): string[] {
    const args: string[] = [];
    
    // 添加用户自定义参数
    if (editor.arguments) {
      const customArgs = editor.arguments.split(' ').filter(arg => arg.trim());
      args.push(...customArgs);
    }
    
    // 添加文件路径
    args.push(filePath);
    
    console.log('[ExternalEditorManager] 构建命令参数:', args);
    return args;
  }

  /**
   * 确认最终上传
   */
  private async confirmFinalUpload(session: ActiveEditorSession): Promise<boolean> {
    return new Promise((resolve) => {
      Modal.confirm({
        title: '文件已修改',
        content: `文件 ${session.file.name} 已被修改，是否上传到服务器？`,
        okText: '上传',
        cancelText: '不上传',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });
  }

  /**
   * 初始化配置
   */
  private async initializeConfig(): Promise<void> {
    try {
      const settings = await unifiedEditorConfig.getSettings();
      console.log('[ExternalEditorManager] 加载配置:', settings);

      // 设置临时目录
      if (settings.tempDirectory) {
        this.tempFileManager.setTempDirectory(settings.tempDirectory);
        console.log('[ExternalEditorManager] 设置临时目录:', settings.tempDirectory);
      }

      // 设置文件监控延迟
      this.fileWatcher.setDefaultDebounceDelay(settings.uploadDelay);

    } catch (error) {
      console.error('[ExternalEditorManager] 初始化配置失败:', error);
    }
  }

  /**
   * 设置配置监听器
   */
  private setupConfigListeners(): void {
    // 监听配置变化，更新临时目录
    eventBus.on('external-editor-config-changed', (config) => {
      this.tempFileManager.setTempDirectory(config.tempDirectory);
      this.fileWatcher.setDefaultDebounceDelay(config.uploadDelay);
    });

    console.log('[ExternalEditorManager] 配置监听器已设置');
  }

  /**
   * 销毁管理器
   */
  async destroy(): Promise<void> {
    console.log('[ExternalEditorManager] 销毁外部编辑器管理器');
    
    // 关闭所有活动会话
    const sessionIds = Array.from(this.activeEditors.keys());
    for (const sessionId of sessionIds) {
      await this.closeEditorSession(sessionId);
    }
    
    // 销毁组件
    this.fileWatcher.destroy();
    await this.tempFileManager.destroy();
  }
}

// 创建全局实例
export const externalEditorManager = new ExternalEditorManager();
