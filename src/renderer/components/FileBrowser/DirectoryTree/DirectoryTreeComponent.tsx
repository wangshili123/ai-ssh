import React, { useCallback } from 'react';
import { Tree, Spin, message, Empty } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'antd/es/table/interface';
import { FolderOutlined } from '@ant-design/icons';
import { sftpConnectionManager } from '../../../services/sftpConnectionManager';
import { ipcRenderer } from 'electron';
import type { FileEntry } from '../../../../main/types/file';
import type { SessionInfo } from '../../../types';
import './DirectoryTree.css';

interface DirectoryTreeProps {
  /**
   * 会话信息
   */
  sessionInfo?: SessionInfo;
  /**
   * 标签页ID
   */
  tabId: string;
  /**
   * 树形数据
   */
  treeData: DataNode[];
  /**
   * 展开的节点
   */
  expandedKeys: string[];
  /**
   * 加载状态
   */
  loading: boolean;
  /**
   * 展开/收起回调
   */
  onExpand: (keys: Key[]) => void;
  /**
   * 选择目录的回调
   */
  onSelect: (path: string) => void;
}

/**
 * 目录树组件
 */
const DirectoryTreeComponent: React.FC<DirectoryTreeProps> = ({
  sessionInfo,
  tabId,
  treeData,
  expandedKeys,
  loading,
  onExpand,
  onSelect
}) => {
  // 加载目录内容
  const loadDirectories = useCallback(async (path: string): Promise<DataNode[]> => {
    console.log(`[DirectoryTree] 加载目录 - tabId: ${tabId}, path: ${path}`);
    const conn = sftpConnectionManager.getConnection(tabId);
    if (!conn) {
      console.log(`[DirectoryTree] 未找到连接 - tabId: ${tabId}`);
      return [];
    }

    const result = await ipcRenderer.invoke('sftp:read-directory', conn.id, path);
    if (!result.success) {
      throw new Error(result.error);
    }

    // 只返回目录
    const directories = result.data
      .filter((entry: FileEntry) => entry.isDirectory)
      .map((dir: FileEntry) => ({
        title: dir.name,
        key: dir.path,
        icon: <FolderOutlined />,
        isLeaf: false,
      }));

    console.log(`[DirectoryTree] 目录加载完成 - tabId: ${tabId}, path: ${path}, count: ${directories.length}`);
    return directories;
  }, [tabId]);

  // 处理加载数据
  const onLoadData = useCallback(async (node: DataNode) => {
    const { key, children } = node;
    if (children) {
      return;
    }

    console.log(`[DirectoryTree] 加载节点数据 - tabId: ${tabId}, key: ${key}`);
    try {
      const newNodes = await loadDirectories(key as string);
      const updated = updateTreeData(treeData, key as string, newNodes);
      onExpand([...expandedKeys, key as string]);
    } catch (error) {
      console.error(`[DirectoryTree] 加载节点失败 - tabId: ${tabId}, key: ${key}:`, error);
      message.error('加载目录失败: ' + (error as Error).message);
    }
  }, [loadDirectories, tabId, treeData, expandedKeys, onExpand]);

  // 更新树数据的辅助函数
  const updateTreeData = (list: DataNode[], key: string, children: DataNode[]): DataNode[] => {
    return list.map(node => {
      if (node.key === key) {
        return {
          ...node,
          children,
        };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeData(node.children, key, children),
        };
      }
      return node;
    });
  };

  // 处理选择
  const handleSelect = useCallback((_: Key[], { node }: { node: DataNode }) => {
    console.log(`[DirectoryTree] 选择节点 - tabId: ${tabId}, key: ${node.key}`);
    onSelect(node.key as string);
  }, [onSelect, tabId]);

  // 渲染未连接状态
  if (!sessionInfo) {
    return (
      <div className="directory-tree">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="请先选择一个会话连接"
        />
      </div>
    );
  }

  return (
    <Spin spinning={loading} tip="加载中...">
      <Tree
        className="directory-tree"
        showIcon
        showLine
        loadData={onLoadData}
        treeData={treeData}
        expandedKeys={expandedKeys}
        onExpand={onExpand}
        onSelect={handleSelect}
      />
    </Spin>
  );
};

export default DirectoryTreeComponent; 