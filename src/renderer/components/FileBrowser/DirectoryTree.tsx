import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Tree, Spin } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'rc-tree/lib/interface';
import debounce from 'lodash/debounce';
import { sftpConnectionManager } from '../../services/sftpConnectionManager';
import { eventBus } from '../../services/eventBus';
import type { SessionInfo } from '../../types';
import type { FileEntry } from '../../../main/types/file';

interface DirectoryTreeProps {
  sessionInfo: SessionInfo;
  tabId: string;
  treeData: DataNode[];
  expandedKeys: string[];
  loading: boolean;
  onExpand: (keys: Key[]) => void;
  onSelect: (path: string) => void;
  onTreeDataUpdate?: (newTreeData: DataNode[]) => void;
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
}) => {
  const loadedKeysRef = useRef<Set<string>>(new Set());
  const lastUpdateTimeRef = useRef<number>(0);
  const [isConnected, setIsConnected] = useState(false);

  const loadData = useCallback(async (node: any) => {
    if (!isConnected) {
      console.log('[DirectoryTree] 等待SFTP连接建立...');
      return;
    }

    const now = Date.now();
    // 如果距离上次更新不足500ms，则跳过
    if (now - lastUpdateTimeRef.current < 500) {
      return;
    }
    lastUpdateTimeRef.current = now;

    const path = node.key as string;
    console.log('[DirectoryTree] 开始加载目录:', { path, node });

    try {
      const files = await sftpConnectionManager.readDirectory(tabId, path);
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
      if (path === '/') {
        // 如果是根目录，直接更新整个树数据
        onTreeDataUpdate?.(children);
      } else {
        // 如果是子目录，递归更新树数据
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
      }

      // 确保当前路径保持展开状态
      const newExpandedKeys = Array.from(new Set([...expandedKeys, path]));
      onExpand(newExpandedKeys);
      
      return children;
    } catch (error: any) {
      console.error('[DirectoryTree] 加载目录失败:', error);
      if (error?.message?.includes('SFTP连接不存在')) {
        setIsConnected(false);
      }
    }
  }, [tabId, expandedKeys, onExpand, isConnected, onTreeDataUpdate, treeData]);

  // 监听连接状态
  useEffect(() => {
    const checkConnection = () => {
      const connection = sftpConnectionManager.getConnection(tabId);
      const newConnected = !!connection;
      if (newConnected !== isConnected) {
        setIsConnected(newConnected);
        if (newConnected && treeData.length === 0) {
          console.log('[DirectoryTree] 尝试加载根目录');
          // 直接加载根目录
          sftpConnectionManager.readDirectory(tabId, '/').then(files => {
            console.log('[DirectoryTree] 读取到根目录文件:', files);
            // 只保留目录并按名称排序
            const rootDirs = files
              .filter((entry: FileEntry) => entry.isDirectory)
              .sort((a: FileEntry, b: FileEntry) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
              .map((dir: FileEntry) => ({
                title: dir.name,
                key: `/${dir.name}`.replace(/\/+/g, '/'),
                isLeaf: false,
              }));
            console.log('[DirectoryTree] 生成的树节点:', rootDirs);
            onTreeDataUpdate?.(rootDirs);
          }).catch(error => {
            console.error('[DirectoryTree] 加载根目录失败:', error);
          });
        }
      }
    };

    // 初始检查
    checkConnection();

    // 监听标签页变化事件
    const handleTabChange = (data: { tabId: string }) => {
      if (data.tabId === tabId) {
        console.log('[DirectoryTree] 收到标签页变化事件');
        checkConnection();
      }
    };

    eventBus.on('tab-change', handleTabChange);
    
    // 定期检查连接状态
    const timer = setInterval(checkConnection, 1000);

    return () => {
      eventBus.off('tab-change', handleTabChange);
      clearInterval(timer);
    };
  }, [tabId, isConnected, treeData, onTreeDataUpdate]);

  useEffect(() => {
    console.log('[DirectoryTree] 树数据更新:', { 
      treeDataLength: treeData.length,
      expandedKeys,
      isConnected
    });
  }, [treeData, expandedKeys, isConnected]);

  // 使用防抖包装的展开处理函数
  const handleExpand = useCallback(
    debounce((keys: Key[]) => {
      if (isConnected) {
        console.log('[DirectoryTree] 展开节点:', keys);
        onExpand(keys);
      }
    }, 300, { leading: true, trailing: true }),
    [onExpand, isConnected]
  );

  // 使用防抖包装的选择处理函数
  const handleSelect = useCallback(
    debounce((_: any, { node }: any) => {
      if (isConnected) {
        console.log('[DirectoryTree] 选择节点:', node.key);
        onSelect(node.key);
      }
    }, 300, { leading: true, trailing: true }),
    [onSelect, isConnected]
  );

  if (loading) {
    return <Spin />;
  }

  return (
    <Tree
      className="directory-tree"
      treeData={treeData}
      expandedKeys={expandedKeys}
      selectedKeys={[]}
      loadData={loadData}
      onExpand={handleExpand}
      onSelect={handleSelect}
      blockNode
    />
  );
};

export default DirectoryTree; 