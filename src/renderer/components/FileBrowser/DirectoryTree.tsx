import React, { useCallback, useRef } from 'react';
import { Tree, Spin } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'rc-tree/lib/interface';
import debounce from 'lodash/debounce';
import { sftpConnectionManager } from '../../services/sftpConnectionManager';
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
}

const DirectoryTree: React.FC<DirectoryTreeProps> = ({
  sessionInfo,
  tabId,
  treeData,
  expandedKeys,
  loading,
  onExpand,
  onSelect,
}) => {
  const loadedKeysRef = useRef<Set<string>>(new Set());
  const lastUpdateTimeRef = useRef<number>(0);

  const loadData = useCallback(async (node: any) => {
    const now = Date.now();
    // 如果距离上次更新不足500ms，则跳过
    if (now - lastUpdateTimeRef.current < 500) {
      return;
    }
    lastUpdateTimeRef.current = now;

    const path = node.key as string;
    if (loadedKeysRef.current.has(path)) {
      return;
    }

    try {
      const files = await sftpConnectionManager.readDirectory(tabId, path);
      const children = files
        .filter((file: FileEntry) => file.isDirectory)
        .map((file: FileEntry) => ({
          title: file.name,
          key: `${path}/${file.name}`.replace(/\/+/g, '/'),
          isLeaf: false,
        }));

      node.children = children;
      loadedKeysRef.current.add(path);
      
      // 强制更新树节点
      onExpand([...expandedKeys]);
    } catch (error) {
      console.error('[DirectoryTree] 加载目录失败:', error);
    }
  }, [tabId, expandedKeys, onExpand]);

  // 使用防抖包装的展开处理函数
  const handleExpand = useCallback(
    debounce((keys: Key[]) => {
      onExpand(keys);
    }, 300, { leading: true, trailing: true }),
    [onExpand]
  );

  // 使用防抖包装的选择处理函数
  const handleSelect = useCallback(
    debounce((_: any, { node }: any) => {
      onSelect(node.key);
    }, 300, { leading: true, trailing: true }),
    [onSelect]
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