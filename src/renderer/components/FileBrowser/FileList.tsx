import React, { useEffect, useCallback, useState } from 'react';
import { Table, Spin, message } from 'antd';
import debounce from 'lodash/debounce';
import { sftpConnectionManager } from '../../services/sftpConnectionManager';
import { eventBus } from '../../services/eventBus';
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
  const [isConnected, setIsConnected] = useState(false);

  // 使用 debounce 防止频繁读取目录
  const loadDirectory = useCallback(
    debounce(async () => {
      if (!sessionInfo || !currentPath || loading || !isConnected) {
        return;
      }

      try {
        const files = await sftpConnectionManager.readDirectory(tabId, currentPath);
        onFileListChange(files);
      } catch (error: any) {
        console.error('[FileList] 读取目录失败:', error);
        // 只在连接不存在时显示错误提示
        if (error?.message?.includes('SFTP连接不存在')) {
          setIsConnected(false);
          return;
        }
        message.error(`读取目录失败: ${error?.message || '未知错误'}`);
      }
    }, 300),
    [sessionInfo, tabId, currentPath, loading, onFileListChange, isConnected]
  );

  // 监听连接状态
  useEffect(() => {
    const checkConnection = () => {
      const connection = sftpConnectionManager.getConnection(tabId);
      const newConnected = !!connection;
      if (newConnected !== isConnected) {
        setIsConnected(newConnected);
        if (newConnected) {
          console.log('[FileList] SFTP连接已建立，开始加载目录');
          loadDirectory();
        }
      }
    };

    // 初始检查
    checkConnection();

    // 监听标签页变化事件
    const handleTabChange = (data: { tabId: string }) => {
      if (data.tabId === tabId) {
        checkConnection();
      }
    };

    eventBus.on('tab-change', handleTabChange);
    
    // 定期检查连接状态
    const timer = setInterval(checkConnection, 1000);

    return () => {
      eventBus.off('tab-change', handleTabChange);
      clearInterval(timer);
      loadDirectory.cancel();
    };
  }, [tabId, isConnected, loadDirectory]);

  // 监听路径变化
  useEffect(() => {
    if (isConnected) {
      loadDirectory();
    }
  }, [currentPath, isConnected, loadDirectory]);

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