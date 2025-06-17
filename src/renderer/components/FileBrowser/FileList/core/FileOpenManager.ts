/**
 * 文件打开管理器
 * 负责处理文件的打开方式和打开操作
 */

import { FileEntry } from '../../../../../main/types/file';
import { SessionInfo } from '../../../../types';
import { Modal } from 'antd';
import { uiSettingsManager } from '../../../../services/UISettingsManager';
import { sftpService } from '../../../../services/sftp';
import { FileListEvents } from './FileListEvents';
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

        // 先创建 SFTP 客户端
        console.log('[FileOpenManager] 创建SFTP客户端...');
        await sftpService.createClient(tabId, sessionInfo);

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
          // 关闭 SFTP 客户端
          await sftpService.close(tabId);
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