import React, { useState, useCallback, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { SessionInfo } from '../../types';
import { Tree, Table, Button, Dropdown, message, Spin, Empty } from 'antd';
import type { MenuProps } from 'antd';
import { 
  ArrowLeftOutlined, 
  ArrowRightOutlined, 
  ReloadOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons';
import DirectoryTreeComponent from './DirectoryTree/DirectoryTreeComponent';
import { sftpConnectionManager } from '../../services/sftpConnectionManager';
import type { FileEntry } from '../../../main/types/file';
import './FileBrowserMain.css';
import type { DataNode } from 'antd/es/tree';
import type { Key } from 'antd/es/table/interface';

interface FileBrowserMainProps {
  /**
   * 当前会话信息
   */
  sessionInfo?: SessionInfo;
  /**
   * 标签页ID
   */
  tabId: string;
}

/**
 * 文件浏览器主组件
 */
const FileBrowserMain: React.FC<FileBrowserMainProps> = ({
  sessionInfo,
  tabId
}) => {
  // 组件状态
  const [currentPathMap, setCurrentPathMap] = useState<Record<string, string>>({});
  const [fileListMap, setFileListMap] = useState<Record<string, FileEntry[]>>({});
  const [historyMap, setHistoryMap] = useState<Record<string, string[]>>({});
  const [historyIndexMap, setHistoryIndexMap] = useState<Record<string, number>>({});
  const [connectedMap, setConnectedMap] = useState<Record<string, boolean>>({});
  const [treeDataMap, setTreeDataMap] = useState<Record<string, DataNode[]>>({});
  const [expandedKeysMap, setExpandedKeysMap] = useState<Record<string, string[]>>({});
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

  // 获取当前标签页的状态
  const currentPath = currentPathMap[tabId] || '/';
  const fileList = fileListMap[tabId] || [];
  const history = historyMap[tabId] || ['/'];
  const historyIndex = historyIndexMap[tabId] || 0;
  const isConnected = connectedMap[tabId] || false;
  const treeData = treeDataMap[tabId] || [];
  const expandedKeys = expandedKeysMap[tabId] || ['/'];
  const loading = loadingMap[tabId] || false;

  // 格式化工具函数
  const formatFileSize = useCallback((size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }, []);

  const formatModifyTime = useCallback((time: number): string => {
    return new Date(time).toLocaleString();
  }, []);

  const formatPermissions = useCallback((mode: number, isDirectory: boolean): string => {
    const permissions = [];
    
    // 文件类型
    permissions.push(isDirectory ? 'd' : '-');
    
    // 所有者权限
    permissions.push((mode & 0b100000000) ? 'r' : '-');
    permissions.push((mode & 0b010000000) ? 'w' : '-');
    permissions.push((mode & 0b001000000) ? 'x' : '-');
    
    // 用户组权限
    permissions.push((mode & 0b000100000) ? 'r' : '-');
    permissions.push((mode & 0b000010000) ? 'w' : '-');
    permissions.push((mode & 0b000001000) ? 'x' : '-');
    
    // 其他用户权限
    permissions.push((mode & 0b000000100) ? 'r' : '-');
    permissions.push((mode & 0b000000010) ? 'w' : '-');
    permissions.push((mode & 0b000000001) ? 'x' : '-');
    
    return permissions.join('');
  }, []);

  // 更新标签页状态的辅助函数
  const updateTabState = useCallback((
    path?: string,
    files?: FileEntry[],
    isLoading?: boolean,
    newHistory?: string[],
    newHistoryIndex?: number,
    connected?: boolean,
    newTreeData?: DataNode[],
    newExpandedKeys?: string[]
  ) => {
    if (path !== undefined) {
      setCurrentPathMap(prev => ({ ...prev, [tabId]: path }));
    }
    if (files !== undefined) {
      setFileListMap(prev => ({ ...prev, [tabId]: files }));
    }
    if (isLoading !== undefined) {
      setLoadingMap(prev => ({ ...prev, [tabId]: isLoading }));
    }
    if (newHistory !== undefined) {
      setHistoryMap(prev => ({ ...prev, [tabId]: newHistory }));
    }
    if (newHistoryIndex !== undefined) {
      setHistoryIndexMap(prev => ({ ...prev, [tabId]: newHistoryIndex }));
    }
    if (connected !== undefined) {
      setConnectedMap(prev => ({ ...prev, [tabId]: connected }));
    }
    if (newTreeData !== undefined) {
      setTreeDataMap(prev => ({ ...prev, [tabId]: newTreeData }));
    }
    if (newExpandedKeys !== undefined) {
      setExpandedKeysMap(prev => ({ ...prev, [tabId]: newExpandedKeys }));
    }
  }, [tabId]);

  // 加载文件列表数据
  const loadFileList = useCallback(async (path: string) => {
    if (!isConnected || !sessionInfo) {
      return;
    }

    const conn = sftpConnectionManager.getConnection(tabId);
    if (!conn) {
      return;
    }

    updateTabState(undefined, undefined, true);
    try {
      const result = await ipcRenderer.invoke('sftp:read-directory', conn.id, path);
      if (!result.success) {
        throw new Error(result.error);
      }
      updateTabState(undefined, result.data, false);
      sftpConnectionManager.updateCurrentPath(tabId, path);
    } catch (error) {
      if (!(error as Error).message.includes('SFTP连接不存在')) {
        message.error('加载文件列表失败: ' + (error as Error).message);
      }
      updateTabState(undefined, [], false);
    }
  }, [tabId, isConnected, sessionInfo, updateTabState]);

  // 处理目录选择
  const handleDirectorySelect = useCallback((path: string) => {
    const newHistory = [...history.slice(0, historyIndex + 1), path];
    updateTabState(
      path,
      undefined,
      undefined,
      newHistory,
      historyIndex + 1
    );
  }, [history, historyIndex, updateTabState]);

  // 处理后退
  const handleBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      updateTabState(
        history[newIndex],
        undefined,
        undefined,
        undefined,
        newIndex
      );
    }
  }, [history, historyIndex, updateTabState]);

  // 处理前进
  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      updateTabState(
        history[newIndex],
        undefined,
        undefined,
        undefined,
        newIndex
      );
    }
  }, [history, historyIndex, updateTabState]);

  // 处理刷新
  const handleRefresh = useCallback(() => {
    loadFileList(currentPath);
  }, [currentPath, loadFileList]);

  // 处理目录树展开
  const handleExpand = useCallback((keys: Key[]) => {
    updateTabState(undefined, undefined, undefined, undefined, undefined, undefined, undefined, keys as string[]);
  }, [updateTabState]);

  // 初始化SFTP连接
  useEffect(() => {
    if (!sessionInfo) {
      return;
    }

    console.log(`[FileBrowser] 组件初始化 - tabId: ${tabId}, sessionId: ${sessionInfo.id}`);
    sftpConnectionManager.debugConnections();

    let mounted = true;

    const initConnection = async () => {
      try {
        // 检查是否已经存在连接
        let conn = sftpConnectionManager.getConnection(tabId);
        if (!conn) {
          console.log(`[FileBrowser] 创建新连接 - tabId: ${tabId}`);
          await sftpConnectionManager.createConnection(sessionInfo, tabId);
        } else {
          console.log(`[FileBrowser] 复用已有连接 - tabId: ${tabId}`);
        }

        if (mounted) {
          // 获取缓存的路径和历史记录
          const cachedPath = sftpConnectionManager.getCurrentPath(tabId);
          const cachedHistory = sftpConnectionManager.getHistory(tabId);

          // 只在第一次初始化时设置状态
          if (!currentPathMap[tabId]) {
            updateTabState(
              cachedPath || '/',
              [],
              false,
              cachedHistory || ['/'],
              cachedHistory ? cachedHistory.length - 1 : 0,
              true
            );
            console.log(`[FileBrowser] 初始化状态 - tabId: ${tabId}, path: ${cachedPath || '/'}`);
          } else {
            console.log(`[FileBrowser] 使用已有状态 - tabId: ${tabId}, path: ${currentPathMap[tabId]}`);
            // 只更新连接状态
            updateTabState(undefined, undefined, undefined, undefined, undefined, true);
          }
          sftpConnectionManager.debugConnections();
        }
      } catch (error) {
        console.error(`[FileBrowser] 连接失败 - tabId: ${tabId}:`, error);
        if (mounted) {
          setTimeout(initConnection, 500);
        }
      }
    };

    initConnection();

    return () => {
      mounted = false;
      console.log(`[FileBrowser] 组件卸载 - tabId: ${tabId}`);
      // 不重置状态，只标记连接状态为 false
      updateTabState(undefined, undefined, undefined, undefined, undefined, false);
    };
  }, [sessionInfo, tabId, updateTabState, currentPathMap]);

  // 监听路径变化，加载文件列表
  useEffect(() => {
    if (isConnected) {
      loadFileList(currentPath);
    }
  }, [currentPath, isConnected, loadFileList]);

  // 渲染未连接状态
  if (!sessionInfo) {
    return (
      <div className="file-browser-main">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="请先选择一个会话连接"
        />
      </div>
    );
  }

  // 右键菜单项
  const contextMenuItems: MenuProps['items'] = [
    {
      key: 'open',
      label: '打开',
    },
    {
      type: 'divider',
    },
    {
      key: 'copy',
      label: '复制',
    },
    {
      key: 'cut',
      label: '剪切',
    },
    {
      key: 'paste',
      label: '粘贴',
    },
    {
      type: 'divider',
    },
    {
      key: 'rename',
      label: '重命名',
    },
    {
      key: 'delete',
      label: '删除',
    },
    {
      type: 'divider',
    },
    {
      key: 'properties',
      label: '属性',
    },
  ];

  // 文件列表列定义
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FileEntry) => (
        <span>
          {record.isDirectory ? <FolderOutlined /> : <FileOutlined />}
          <span style={{ marginLeft: 8 }}>{text}</span>
        </span>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: '类型',
      dataIndex: 'isDirectory',
      key: 'type',
      width: 100,
      render: (isDirectory: boolean) => isDirectory ? '文件夹' : '文件',
    },
    {
      title: '修改时间',
      dataIndex: 'modifyTime',
      key: 'modifyTime',
      width: 150,
      render: (time: number) => formatModifyTime(time),
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 100,
      render: (permissions: number, record: FileEntry) => formatPermissions(permissions, record.isDirectory),
    },
  ];

  // 渲染目录树
  const renderDirectoryTree = () => {
    return (
      <DirectoryTreeComponent
        sessionInfo={sessionInfo}
        tabId={tabId}
        treeData={treeData}
        expandedKeys={expandedKeys}
        loading={loading}
        onExpand={handleExpand}
        onSelect={handleDirectorySelect}
      />
    );
  };

  if (!isConnected) {
    return (
      <div className="file-browser-main">
        <Spin tip="正在连接SFTP服务器..." />
      </div>
    );
  }

  return (
    <div className="file-browser-main">
      {/* 顶部导航 */}
      <div className="file-browser-navbar">
        <div className="nav-controls">
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={handleBack}
            disabled={historyIndex === 0}
          />
          <Button 
            icon={<ArrowRightOutlined />} 
            onClick={handleForward}
            disabled={historyIndex === history.length - 1}
          />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
          />
        </div>
        <div className="nav-path">
          {currentPath}
        </div>
      </div>

      {/* 主内容区 */}
      <div className="file-browser-content">
        {/* 目录树 */}
        <div className="content-tree">
          {renderDirectoryTree()}
        </div>

        {/* 文件列表 */}
        <div className="content-files">
          <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
            <div style={{ height: '100%', overflow: 'auto' }}>
              <Table 
                size="small"
                columns={columns}
                dataSource={fileList}
                loading={loading}
                pagination={false}
                rowKey="path"
                scroll={{ y: 'calc(100vh - 300px)' }}
                rowSelection={{
                  type: 'checkbox',
                  columnWidth: 30,
                  preserveSelectedRowKeys: true
                }}
                onRow={(record) => ({
                  onDoubleClick: () => {
                    if (record.isDirectory) {
                      handleDirectorySelect(record.path);
                    }
                  },
                })}
              />
            </div>
          </Dropdown>
        </div>
      </div>
    </div>
  );
};

export default FileBrowserMain;
