import React, { useEffect } from 'react';
import { Table, Spin } from 'antd';
import { FolderOutlined, FileOutlined } from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import { sftpConnectionManager } from '../../../services/sftpConnectionManager';
import type { FileEntry } from '../../../../main/types/file';
import type { SessionInfo } from '../../../types';

interface FileListProps {
  sessionInfo: SessionInfo;
  tabId: string;
  currentPath: string;
  fileList: FileEntry[];
  loading: boolean;
  onFileListChange: (files: FileEntry[]) => void;
}

const FileList: React.FC<FileListProps> = ({
  sessionInfo,
  tabId,
  currentPath,
  fileList,
  loading,
  onFileListChange
}) => {
  // 格式化工具函数
  const formatFileSize = (size: number): string => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatModifyTime = (time: number): string => {
    return new Date(time).toLocaleString();
  };

  const formatPermissions = (mode: number, isDirectory: boolean): string => {
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
  };

  // 加载文件列表
  useEffect(() => {
    if (loading) {
      return;
    }

    const loadFileList = async () => {
      const conn = sftpConnectionManager.getConnection(tabId);
      if (!conn) {
        return;
      }

      try {
        const result = await ipcRenderer.invoke('sftp:read-directory', conn.id, currentPath);
        if (!result.success) {
          throw new Error(result.error);
        }
        onFileListChange(result.data);
      } catch (error) {
        console.error(`[FileList] 加载文件列表失败 - tabId: ${tabId}, path: ${currentPath}:`, error);
      }
    };

    loadFileList();
  }, [tabId, currentPath, onFileListChange, loading]);

  // 表格列定义
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
    <Spin spinning={loading}>
      <Table
        className="file-list"
        columns={columns}
        dataSource={fileList}
        rowKey="path"
        pagination={false}
        size="middle"
      />
    </Spin>
  );
};

export default FileList; 