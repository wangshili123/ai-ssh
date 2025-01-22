import React, { useEffect, useCallback } from 'react';
import { Table, Spin, message } from 'antd';
import debounce from 'lodash/debounce';
import { sftpConnectionManager } from '../../services/sftpConnectionManager';
import type { FileEntry } from '../../../main/types/file';
import type { SessionInfo } from '../../types';
import './FileList.css';

interface FileListProps {
  sessionInfo?: SessionInfo;
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
  onFileListChange,
}) => {
  // 使用 debounce 防止频繁读取目录
  const loadDirectory = useCallback(
    debounce(async () => {
      if (!sessionInfo || !currentPath || loading) {
        return;
      }

      try {
        const files = await sftpConnectionManager.readDirectory(tabId, currentPath);
        onFileListChange(files);
      } catch (error: any) {
        console.error('[FileList] 读取目录失败:', error);
        // 只在连接不存在时显示错误提示
        if (error?.message?.includes('SFTP连接不存在')) {
          return;
        }
        message.error(`读取目录失败: ${error?.message || '未知错误'}`);
      }
    }, 300),
    [sessionInfo, tabId, currentPath, loading, onFileListChange]
  );

  useEffect(() => {
    loadDirectory();
    return () => {
      loadDirectory.cancel();
    };
  }, [loadDirectory, currentPath]);

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: FileEntry) => (
        <span>
          {record.isDirectory ? '📁 ' : '📄 '}
          {text}
        </span>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => {
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
        if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(2)} MB`;
        return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
      },
    },
    {
      title: '修改时间',
      dataIndex: 'modifyTime',
      key: 'modifyTime',
      render: (time: number) => new Date(time).toLocaleString(),
    },
  ];

  if (loading) {
    return (
      <div className="file-list-loading">
        <Spin tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="file-list-container">
      <Table
        dataSource={fileList}
        columns={columns}
        rowKey="name"
        pagination={false}
        size="small"
      />
    </div>
  );
};

export default FileList; 