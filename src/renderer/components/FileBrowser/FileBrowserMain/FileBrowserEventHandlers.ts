import { Key } from 'rc-tree/lib/interface';
import { DataNode } from 'antd/es/tree';
import { FileEntry } from '../../../../main/types/file';
import { sftpConnectionManager } from '../../../services/sftpConnectionManager';
import { FileBrowserStateManager } from './FileBrowserStateManager';
import { FileBrowserTabState } from './FileBrowserTypes';
import { addToHistory, type HistoryState } from '../Navigation/History/HistoryStorageService';

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

      let newHistory = [...currentState.history];
      let newHistoryIndex = currentState.historyIndex;

      // 检查是否是后退/前进操作
      const isNavigationAction = currentState.history.includes(path);
      
      if (isNavigationAction) {
        // 如果是后退/前进操作，只更新索引
        newHistoryIndex = currentState.history.indexOf(path);
      } else {
        // 如果是新路径，添加到历史记录
        // 移除当前位置之后的所有记录
        newHistory = currentState.history.slice(0, currentState.historyIndex + 1);
        newHistory.push(path);
        newHistoryIndex = newHistory.length - 1;
      }

      console.log('[FileBrowser] 历史记录更新:', {
        path,
        isNavigationAction,
        oldIndex: currentState.historyIndex,
        newIndex: newHistoryIndex,
        oldHistory: currentState.history,
        newHistory
      });

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
   * @param treeData 新的树数据
   */
  static handleTreeDataUpdate(tabId: string, treeData: DataNode[]): void {
    FileBrowserStateManager.updateTabState(tabId, {
      treeData
    });
  }

  /**
   * 处理文件列表更新事件
   * @param tabId 标签页ID
   * @param fileList 新的文件列表
   */
  static handleFileListChange(tabId: string, fileList: FileEntry[]): void {
    FileBrowserStateManager.updateTabState(tabId, {
      fileList
    });
  }

  /**
   * 强制刷新当前目录（不使用缓存）
   * @param tabId 标签页ID
   * @param path 目录路径
   */
  static async handleRefresh(tabId: string, path: string): Promise<void> {
    console.log('[FileBrowserEventHandlers] 强制刷新目录:', { tabId, path });

    try {
      // 强制从服务器重新读取目录内容
      const files = await sftpConnectionManager.readDirectory(tabId, path, true);
      // 按目录优先，名称排序
      const sortedFiles = [...files].sort((a: FileEntry, b: FileEntry) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });

      // 更新状态，但不修改历史记录
      FileBrowserStateManager.updateTabState(tabId, {
        fileList: sortedFiles
      });

      console.log('[FileBrowserEventHandlers] 目录刷新完成:', { tabId, path, fileCount: sortedFiles.length });
    } catch (error) {
      console.error('[FileBrowserEventHandlers] 刷新目录失败:', error);
      throw error;
    }
  }
}