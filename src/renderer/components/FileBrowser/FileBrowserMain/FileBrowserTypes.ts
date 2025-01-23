import type { DataNode } from 'antd/es/tree';
import type { SessionInfo } from '../../../types';
import type { FileEntry } from '../../../../main/types/file';

// 文件浏览器主组件的Props类型
export interface FileBrowserMainProps {
  sessionInfo?: SessionInfo;
  tabId: string;
}

// SFTP连接错误类型定义
export interface SFTPConnectionError extends Error {
  code?: string;
  message: string;
}

// 文件浏览器标签页状态类型
export interface FileBrowserTabState {
  currentPath: string;
  treeData: DataNode[];
  expandedKeys: string[];
  fileList: FileEntry[];
  isInitialized: boolean;
  isConnected: boolean;
  sessionId: string;
  // 导航历史相关字段
  history: string[];
  historyIndex: number;
}

// 导出其他需要的类型
export type { DataNode, SessionInfo, FileEntry }; 