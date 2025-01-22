import React, { useEffect, useState, useCallback } from 'react';
import { Tree, Spin } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'rc-tree/lib/interface';
import { sftpConnectionManager } from '../services/sftpConnectionManager';
import type { SessionInfo } from '../types';
import type { FileEntry } from '../../main/types/file';

interface DirectoryTreeProps {
  sessionInfo: SessionInfo;
  tabId: string;
  onSelect: (path: string) => void;
}

const DirectoryTreeComponent: React.FC<DirectoryTreeProps> = ({ sessionInfo, tabId, onSelect }) => {
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  const [loading, setLoading] = useState(false);

  // 初始化目录树
  const initializeTree = useCallback(async () => {
    console.log(`[DirectoryTree] 组件初始化 - tabId: ${tabId}, sessionId: ${sessionInfo.id}`);
    
    try {
      // 尝试获取缓存的数据
      const cachedPath = sftpConnectionManager.getCurrentPath(tabId);
      const cachedHistory = sftpConnectionManager.getHistory(tabId);
      
      // 如果有缓存的展开路径，使用它们
      if (cachedHistory.length > 0) {
        setExpandedKeys(cachedHistory);
      } else {
        // 否则只展开根目录
        setExpandedKeys(['/']);
      }
      
      // 加载根目录
      await loadDirectory('/');
      
      // 如果有缓存的当前路径，确保它被展开
      if (cachedPath && cachedPath !== '/') {
        await loadDirectory(cachedPath);
      }
    } catch (error) {
      console.error('[DirectoryTree] 初始化失败:', error);
    }
  }, [tabId, sessionInfo.id]);

  // 加载目录内容
  const loadDirectory = useCallback(async (path: string) => {
    console.log(`[DirectoryTree] 加载目录 - tabId: ${tabId}, path: ${path}`);
    setLoading(true);
    
    try {
      // 先检查缓存
      const cachedData = sftpConnectionManager.getTreeCache(tabId, path);
      if (cachedData) {
        console.log(`[DirectoryTree] 使用缓存数据 - tabId: ${tabId}, path: ${path}`);
        updateTreeData(path, cachedData);
        setLoading(false);
        return;
      }

      // 如果没有缓存，从服务器加载
      const entries = await sftpConnectionManager.readDirectory(tabId, path, false);
      console.log(`[DirectoryTree] 目录加载完成 - tabId: ${tabId}, path: ${path}, count: ${entries.length}`);
      
      // 更新目录树数据（只显示目录）
      const directories = entries.filter(entry => entry.isDirectory);
      updateTreeData(path, directories);
    } catch (error) {
      console.error(`[DirectoryTree] 加载目录失败 - path: ${path}`, error);
    } finally {
      setLoading(false);
    }
  }, [tabId]);

  // 更新目录树数据
  const updateTreeData = useCallback((path: string, entries: FileEntry[]) => {
    console.log(`[DirectoryTree] 更新节点数据 - tabId: ${tabId}, key: ${path}`);
    
    const createNode = (entry: FileEntry): DataNode => ({
      key: entry.path,
      title: entry.name,
      isLeaf: false  // 目录永远不是叶子节点
    });

    setTreeData(prevData => {
      if (path === '/') {
        // 根目录直接替换
        return entries.map(createNode);
      } else {
        // 更新指定路径的子节点
        const updateChildren = (nodes: DataNode[]): DataNode[] => {
          return nodes.map(node => {
            if (node.key === path) {
              return {
                ...node,
                children: entries.map(createNode)
              };
            }
            if (node.children) {
              return {
                ...node,
                children: updateChildren(node.children)
              };
            }
            return node;
          });
        };
        return updateChildren(prevData);
      }
    });
  }, [tabId]);

  // 处理展开/折叠节点
  const onExpand = useCallback((keys: Key[]) => {
    console.log(`[DirectoryTree] 展开节点 - tabId: ${tabId}, keys:`, keys);
    setExpandedKeys(keys);
  }, [tabId]);

  // 处理加载数据
  const onLoadData = useCallback(async (node: any) => {
    console.log(`[DirectoryTree] 加载节点数据 - tabId: ${tabId}, key: ${node.key}`);
    if (node.children) {
      return;
    }
    await loadDirectory(node.key);
  }, [loadDirectory, tabId]);

  // 组件挂载时初始化
  useEffect(() => {
    initializeTree();
  }, [initializeTree]);

  return (
    <Spin spinning={loading}>
      <Tree
        className="directory-tree"
        treeData={treeData}
        expandedKeys={expandedKeys}
        onExpand={onExpand}
        loadData={onLoadData}
        onSelect={(_, { node }) => onSelect(node.key as string)}
      />
    </Spin>
  );
};

export default DirectoryTreeComponent; 