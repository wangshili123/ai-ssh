/**
 * 文件打开管理器
 * 负责处理文件的打开方式和打开操作
 */

import React from 'react';
import { FileEntry } from '../../../../../main/types/file';
import { SessionInfo } from '../../../../types';
import { Modal } from 'antd';
import { FileEditorMain, FileEditorMainRef } from '../../FileEditor/components/FileEditorMain/FileEditorMain';
import { uiSettingsManager } from '../../../../services/UISettingsManager';
import { sftpService } from '../../../../services/sftp';
import '../../FileEditor/components/EditorModal.css';

class FileOpenManager {
  private static instance: FileOpenManager;

  private constructor() {}

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

        const editorRef = React.createRef<FileEditorMainRef>();

        // 使用内置编辑器打开
        Modal.info({
          title: `编辑 - ${file.name}`,
          content: React.createElement('div', 
            { 
              style: { 
                height: '80vh', 
                marginTop: 16, 
                marginBottom: 16,
                padding: 0
              } 
            },
            React.createElement(FileEditorMain, {
              filePath: file.path,
              sessionId: tabId,
              initialConfig: {
                readOnly: false
              },
              ref: editorRef
            })
          ),
          width: '80%',
          maskClosable: true,
          okText: '保存',
          cancelText: '关闭',
          className: 'file-editor-modal',
          style: { top: 20 },
          bodyStyle: { padding: 0 },
          keyboard: true,
          closable: true,
          type: 'confirm',
          onOk: async () => {
            try {
              await editorRef.current?.save();
            } finally {
              // 确保关闭 SFTP 客户端
              await sftpService.close(tabId);
            }
          },
          onCancel: async () => {
            try {
              // 如果文件有修改，提示保存
              if (editorRef.current?.isDirty) {
                const result = await Modal.confirm({
                  title: '保存更改',
                  content: '文件已修改，是否保存更改？',
                  okText: '保存',
                  cancelText: '不保存'
                });
                
                if (result) {
                  await editorRef.current.save();
                }
              }
            } finally {
              // 确保在取消时也关闭 SFTP 客户端
              await sftpService.close(tabId);
            }
          }
        });
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