import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Table, Spin, message } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import dayjs from 'dayjs';
import { getUserName, getGroupName } from '../../../utils';
import type { FileEntry } from '../../../../main/types/file';
import type { SessionInfo } from '../../../types';
import { FileListContextMenu } from './components/ContextMenu/FileListContextMenu';
import { CreateDialog } from './components/ContextMenu/CreateDialog';
import { createAction } from './components/ContextMenu/actions/createAction';
import { PermissionDialog } from './components/Permission/PermissionDialog';
import { permissionAction, type PermissionOptions } from './components/ContextMenu/actions/permissionAction';
import DownloadDialog, { type DownloadConfig } from '../../Download/DownloadDialog';
import { UploadDialog } from '../../Upload';
import { downloadService } from '../../../services/downloadService';
import { uploadService } from '../../../services/uploadService';
import { eventBus } from '../../../services/eventBus';
import { sftpConnectionManager } from '../../../services/sftpConnectionManager';
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
  onRefresh?: () => void;  // 新增：刷新回调
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
  onDirectorySelect,
  onRefresh
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

  // 创建对话框状态
  const [createDialogVisible, setCreateDialogVisible] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');

  // 权限设置对话框状态
  const [permissionDialogVisible, setPermissionDialogVisible] = useState(false);
  const [permissionFiles, setPermissionFiles] = useState<FileEntry[]>([]);

  // 高亮显示新上传的文件
  const [highlightedFiles, setHighlightedFiles] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<any>(null);

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

  // 监听文件上传完成事件
  useEffect(() => {
    const handleFileUploaded = async (data: {
      tabId: string;
      fileName: string;
      filePath: string;
      remotePath: string;
      currentPath: string;
      fileSize: number;
      overwrite: boolean;
    }) => {
      console.log('[FileList] 收到文件上传完成事件:', data);

      // 只处理当前标签页和当前路径的上传事件
      if (data.tabId !== tabId || data.currentPath !== currentPath) {
        console.log('[FileList] 忽略其他标签页或路径的上传事件');
        return;
      }

      try {
        // 获取新上传文件的详细信息
        await updateFileListWithNewFile(data.fileName, data.overwrite);
      } catch (error) {
        console.error('[FileList] 处理上传完成事件失败:', error);
      }
    };

    eventBus.on('file-uploaded', handleFileUploaded);

    return () => {
      eventBus.off('file-uploaded', handleFileUploaded);
    };
  }, [tabId, currentPath]);

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
      // 上传逻辑由 UploadDialog 内部处理，这里只关闭对话框
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

  // 上传对话框关闭处理（不触发取消逻辑）
  const handleUploadDialogClose = () => {
    console.log('FileList: 上传对话框关闭');
    setUploadDialogVisible(false);
  };

  // 创建请求处理函数
  const handleCreateRequest = useCallback((type: 'file' | 'folder') => {
    console.log('FileList: 收到创建请求', type);
    setCreateType(type);
    setCreateDialogVisible(true);
  }, []);

  // 创建确认处理
  const handleCreateConfirm = async (name: string) => {
    if (!sessionInfo) {
      console.error('FileList: 缺少会话信息');
      return;
    }

    try {
      console.log('FileList: 创建确认', { type: createType, name, currentPath });

      const result = await createAction[createType === 'folder' ? 'createFolder' : 'createFile']({
        name,
        currentPath,
        sessionInfo,
        type: createType
      });

      if (result.success) {
        console.log('FileList: 创建成功');
        setCreateDialogVisible(false);

        // 使用与上传功能相同的逻辑更新文件列表
        await updateFileListWithNewFile(name, false);
      } else {
        console.error('FileList: 创建失败:', result.message);
        // 不关闭对话框，让用户可以修改后重试
      }
    } catch (error) {
      console.error('FileList: 创建操作异常:', error);
    }
  };

  // 创建取消处理
  const handleCreateCancel = () => {
    console.log('FileList: 创建取消');
    setCreateDialogVisible(false);
  };

  // 权限设置请求处理函数
  const handlePermissionRequest = useCallback((files: FileEntry[]) => {
    console.log('FileList: 收到权限设置请求', files.map(f => f.name));
    setPermissionFiles(files);
    setPermissionDialogVisible(true);
  }, []);

  // 权限设置确认处理
  const handlePermissionConfirm = async (options: PermissionOptions) => {
    if (!sessionInfo) {
      console.error('FileList: 缺少会话信息');
      return;
    }

    try {
      console.log('FileList: 权限设置确认', options);

      const result = await permissionAction.setPermissions(options);

      if (result.success) {
        console.log('FileList: 权限设置成功');
        message.success(result.message);
        setPermissionDialogVisible(false);

        // 刷新文件列表
        onRefresh?.();
      } else {
        console.error('FileList: 权限设置失败:', result.message);
        message.error(result.message);
        // 不关闭对话框，让用户可以修改后重试
      }
    } catch (error) {
      console.error('FileList: 权限设置操作异常:', error);
      message.error('权限设置失败');
    }
  };

  // 权限设置取消处理
  const handlePermissionCancel = () => {
    console.log('FileList: 权限设置取消');
    setPermissionDialogVisible(false);
  };

  // 修改处理右键菜单的函数
  const handleContextMenu = useCallback((event: React.MouseEvent, file: FileEntry) => {
    console.log('[FileList] 右键菜单被触发:', file.name);
    event.preventDefault();

    // 获取选中的文件
    const selectedFiles = fileList.filter(f => selectedRowKeys.includes(f.name));
    console.log('[FileList] 选中的文件:', selectedFiles.map(f => f.name));

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      file,
      selectedFiles: selectedFiles.length > 0 ? selectedFiles : [file]
    });
    console.log('[FileList] 右键菜单状态已设置');
  }, [selectedRowKeys, fileList]);

  // 处理关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 智能更新文件列表，添加新上传的文件
  const updateFileListWithNewFile = async (fileName: string, overwrite: boolean) => {
    try {
      console.log('[FileList] 开始更新文件列表，新文件:', fileName);

      // 从服务器获取新文件的详细信息
      const files = await sftpConnectionManager.readDirectory(tabId, currentPath, true);
      const newFile = files.find(f => f.name === fileName);

      if (!newFile) {
        console.warn('[FileList] 未找到新上传的文件:', fileName);
        return;
      }

      console.log('[FileList] 找到新文件信息:', newFile);

      // 检查文件是否已存在（覆盖情况）
      const existingIndex = fileList.findIndex(f => f.name === fileName);
      let updatedFileList: FileEntry[];

      if (existingIndex !== -1) {
        // 文件已存在，更新现有文件信息
        console.log('[FileList] 更新现有文件:', fileName);
        updatedFileList = [...fileList];
        updatedFileList[existingIndex] = newFile;
      } else {
        // 新文件，按排序规则插入到正确位置
        console.log('[FileList] 插入新文件:', fileName);
        updatedFileList = insertFileInSortedOrder([...fileList], newFile);
      }

      // 更新文件列表
      onFileListChange(updatedFileList);

      // 高亮显示新文件
      highlightFile(fileName);

      // 滚动到新文件位置
      setTimeout(() => {
        scrollToFile(fileName, updatedFileList);
      }, 100);

    } catch (error) {
      console.error('[FileList] 更新文件列表失败:', error);
    }
  };

  // 按当前排序规则插入文件到正确位置
  const insertFileInSortedOrder = (currentList: FileEntry[], newFile: FileEntry): FileEntry[] => {
    const { columnKey, order } = sortedInfo;

    // 如果没有排序，使用默认排序（目录优先，然后按名称）
    if (!columnKey || !order) {
      // 默认排序：目录优先，名称升序
      const insertIndex = currentList.findIndex(file => {
        if (newFile.isDirectory !== file.isDirectory) {
          return !newFile.isDirectory; // 目录排在前面
        }
        return newFile.name.localeCompare(file.name) < 0;
      });

      if (insertIndex === -1) {
        return [...currentList, newFile];
      } else {
        return [
          ...currentList.slice(0, insertIndex),
          newFile,
          ...currentList.slice(insertIndex)
        ];
      }
    }

    // 根据当前排序规则插入
    const insertIndex = currentList.findIndex(file => {
      let comparison = 0;

      switch (columnKey) {
        case 'name':
          // 目录优先排序
          if (newFile.isDirectory !== file.isDirectory) {
            comparison = newFile.isDirectory ? -1 : 1;
          } else {
            comparison = newFile.name.localeCompare(file.name);
          }
          break;
        case 'size':
          comparison = newFile.size - file.size;
          break;
        case 'modifyTime':
          comparison = newFile.modifyTime - file.modifyTime;
          break;
        default:
          comparison = newFile.name.localeCompare(file.name);
      }

      return order === 'ascend' ? comparison < 0 : comparison > 0;
    });

    if (insertIndex === -1) {
      return [...currentList, newFile];
    } else {
      return [
        ...currentList.slice(0, insertIndex),
        newFile,
        ...currentList.slice(insertIndex)
      ];
    }
  };

  // 高亮显示文件
  const highlightFile = (fileName: string) => {
    setHighlightedFiles(prev => new Set([...prev, fileName]));

    // 3秒后移除高亮
    setTimeout(() => {
      setHighlightedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
    }, 3000);
  };

  // 滚动到指定文件
  const scrollToFile = (fileName: string, fileListToUse: FileEntry[]) => {
    const index = fileListToUse.findIndex(file => file.name === fileName);
    if (index !== -1 && tableRef.current) {
      console.log('[FileList] 滚动到文件:', fileName, '索引:', index);

      // 计算滚动位置（每行大约32px高度）
      const rowHeight = 32;
      const scrollTop = index * rowHeight;

      // 获取表格的滚动容器
      const tableBody = containerRef.current?.querySelector('.ant-table-body');
      if (tableBody) {
        tableBody.scrollTop = scrollTop;
        console.log('[FileList] 已滚动到位置:', scrollTop);
      }
    }
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
        <span className={`file-list-name-cell ${highlightedFiles.has(record.name) ? 'file-list-highlighted' : ''}`}>
          <span className="file-list-icon">{getFileIcon(record)}</span>
          <span className="file-list-name">{text}</span>
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
        ref={tableRef}
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
          className: highlightedFiles.has(record.name) ? 'file-list-row-highlighted' : '',
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
          onFileDeleted={onRefresh}
          onCreateRequest={handleCreateRequest}  // 传递创建请求回调
          onPermissionRequest={handlePermissionRequest}  // 传递权限设置请求回调
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
          onCancel={handleUploadDialogClose}
        />
      )}

      {/* 创建文件/文件夹对话框 */}
      <CreateDialog
        visible={createDialogVisible}
        type={createType}
        currentPath={currentPath}
        onConfirm={handleCreateConfirm}
        onCancel={handleCreateCancel}
      />

      {/* 权限设置对话框 */}
      {sessionInfo && (
        <PermissionDialog
          visible={permissionDialogVisible}
          files={permissionFiles}
          sessionInfo={sessionInfo}
          currentPath={currentPath}
          onConfirm={handlePermissionConfirm}
          onCancel={handlePermissionCancel}
        />
      )}
    </div>
  );
};

export default FileList; 