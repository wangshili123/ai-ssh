import React, { useCallback, useState } from 'react';
import { Tree, Spin } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'rc-tree/lib/interface';
import { sftpConnectionManager } from '../../../services/sftpConnectionManager';
import type { SessionInfo } from '../../../types';
import type { FileEntry } from '../../../../main/types/file';
import './DirectoryTree.css';

interface DirectoryTreeProps {
  sessionInfo: SessionInfo;
  tabId: string;
  treeData: DataNode[];
  expandedKeys: string[];
  loading: boolean;
  onExpand: (keys: Key[]) => void;
  onSelect: (path: string) => void;
  onTreeDataUpdate?: (newTreeData: DataNode[]) => void;
  currentPath?: string;
}

const DirectoryTree: React.FC<DirectoryTreeProps> = ({
  sessionInfo,
  tabId,
  treeData,
  expandedKeys,
  loading,
  onExpand,
  onSelect,
  onTreeDataUpdate,
  currentPath,
}) => {
  const loadData = useCallback(async (node: any) => {
    const path = node.key as string;
    console.log('[DirectoryTree] 开始加载目录:', { path, node });

    try {
      const files: FileEntry[] = await sftpConnectionManager.readDirectory(tabId, path);
      console.log('[DirectoryTree] 读取到文件列表:', files);

      // 只保留目录并按名称排序
      const children = files
        .filter((entry: FileEntry) => entry.isDirectory)
        .sort((a: FileEntry, b: FileEntry) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map((dir: FileEntry) => ({
          title: dir.name,
          key: `${path === '/' ? '' : path}/${dir.name}`.replace(/\/+/g, '/'),
          isLeaf: false,
        }));

      console.log('[DirectoryTree] 处理后的目录列表:', children);

      // 更新树数据
      const updateTreeData = (data: DataNode[]): DataNode[] => {
        return data.map(item => {
          if (item.key === path) {
            return {
              ...item,
              children,
            };
          }
          if (item.children) {
            return {
              ...item,
              children: updateTreeData(item.children),
            };
          }
          return item;
        });
      };
      
      const newTreeData = updateTreeData(treeData);
      console.log('[DirectoryTree] 更新后的树数据:', newTreeData);
      onTreeDataUpdate?.(newTreeData);

      return children;
    } catch (error: unknown) {
      console.error('[DirectoryTree] 加载目录失败:', error);
    }
  }, [tabId, onTreeDataUpdate, treeData]);

  if (loading) {
    return <Spin />;
  }

  return (
    <Tree
      className="directory-tree"
      treeData={treeData}
      expandedKeys={expandedKeys}
      selectedKeys={currentPath ? [currentPath] : []}
      loadData={loadData}
      onExpand={onExpand}
      onSelect={(_, { node }) => onSelect(node.key as string)}
      blockNode
    />
  );
};

export default DirectoryTree; 