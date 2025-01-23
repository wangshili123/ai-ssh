import { Key } from 'rc-tree/lib/interface';
import { DataNode } from 'antd/es/tree';
import { FileEntry } from '../../../../main/types/file';
import { sftpConnectionManager } from '../../../services/sftpConnectionManager';
import { FileBrowserStateManager } from './FileBrowserStateManager';
import { FileBrowserTabState } from './FileBrowserTypes';

/**
 * 文件浏览器事件处理类
 */
export class FileBrowserEventHandlers {
  /**
   * 处理目录树展开事件
   * @param tabId 标签页ID
   * @param expandedKeys 展开的节点key列表
   * @returns 更新后的状态
   */
  static handleExpand(tabId: string, expandedKeys: Key[]): FileBrowserTabState | undefined {
    console.log('[FileBrowserEventHandlers] 处理展开/收起:', { tabId, expandedKeys });
    
    FileBrowserStateManager.updateTabState(tabId, {
      expandedKeys: expandedKeys as string[]
    });

    // 返回更新后的状态
    return FileBrowserStateManager.getTabState(tabId);
  }

  /**
   * 处理目录选择事件
   * @param tabId 标签页ID
   * @param path 选中的路径
   */
  static async handleSelect(tabId: string, path: string): Promise<void> {
    try {
      const currentState = FileBrowserStateManager.getTabState(tabId);
      if (!currentState) return;

      // 更新历史记录
      const newHistory = [...currentState.history.slice(0, currentState.historyIndex + 1), path];
      const newHistoryIndex = newHistory.length - 1;

      const files = await sftpConnectionManager.readDirectory(tabId, path);
      // 按目录优先，名称排序
      const sortedFiles = [...files].sort((a: FileEntry, b: FileEntry) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });

      FileBrowserStateManager.updateTabState(tabId, {
        currentPath: path,
        fileList: sortedFiles,
        history: newHistory,
        historyIndex: newHistoryIndex
      });
    } catch (error) {
      console.error('[FileBrowser] 读取目录失败:', error);
    }
  }

  /**
   * 处理树数据更新事件
   * @param tabId 标签页ID
   * @param newTreeData 新的树数据
   */
  static handleTreeDataUpdate(tabId: string, newTreeData: DataNode[]): void {
    FileBrowserStateManager.updateTabState(tabId, {
      treeData: newTreeData
    });
  }

  /**
   * 处理文件列表变化事件
   * @param tabId 标签页ID
   * @param newFileList 新的文件列表
   */
  static handleFileListChange(tabId: string, newFileList: FileEntry[]): void {
    FileBrowserStateManager.updateTabState(tabId, {
      fileList: newFileList
    });
  }
} 