import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  // 用于防止重复加载
  const loadingRef = useRef(false);
  // 记录当前的sessionId
  const sessionIdRef = useRef<string>();

  // 加载目录数据
  const loadDirectoryData = useCallback(async (path: string = '/') => {
    // 如果正在加载，或者sessionId变化了，就不执行
    if (loadingRef.current || sessionId !== sessionIdRef.current) {
      console.log(`[DirectoryTree] 跳过加载: 正在加载=${loadingRef.current}, sessionId变化=${sessionId !== sessionIdRef.current}`);
      return;
    }

    console.log(`[DirectoryTree] 开始加载目录: ${path}`);
    try {
      setLoading(true);
      loadingRef.current = true;

      const entries = await sftpService.readDirectory(sessionId, path);
      console.log(`[DirectoryTree] 获取到目录数据:`, entries);
      
      console.log(`[DirectoryTree] 开始过滤目录，原始条目:`, entries.map(e => ({
        name: e.name,
        isDirectory: e.isDirectory,
        path: e.path,
        size: e.size,
        modifyTime: e.modifyTime,
        permissions: e.permissions
      })));
      
      const directories = entries
        .filter((entry: FileEntry) => {
          const isDir = entry.isDirectory;
          console.log(`[DirectoryTree] 检查条目 ${entry.name}: isDirectory=${isDir}, size=${entry.size}, permissions=${entry.permissions}`);
          return isDir;
        })
        .sort((a: FileEntry, b: FileEntry) => a.name.localeCompare(b.name));
      
      console.log(`[DirectoryTree] 过滤后的目录:`, directories.map(d => d.name));
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
    } catch (error) {
      console.error('[DirectoryTree] 加载目录失败:', error);
      message.error('加载目录失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
      loadingRef.current = false;
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
      sessionIdRef.current = sessionId;
      loadDirectoryData();
    }
    
    // 清理函数
    return () => {
      sessionIdRef.current = undefined;
    };
  }, [sessionId]);

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