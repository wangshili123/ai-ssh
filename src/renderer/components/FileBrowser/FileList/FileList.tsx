import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Table, Spin } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import { getUserName, getGroupName } from '../../../utils';
import type { FileEntry } from '../../../../main/types/file';
import type { SessionInfo } from '../../../types';
import { FileListContextMenu } from './components/ContextMenu/FileListContextMenu';
import DownloadDialog, { type DownloadConfig } from '../../Download/DownloadDialog';
import { UploadDialog } from '../../Upload';
import { downloadService } from '../../../services/downloadService';
import { uploadService } from '../../../services/uploadService';
import { getDefaultDownloadPath } from '../../../utils/downloadUtils';
import { fileOpenManager } from './core/FileOpenManager';
import './FileList.css';

interface FileListProps {
  sessionInfo?: SessionInfo;
  tabId: string;
  currentPath: string;
  fileList: FileEntry[];
  loading: boolean;
  onFileListChange: (files: FileEntry[]) => void;
  onDirectorySelect?: (path: string) => void;
}

// 将权限数字转换为字符串表示
const formatPermissions = (permissions: number): string => {
  // 将权限转换为 4 位八进制字符串
  const modeStr = permissions.toString(8).padStart(5, '0');

  // 文件类型映射
  const fileType: { [key: string]: string } = {
    '0': '-', // 普通文件
    '1': 'p', // 命名管道
    '2': 'c', // 字符设备
    '4': 'd', // 目录
    '6': 'b', // 块设备
    '10': '-', // 普通文件
    '12': 'l', // 符号链接
    '14': 's'  // 套接字
  };

  // 权限位映射
  const permissionBits: { [key: string]: string } = {
    '0': '---',
    '1': '--x',
    '2': '-w-',
    '3': '-wx',
    '4': 'r--',
    '5': 'r-x',
    '6': 'rw-',
    '7': 'rwx'
  };

  // 解析文件类型
  const type = fileType[modeStr[0]] || '-';

  // 解析所有者、组和其他用户的权限
  const owner = permissionBits[modeStr[2]] || '---';
  const group = permissionBits[modeStr[3]] || '---';
  const others = permissionBits[modeStr[4]] || '---';

  // 组合成完整的权限字符串
  return `${type}${owner}${group}${others}`;
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

// 获取文件图标
const getFileIcon = (file: FileEntry): string => {
  if (file.isDirectory) {
    return '📁';
  }

  // 根据文件扩展名返回对应图标
  const iconMap: { [key: string]: string } = {
    // 文本文件
    'txt': '📄',
    'log': '📋',
    'md': '📝',
    // 代码文件
    'js': '📜',
    'ts': '📜',
    'jsx': '📜',
    'tsx': '📜',
    'json': '📜',
    'html': '📜',
    'css': '📜',
    'less': '📜',
    'scss': '📜',
    // 图片文件
    'jpg': '🖼️',
    'jpeg': '🖼️',
    'png': '🖼️',
    'gif': '🖼️',
    'svg': '🖼️',
    // 压缩文件
    'zip': '📦',
    'rar': '📦',
    'tar': '📦',
    'gz': '📦',
    // 可执行文件
    'exe': '⚙️',
    'sh': '⚙️',
    'bat': '⚙️',
    // 配置文件
    'conf': '⚙️',
    'config': '⚙️',
    'yml': '⚙️',
    'yaml': '⚙️',
    'env': '⚙️',
  };

  return iconMap[file.extension] || '📄';
};

// 修改右键菜单状态的类型定义
type MenuItem = {
  key: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children?: (MenuItem | MenuDivider)[];
};

type MenuDivider = {
  type: 'divider';
};

const FileList: React.FC<FileListProps> = ({
  sessionInfo,
  tabId,
  currentPath,
  fileList,
  loading,
  onFileListChange,
  onDirectorySelect
}) => {
  const [sortedInfo, setSortedInfo] = useState<SorterResult<FileEntry>>({});
  const [tableHeight, setTableHeight] = useState<number>(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [downloadDialogVisible, setDownloadDialogVisible] = useState(false);
  const [downloadFile, setDownloadFile] = useState<FileEntry | null>(null);
  const [downloadFiles, setDownloadFiles] = useState<FileEntry[]>([]);

  // 上传对话框状态
  const [uploadDialogVisible, setUploadDialogVisible] = useState(false);
  const [uploadPath, setUploadPath] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);

  // 修改右键菜单状态的类型定义
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileEntry;
    selectedFiles?: FileEntry[];
  } | null>(null);

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

  // 处理双击事件
  const handleRowDoubleClick = async (record: FileEntry) => {
    if (record.isDirectory) {
      // 如果是目录，进入该目录
      const newPath = `${currentPath === '/' ? '' : currentPath}/${record.name}`.replace(/\/+/g, '/');
      console.log('[FileList] 双击目录:', { name: record.name, newPath });
      onDirectorySelect?.(newPath);
    } else {
      // 如果是文件，使用默认方式打开
      await fileOpenManager.openFile(record, sessionInfo!, tabId);
    }
  };

  const handleTableChange = (
    _pagination: TablePaginationConfig,
    _filters: Record<string, FilterValue | null>,
    sorter: SorterResult<FileEntry> | SorterResult<FileEntry>[]
  ) => {
    setSortedInfo(Array.isArray(sorter) ? sorter[0] || {} : sorter);
  };

  // 下载处理函数
  const handleDownloadRequest = useCallback((file: FileEntry, selectedFiles: FileEntry[]) => {
    console.log('FileList: 收到下载请求', file.name, selectedFiles.length);
    setDownloadFile(file);
    setDownloadFiles(selectedFiles);
    setDownloadDialogVisible(true);
  }, []);

  // 下载确认处理
  const handleDownloadConfirm = async (config: DownloadConfig) => {
    console.log('FileList: 下载确认', config);
    try {
      if (!sessionInfo) {
        console.error('没有会话信息');
        return;
      }

      const downloadableFiles = downloadFiles.filter(f => !f.isDirectory);
      const configWithSession = {
        ...config,
        sessionId: tabId
      };

      if (downloadableFiles.length === 1) {
        // 单个文件下载
        await downloadService.startDownload(downloadableFiles[0], configWithSession);
      } else if (downloadableFiles.length > 1) {
        // 批量下载
        for (const file of downloadableFiles) {
          const fileConfig = {
            ...configWithSession,
            fileName: file.name
          };
          await downloadService.startDownload(file, fileConfig);
        }
      }

      setDownloadDialogVisible(false);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  // 下载取消处理
  const handleDownloadCancel = () => {
    console.log('FileList: 下载取消');
    setDownloadDialogVisible(false);
  };

  // 上传处理函数
  const handleUploadRequest = useCallback((targetPath: string) => {
    console.log('FileList: 收到上传请求', targetPath);
    setUploadPath(targetPath);
    setUploadDialogVisible(true);
  }, []);

  // 上传确认处理
  const handleUploadConfirm = async (config: any) => {
    console.log('FileList: 上传确认', config);
    try {
      // 上传逻辑由 UploadDialog 内部处理
      setUploadDialogVisible(false);
      // 刷新文件列表 - 传递当前文件列表，实际的刷新逻辑由父组件处理
      onFileListChange?.(fileList);
    } catch (error) {
      console.error('上传失败:', error);
    }
  };

  // 上传取消处理
  const handleUploadCancel = () => {
    console.log('FileList: 上传取消');
    setUploadDialogVisible(false);
  };

  // 修改处理右键菜单的函数
  const handleContextMenu = useCallback((event: React.MouseEvent, file: FileEntry) => {
    event.preventDefault();

    // 获取选中的文件
    const selectedFiles = fileList.filter(f => selectedRowKeys.includes(f.name));

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      file,
      selectedFiles: selectedFiles.length > 0 ? selectedFiles : [file]
    });
  }, [selectedRowKeys, fileList]);

  // 处理关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

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
        <span className="file-name-cell">
          <span className="file-icon">{getFileIcon(record)}</span>
          <span className="file-name">{text}</span>
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

  // 行选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: FileEntry) => ({
      disabled: false,
      name: record.name,
    }),
  };

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
        showSorterTooltip={false}
        rowSelection={rowSelection}
        onRow={(record) => ({
          onDoubleClick: () => handleRowDoubleClick(record),
          onContextMenu: (e) => handleContextMenu(e, record),
        })}
      />

      {contextMenu && (
        <FileListContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          selectedFiles={contextMenu.selectedFiles}
          sessionInfo={sessionInfo}
          tabId={tabId}
          currentPath={currentPath}
          onClose={handleCloseContextMenu}
          onDownloadRequest={handleDownloadRequest}
          onUploadRequest={handleUploadRequest}
        />
      )}

      {/* 下载对话框 */}
      {sessionInfo && downloadFile && (
        <DownloadDialog
          visible={downloadDialogVisible}
          file={downloadFile}
          files={downloadFiles}
          sessionInfo={sessionInfo}
          defaultSavePath={getDefaultDownloadPath()}
          onConfirm={handleDownloadConfirm}
          onCancel={handleDownloadCancel}
        />
      )}

      {/* 上传对话框 */}
      {sessionInfo && (
        <UploadDialog
          visible={uploadDialogVisible}
          defaultRemotePath={uploadPath}
          sessionInfo={{
            id: tabId,
            host: sessionInfo.host,
            username: sessionInfo.username
          }}
          onConfirm={handleUploadConfirm}
          onCancel={handleUploadCancel}
        />
      )}
    </div>
  );
};

export default FileList; 