import React, { useEffect, useState, useCallback } from 'react';
import { Tree, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { sftpService } from '../../../services/sftp';
import { sshService } from '../../../services/ssh';
import type { FileEntry } from '../../../../main/types/file';
import './DirectoryTree.css';

interface DirectoryTreeProps {
  sessionId: string;
  onSelect?: (path: string) => void;
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
  sessionId,
  onSelect
}) => {
  // 目录树数据
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(false);

  // 加载目录数据
  const loadDirectoryData = useCallback(async (path: string = '/') => {
    console.log(`[DirectoryTree] 开始加载目录: ${path}`);
    try {
      setLoading(true);

      // 等待SSH连接建立
      let retryCount = 0;
      while (retryCount < 3) {
        try {
          const entries = await sftpService.readDirectory(sessionId, path);
          console.log(`[DirectoryTree] 获取到目录数据:`, entries);
          
          // 过滤并排序目录
          const directories = entries
            .filter((entry: FileEntry) => entry.isDirectory)
            .sort((a: FileEntry, b: FileEntry) => a.name.localeCompare(b.name));
          
          console.log(`[DirectoryTree] 过滤出 ${directories.length} 个目录`);
          // 转换为树节点
          const nodes = directories.map(convertToTreeNode);
          
          if (path === '/') {
            // 根目录直接设置
            console.log(`[DirectoryTree] 设置根目录数据`);
            setTreeData(nodes);
          } else {
            // 更新指定节点的子节点
            console.log(`[DirectoryTree] 更新节点 ${path} 的子节点`);
            setTreeData(prev => updateTreeData(prev, path, nodes));
          }
          break;
        } catch (error) {
          console.log(`[DirectoryTree] 尝试 ${retryCount + 1}/3 失败:`, error);
          if (retryCount === 2) {
            throw error;
          }
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('[DirectoryTree] 加载目录失败:', error);
      message.error('加载目录失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // 更新树节点数据
  const updateTreeData = (list: DataNode[], key: string, children: DataNode[]): DataNode[] => {
    return list.map(node => {
      if (node.key === key) {
        return {
          ...node,
          children
        };
      }
      if (node.children) {
        return {
          ...node,
          children: updateTreeData(node.children, key, children)
        };
      }
      return node;
    });
  };

  // 处理展开/折叠
  const onExpand = useCallback(async (expandedKeys: React.Key[], info: any) => {
    console.log(`[DirectoryTree] 展开/折叠事件:`, {
      expanded: info.expanded,
      node: info.node
    });

    if (info.expanded) {
      // 展开节点时加载数据
      await loadDirectoryData(info.node.key as string);
    }
  }, [loadDirectoryData]);

  // 处理选择
  const handleSelect = useCallback((selectedKeys: React.Key[], info: any) => {
    console.log(`[DirectoryTree] 选择节点:`, {
      selectedKeys,
      node: info.node
    });

    if (selectedKeys.length > 0) {
      onSelect?.(selectedKeys[0] as string);
    }
  }, [onSelect]);

  // 初始加载根目录
  useEffect(() => {
    console.log(`[DirectoryTree] sessionId变化: ${sessionId}`);
    if (sessionId) {
      loadDirectoryData();
    }
  }, [sessionId, loadDirectoryData]);

  return (
    <div className="directory-tree">
      <Tree
        className="directory-tree-content"
        showLine
        showIcon
        treeData={treeData}
        onExpand={onExpand}
        onSelect={handleSelect}
      />
      {loading && <div className="directory-tree-loading">加载中...</div>}
    </div>
  );
};

export default DirectoryTreeComponent; 