import React, { useEffect, useCallback, useState, useRef } from 'react';
import { Table, Spin, message } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import debounce from 'lodash/debounce';
import dayjs from 'dayjs';
import { sftpConnectionManager } from '../../services/sftpConnectionManager';
import { eventBus } from '../../services/eventBus';
import { getUserName, getGroupName } from '../../utils';
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

// 将权限数字转换为字符串表示
const formatPermissions = (permissions: number): string => {
  const type = (permissions & 0o170000) === 0o040000 ? 'd' : '-';
  const user = ((permissions & 0o400) ? 'r' : '-') +
               ((permissions & 0o200) ? 'w' : '-') +
               ((permissions & 0o100) ? 'x' : '-');
  const group = ((permissions & 0o040) ? 'r' : '-') +
                ((permissions & 0o020) ? 'w' : '-') +
                ((permissions & 0o010) ? 'x' : '-');
  const other = ((permissions & 0o004) ? 'r' : '-') +
                ((permissions & 0o002) ? 'w' : '-') +
                ((permissions & 0o001) ? 'x' : '-');
  return `${type}${user}${group}${other}`;
};

// 格式化文件大小
const formatFileSize = (size: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let index = 0;
  let fileSize = size;

  while (fileSize >= 1024 && index < units.length - 1) {
    fileSize /= 1024;
    index++;
  }

  return `${fileSize.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

const FileList: React.FC<FileListProps> = ({
  sessionInfo,
  tabId,
  currentPath,
  fileList,
  loading,
  onFileListChange,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [sortedInfo, setSortedInfo] = useState<SorterResult<FileEntry>>({});
  const [tableHeight, setTableHeight] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听容器高度变化
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        // 减去表头高度(38px)和一些边距
        setTableHeight(height - 38);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // 使用 debounce 防止频繁读取目录
  const loadDirectory = useCallback(
    debounce(async () => {
      if (!sessionInfo || !currentPath || loading || !isConnected) {
        return;
      }

      try {
        const files = await sftpConnectionManager.readAllFiles(tabId, currentPath);
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

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<FileEntry> | SorterResult<FileEntry>[]
  ) => {
    setSortedInfo(Array.isArray(sorter) ? sorter[0] || {} : sorter);
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: FileEntry, b: FileEntry) => {
        // 目录优先排序
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      },
      sortOrder: sortedInfo.columnKey === 'name' ? sortedInfo.order : null,
      render: (text: string, record: FileEntry) => (
        <span>
          <span className="file-icon">{record.isDirectory ? '📁' : '📄'}</span>
          {text}
        </span>
      ),
      width: '35%',
      ellipsis: true,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      sorter: (a: FileEntry, b: FileEntry) => a.size - b.size,
      sortOrder: sortedInfo.columnKey === 'size' ? sortedInfo.order : null,
      render: (size: number, record: FileEntry) => 
        record.isDirectory ? '-' : formatFileSize(size),
      width: 100,
    },
    {
      title: '类型',
      key: 'type',
      render: (_: unknown, record: FileEntry) => 
        record.isDirectory ? '文件夹' : '文件',
      width: 80,
    },
    {
      title: '修改时间',
      dataIndex: 'modifyTime',
      key: 'modifyTime',
      sorter: (a: FileEntry, b: FileEntry) => a.modifyTime - b.modifyTime,
      sortOrder: sortedInfo.columnKey === 'modifyTime' ? sortedInfo.order : null,
      render: (time: number) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      width: 150,
    },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (permissions: number) => formatPermissions(permissions),
      width: 100,
    },
    {
      title: '用户/组',
      key: 'ownership',
      render: (_: unknown, record: FileEntry) => {
        const owner = record.owner !== undefined ? getUserName(record.owner) : '-';
        const group = record.group !== undefined ? getGroupName(record.group) : '-';
        return `${owner}/${group}`;
      },
      width: 120,
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
    <div className="file-list-container" ref={containerRef}>
      <Table
        dataSource={fileList}
        columns={columns}
        rowKey="name"
        pagination={false}
        size="small"
        onChange={handleTableChange}
        scroll={{ x: 'max-content', y: tableHeight }}
        sticky
      />
    </div>
  );
};

export default FileList; 