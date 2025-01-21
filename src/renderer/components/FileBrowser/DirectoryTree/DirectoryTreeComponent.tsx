import React, { useState, useCallback, useEffect } from 'react';
import { Tree, Spin, message } from 'antd';
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
  sessionInfo: SessionInfo;
  /**
   * 标签页ID
   */
  tabId: string;
  /**
   * 选择目录的回调
   */
  onSelect: (path: string) => void;
}

/**
 * 将FileEntry转换为Tree节点
 */
function convertToTreeNode(entry: FileEntry): DataNode {
  return {
    key: entry.path,
    title: entry.name,
    isLeaf: !entry.isDirectory,
  };
}

/**
 * 目录树组件
 */
const DirectoryTreeComponent: React.FC<DirectoryTreeProps> = ({
  sessionInfo,
  tabId,
  onSelect
}) => {
  // 目录树数据
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(false);
  // 展开的节点
  const [expandedKeys, setExpandedKeys] = useState<Key[]>([]);
  // 连接状态
  const [isConnected, setIsConnected] = useState(false);

  // 加载目录内容
  const loadDirectories = useCallback(async (path: string): Promise<DataNode[]> => {
    const conn = sftpConnectionManager.getConnection(tabId);
    if (!conn) {
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

    return directories;
  }, [tabId]);

  // 监听连接状态
  useEffect(() => {
    let mounted = true;
    const checkConnection = async () => {
      while (mounted && !isConnected) {
        const conn = sftpConnectionManager.getConnection(tabId);
        if (conn) {
          setIsConnected(true);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };

    checkConnection();
    return () => {
      mounted = false;
    };
  }, [tabId, isConnected]);

  // 初始化根目录
  useEffect(() => {
    if (!isConnected) {
      return;
    }

    const initRoot = async () => {
      setLoading(true);
      try {
        const rootNodes = await loadDirectories('/');
        setTreeData([{
          title: '/',
          key: '/',
          icon: <FolderOutlined />,
          children: rootNodes,
        }]);
        setExpandedKeys(['/']);
      } catch (error) {
        console.error('加载根目录失败:', error);
        message.error('加载目录失败: ' + (error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    initRoot();
  }, [loadDirectories, isConnected]);

  // 处理展开/收起
  const onExpand = useCallback((keys: Key[]) => {
    setExpandedKeys(keys);
  }, []);

  // 处理加载数据
  const onLoadData = useCallback(async (node: DataNode) => {
    const { key, children } = node;
    if (children) {
      return;
    }

    try {
      const newNodes = await loadDirectories(key as string);
      setTreeData(prev => updateTreeData(prev, key as string, newNodes));
    } catch (error) {
      console.error('加载目录失败:', error);
      message.error('加载目录失败: ' + (error as Error).message);
    }
  }, [loadDirectories]);

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
    onSelect(node.key as string);
  }, [onSelect]);

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