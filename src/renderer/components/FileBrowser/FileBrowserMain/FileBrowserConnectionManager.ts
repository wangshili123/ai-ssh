import { sftpConnectionManager } from '../../../services/sftpConnectionManager';
import { FileBrowserStateManager } from './FileBrowserStateManager';
import type { SessionInfo } from '../../../types';
import type { FileEntry } from '../../../../main/types/file';
import type { FileBrowserTabState } from './FileBrowserTypes';
import type { DataNode } from 'antd/es/tree';

/**
 * 文件浏览器连接管理类
 */
export class FileBrowserConnectionManager {
  /**
   * 初始化连接
   */
  static async initConnection(tabId: string, sessionInfo: SessionInfo): Promise<void> {
    console.log('[FileBrowser] 开始初始化连接:', { tabId, sessionId: sessionInfo.id });

    try {
      await sftpConnectionManager.createConnection(tabId, sessionInfo);
      console.log('[FileBrowser] SFTP连接创建成功');

      // 加载根目录
      await this.loadDirectory(tabId, '/');
    } catch (error) {
      console.error('[FileBrowser] 初始化连接失败:', error);
      throw error;
    }
  }

  /**
   * 加载目录数据
   */
  static async loadDirectory(tabId: string, path: string): Promise<void> {
    console.log('[FileBrowser] 开始加载目录:', { tabId, path });

    try {
      const files = await sftpConnectionManager.readDirectory(tabId, path);
      console.log('[FileBrowser] 读取到根目录文件:', files);

      // 处理文件列表数据
      const fileList = files;
      const treeData = fileList
        .filter((file: FileEntry) => file.isDirectory)
        //排序文件夹优先,再按名字
        .sort((a: FileEntry, b: FileEntry) => {
          // 如果都是文件夹或都不是文件夹,按名字排序
          if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
          }
          // 文件夹优先
          return a.isDirectory ? -1 : 1;
        })
        .map((dir: FileEntry) => ({
          title: dir.name,
          key: `${path}/${dir.name}`.replace(/\/+/g, '/'),
          isLeaf: false
        }));

      console.log('[FileBrowser] 处理后的数据:', {
        totalFiles: fileList.length,
        directories: treeData.length
      });

      // 获取当前会话ID
      const sessionId = sftpConnectionManager.getSessionId(tabId);
      if (!sessionId) {
        throw new Error('无法获取会话ID');
      }

      // 更新状态
      FileBrowserStateManager.updateTabState(tabId, {
        currentPath: path,
        treeData,
        expandedKeys: [],
        fileList,
        isInitialized: true,
        isConnected: true,
        sessionId,
        history: [path],
        historyIndex: 0
      });

      console.log('[FileBrowser] 状态初始化完成');
    } catch (error) {
      console.error('[FileBrowser] 加载目录失败:', error);
      throw error;
    }
  }
} 