/**
 * 文件打开管理器
 * 负责处理文件的打开方式和打开操作
 */

import React from 'react';
import { FileEntry } from '../../../../../main/types/file';
import { SessionInfo } from '../../../../types';
import { Modal } from 'antd';
import { EditorDialog } from '../../FileEditor/components/EditorDialog/EditorDialog';
import { uiSettingsManager } from '../../../../services/UISettingsManager';
import { sftpService } from '../../../../services/sftp';
import ReactDOM from 'react-dom';

class FileOpenManager {
  private static instance: FileOpenManager;
  private dialogContainer: HTMLDivElement | null = null;

  private constructor() {
    // 创建对话框容器
    this.dialogContainer = document.createElement('div');
    document.body.appendChild(this.dialogContainer);
  }

  static getInstance(): FileOpenManager {
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
        // 先创建 SFTP 客户端
        await sftpService.createClient(tabId, sessionInfo);

        // 渲染编辑器对话框
        if (this.dialogContainer) {
          const handleClose = async () => {
            // 关闭 SFTP 客户端
            await sftpService.close(tabId);
            
            // 卸载组件
            if (this.dialogContainer) {
              ReactDOM.unmountComponentAtNode(this.dialogContainer);
            }
          };

          ReactDOM.render(
            React.createElement(EditorDialog, {
              visible: true,
              title: `编辑 - ${file.name}`,
              filePath: file.path,
              sessionId: tabId,
              onClose: handleClose
            }),
            this.dialogContainer
          );
        }
      } catch (error) {
        Modal.error({
          title: '打开文件失败',
          content: `无法打开文件: ${(error as Error).message}`
        });
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