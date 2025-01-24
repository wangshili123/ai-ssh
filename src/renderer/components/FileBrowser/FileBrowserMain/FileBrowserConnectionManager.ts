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
      
      // 构建目录树数据
      const directories = fileList
        .filter((file: FileEntry) => file.isDirectory)
        .sort((a: FileEntry, b: FileEntry) => a.name.localeCompare(b.name))
        .map((dir: FileEntry) => ({
          title: dir.name,
          key: `${path === '/' ? '' : path}/${dir.name}`.replace(/\/+/g, '/'),
          isLeaf: false
        }));

      // 创建根节点
      const treeData: DataNode[] = [{
        title: '/',
        key: '/',
        children: directories,
        isLeaf: false
      }];

      console.log('[FileBrowser] 处理后的数据:', {
        totalFiles: fileList.length,
        directories: directories.length,
        treeData
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
        expandedKeys: ['/'],  // 默认展开根节点
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