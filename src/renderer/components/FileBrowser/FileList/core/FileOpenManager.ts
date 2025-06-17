/**
 * 文件打开管理器
 * 负责处理文件的打开方式和打开操作
 */

import { FileEntry } from '../../../../../main/types/file';
import { SessionInfo } from '../../../../types';
import { uiSettingsManager } from '../../../../services/UISettingsManager';
import { sftpConnectionManager } from '../../../../services/sftpConnectionManager';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ipcRenderer } from 'electron';

class FileOpenManager extends EventEmitter {
  private static instance: FileOpenManager;
  private sessionId: string = '';

  private constructor() {
    super();
  }

  public static getInstance(): FileOpenManager {
    if (!FileOpenManager.instance) {
      FileOpenManager.instance = new FileOpenManager();
    }
    return FileOpenManager.instance;
  }

  /**
   * 打开文件
   */
  async openFile(file: FileEntry, sessionInfo: SessionInfo, tabId: string, editor: 'built-in' = 'built-in'): Promise<void> {
    if (editor === 'built-in') {
      try {
        console.log('[FileOpenManager] 开始打开文件:', file.name);

        // 检查是否已有SFTP连接，优先复用相同sessionId的连接
        console.log('[FileOpenManager] 检查SFTP连接状态...');
        let existingConnection = sftpConnectionManager.getConnection(tabId);

        if (!existingConnection) {
          // 检查是否有相同sessionId的连接可以复用
          const sessionConnection = sftpConnectionManager.getConnectionBySessionId(sessionInfo.id);
          if (sessionConnection) {
            console.log('[FileOpenManager] 找到相同sessionId的连接，复用连接...');
            await sftpConnectionManager.createConnection(tabId, sessionInfo);
          } else {
            console.log('[FileOpenManager] 未找到现有SFTP连接，创建新连接...');
            await sftpConnectionManager.createConnection(tabId, sessionInfo);
          }
        } else {
          console.log('[FileOpenManager] 复用现有SFTP连接');
        }

        // 生成唯一的窗口ID
        const windowId = uuidv4();

        console.log('[FileOpenManager] 正在创建编辑器窗口...');

        // 使用 IPC 消息打开编辑器窗口
        const result = await ipcRenderer.invoke('open-editor-window', {
          windowId,
          filePath: file.path,
          sessionId: tabId,
          title: file.name
        });

        console.log('[FileOpenManager] 编辑器窗口创建完成:', result);

        // 监听窗口关闭事件
        ipcRenderer.once(`editor-window-closed-${windowId}`, async () => {
          console.log('[FileOpenManager] 编辑器窗口已关闭');
          // 注意：不要关闭SFTP连接，因为文件浏览器可能还在使用
          // 连接的生命周期由文件浏览器管理
        });
      } catch (error) {
        console.error('[FileOpenManager] 打开文件失败:', error);
        // 抛出错误让调用方处理，而不是直接显示Modal
        throw new Error(`无法打开文件: ${(error as Error).message}`);
      }
    }
  }

  /**
   * 获取文件的默认打开方式
   */
  async getDefaultEditor(file: FileEntry): Promise<'built-in'> {
    const extension = file.extension || '*';
    return uiSettingsManager.getDefaultEditor(extension);
  }

  /**
   * 设置默认打开方式
   */
  async setDefaultEditor(extension: string, editor: 'built-in'): Promise<void> {
    await uiSettingsManager.updateFileOpenSettings(extension, editor);
  }
}

export const fileOpenManager = FileOpenManager.getInstance(); 