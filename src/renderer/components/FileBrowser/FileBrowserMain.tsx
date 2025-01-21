import React, { useState, useCallback, useEffect } from 'react';
import { SessionInfo } from '../../types';
import { Tree, Table, Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { 
  ArrowLeftOutlined, 
  ArrowRightOutlined, 
  ReloadOutlined,
  FolderOutlined,
  FileOutlined,
} from '@ant-design/icons';
import DirectoryTreeComponent from './DirectoryTree/DirectoryTreeComponent';
import { sftpService } from '../../services/sftp';
import type { FileEntry } from '../../../main/types/file';
import './FileBrowserMain.css';

interface FileBrowserMainProps {
  /**
   * 当前会话信息
   */
  sessionInfo?: SessionInfo & {
    instanceId?: string;  // 添加instanceId
  };
}

/**
 * 文件浏览器主组件
 */
const FileBrowserMain: React.FC<FileBrowserMainProps> = ({
  sessionInfo
}) => {
  // 当前选中的路径
  const [currentPath, setCurrentPath] = useState('/');
  // 文件列表数据
  const [fileList, setFileList] = useState<FileEntry[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(false);

  // 获取会话ID和Shell ID
  const baseSessionId = sessionInfo?.id || '';
  const shellId = sessionInfo?.instanceId 
    ? `${baseSessionId}-${sessionInfo.instanceId}`
    : baseSessionId;
  
  console.log(`[FileBrowser] 使用会话ID: ${baseSessionId}, Shell ID: ${shellId}`);

  // 加载文件列表数据
  const loadFileList = useCallback(async (path: string) => {
    if (!sessionInfo?.id) return;
    
    console.log(`[FileBrowser] 加载文件列表: ${path}`);
    setLoading(true);
    
    try {
      const entries = await sftpService.readDirectory(baseSessionId, path);
      console.log(`[FileBrowser] 获取到文件列表:`, entries);
      setFileList(entries);
    } catch (error) {
      console.error('[FileBrowser] 加载文件列表失败:', error);
      message.error('加载文件列表失败: ' + (error as Error).message);
      setFileList([]);
    } finally {
      setLoading(false);
    }
  }, [sessionInfo?.id, baseSessionId]);

  // 监听路径变化
  useEffect(() => {
    if (currentPath && sessionInfo?.id) {
      loadFileList(currentPath);
    }
  }, [currentPath, loadFileList, sessionInfo?.id]);

  // 处理目录选择
  const handleDirectorySelect = useCallback((path: string) => {
    setCurrentPath(path);
  }, []);

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

  if (!sessionInfo) {
    return null;
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

  return (
    <div className="file-browser-main">
      {/* 顶部导航 */}
      <div className="file-browser-navbar">
        <div className="nav-controls">
          <Button icon={<ArrowLeftOutlined />} />
          <Button icon={<ArrowRightOutlined />} />
          <Button icon={<ReloadOutlined />} />
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
            sessionId={baseSessionId}
            shellId={shellId}
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
              />
            </div>
          </Dropdown>
        </div>
      </div>

      {/* 状态栏 */}
      <div className="file-browser-statusbar">
        <div className="status-left">{fileList.length} 个项目</div>
        <div className="status-right">
          {sessionInfo.username}@{sessionInfo.host}
        </div>
      </div>
    </div>
  );
};

export default FileBrowserMain;
