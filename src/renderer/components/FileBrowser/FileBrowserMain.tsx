import React, { useState, useCallback, useEffect } from 'react';
import { ipcRenderer } from 'electron';
import { SessionInfo } from '../../types';
import { Tree, Table, Button, Dropdown, message, Spin } from 'antd';
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

interface FileBrowserMainProps {
  /**
   * 当前会话信息
   */
  sessionInfo: SessionInfo;
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
  // 当前选中的路径
  const [currentPath, setCurrentPath] = useState('/');
  // 文件列表数据
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(false);
  // 历史记录
  const [history, setHistory] = useState<string[]>(['/']);
  // 当前历史位置
  const [historyIndex, setHistoryIndex] = useState(0);
  // 连接状态
  const [isConnected, setIsConnected] = useState(false);

  // 初始化SFTP连接
  useEffect(() => {
    let mounted = true;

    const initConnection = async () => {
      try {
        await sftpConnectionManager.createConnection(sessionInfo, tabId);
        if (mounted) {
          setIsConnected(true);
        }
      } catch (error) {
        // 连接失败时不显示错误，继续尝试
        if (mounted) {
          setTimeout(initConnection, 500);
        }
      }
    };

    initConnection();

    // 清理函数
    return () => {
      mounted = false;
      sftpConnectionManager.closeConnection(tabId);
      setIsConnected(false);
    };
  }, [sessionInfo, tabId]);

  // 加载文件列表数据
  const loadFileList = useCallback(async (path: string) => {
    if (!isConnected) {
      return;
    }

    const conn = sftpConnectionManager.getConnection(tabId);
    if (!conn) {
      return;
    }

    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('sftp:read-directory', conn.id, path);
      if (!result.success) {
        throw new Error(result.error);
      }
      setFileList(result.data);
      sftpConnectionManager.updateCurrentPath(tabId, path);
    } catch (error) {
      // 只在非连接相关错误时显示错误消息
      if (!(error as Error).message.includes('SFTP连接不存在')) {
        message.error('加载文件列表失败: ' + (error as Error).message);
      }
      setFileList([]);
    } finally {
      setLoading(false);
    }
  }, [tabId, isConnected]);

  // 监听路径变化
  useEffect(() => {
    if (currentPath) {
      loadFileList(currentPath);
    }
  }, [currentPath, loadFileList]);

  // 处理目录选择
  const handleDirectorySelect = useCallback((path: string) => {
    setCurrentPath(path);
    // 添加到历史记录
    setHistory(prev => [...prev.slice(0, historyIndex + 1), path]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // 处理后退
  const handleBack = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setCurrentPath(history[historyIndex - 1]);
    }
  }, [history, historyIndex]);

  // 处理前进
  const handleForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setCurrentPath(history[historyIndex + 1]);
    }
  }, [history, historyIndex]);

  // 处理刷新
  const handleRefresh = useCallback(() => {
    loadFileList(currentPath);
  }, [currentPath, loadFileList]);

  // 格式化文件大小
  const formatFileSize = useCallback((size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }, []);

  // 格式化修改时间
  const formatModifyTime = useCallback((time: number): string => {
    return new Date(time).toLocaleString();
  }, []);

  // 格式化权限
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
          <DirectoryTreeComponent
            sessionInfo={sessionInfo}
            tabId={tabId}
            onSelect={handleDirectorySelect}
          />
        </div>

        {/* 文件列表 */}
        <div className="content-files">
          <Dropdown menu={{ items: contextMenuItems }} trigger={['contextMenu']}>
            <div style={{ height: '100%' }}>
              <Table 
                size="small"
                columns={columns}
                dataSource={fileList}
                loading={loading}
                pagination={false}
                rowKey="path"
                rowSelection={{
                  type: 'checkbox',
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
