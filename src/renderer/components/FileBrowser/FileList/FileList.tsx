import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Table, Spin, message } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import type { FilterValue, SorterResult } from 'antd/es/table/interface';
import type { FileEntry } from '../../../../main/types/file';
import type { SessionInfo } from '../../../types';
import { FileListContextMenu } from './components/ContextMenu/FileListContextMenu';
import { CreateDialog } from './components/ContextMenu/CreateDialog';
import { createAction } from './components/ContextMenu/actions/createAction';
import { PermissionDialog } from './components/Permission/PermissionDialog';
import { permissionAction, type PermissionOptions } from './components/ContextMenu/actions/permissionAction';
import {
  EditorConfigDialog,
  EditorSelectorDialog,
  externalEditorManager,
  unifiedEditorConfig
} from '../ExternalEditor';
import { fileOpenManager } from './core/FileOpenManager';
import DownloadDialog, { type DownloadConfig } from '../../Download/DownloadDialog';
import { UploadDialog } from '../../Upload';
import { downloadService } from '../../../services/downloadService';
import { eventBus } from '../../../services/eventBus';
import { getDefaultDownloadPath } from '../../../utils/downloadUtils';
import { clipboardManager } from '../../../services/ClipboardManager';
import { fileOperationService } from '../../../services/FileOperationService';
import CopyPasteProgressDialog from './components/CopyPasteProgressDialog';
import MinimizedProgressIndicator from './components/MinimizedProgressIndicator';
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

import { formatPermissions, formatFileSize, getFileIcon } from './utils/fileFormatters';
import { useFileListColumns } from './hooks/useFileListColumns';
import { useDialogStates } from './hooks/useDialogStates';
import { useFileOperations } from './hooks/useFileOperations';
import { ResizableTitle } from './components/ResizableTitle';



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
  const [tableHeight, setTableHeight] = useState<number>(400); // 设置默认高度
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 列宽状态管理
  const [columnWidths, setColumnWidths] = useState({
    name: 280,      // 文件名列
    size: 100,      // 大小列
    type: 80,       // 类型列
    modifyTime: 150, // 修改时间列
    permissions: 100, // 权限列
    ownership: 120   // 用户/组列
  });

  // 高亮显示新上传的文件
  const [highlightedFiles, setHighlightedFiles] = useState<Set<string>>(new Set());

  // 正在打开的文件状态
  const [openingFiles, setOpeningFiles] = useState<Set<string>>(new Set());

  // 复制粘贴进度状态
  const [copyPasteProgress, setCopyPasteProgress] = useState<{
    visible: boolean;
    minimized: boolean;
    operation: 'copy' | 'cut';
    currentFile: string;
    totalFiles: number;
    currentIndex: number;
    progress: number;
  }>({
    visible: false,
    minimized: false,
    operation: 'copy',
    currentFile: '',
    totalFiles: 0,
    currentIndex: 0,
    progress: 0
  });

  // 使用对话框状态管理hook
  const dialogStates = useDialogStates();

  // 使用文件操作hook
  const fileOperations = useFileOperations({
    tabId,
    currentPath,
    fileList,
    onFileListChange,
    sortedInfo
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<any>(null);

  // 修改右键菜单状态的类型定义
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileEntry;
    selectedFiles?: FileEntry[];
  } | null>(null);

  // 监听容器高度变化，确保表格占满整个容器
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        // 设置表格高度为容器完整高度减去表头高度
        const calculatedHeight = Math.max(height - 26, 200); // 最小高度200px，表头高度26px
        setTableHeight(calculatedHeight);
        console.log('[FileList] 容器高度变化:', { containerHeight: height, tableHeight: calculatedHeight });
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
        await fileOperations.updateFileListWithNewFile(data.fileName, data.overwrite);

        // 高亮显示新文件
        highlightFile(data.fileName);

        // 滚动到新文件位置
        setTimeout(() => {
          scrollToFile(data.fileName, fileList);
        }, 100);
      } catch (error) {
        console.error('[FileList] 处理上传完成事件失败:', error);
      }
    };

    eventBus.on('file-uploaded', handleFileUploaded);

    return () => {
      eventBus.off('file-uploaded', handleFileUploaded);
    };
  }, [tabId, currentPath]);

  // 强制更新表格列宽 - 使用正确的宽度值
  useEffect(() => {
    console.log('[FileList] 列宽状态更新:', columnWidths);

    const updateColumnWidths = () => {
      if (!containerRef.current) return;

      const table = containerRef.current.querySelector('.ant-table-content table');
      if (!table) return;

      const widths = Object.values(columnWidths);

      const updateCells = (cells: NodeListOf<Element>) => {
        cells.forEach((cell: any, index) => {
          if (widths[index]) {
            const width = `${widths[index]}px`;
            cell.style.width = width;
            cell.style.minWidth = width;
            cell.style.maxWidth = width;
          }
        });
      };

      const headerCells = table.querySelectorAll('.ant-table-thead th');
      updateCells(headerCells);

      const visibleRows = table.querySelectorAll('.ant-table-tbody tr');
      visibleRows.forEach((row: any) => {
        const cells = row.querySelectorAll('td');
        updateCells(cells);
      });
    };

    requestAnimationFrame(updateColumnWidths);
  }, [columnWidths]);

  // 处理双击事件
  const handleRowDoubleClick = async (record: FileEntry) => {
    if (record.isDirectory) {
      // 如果是目录，进入该目录
      const newPath = `${currentPath === '/' ? '' : currentPath}/${record.name}`.replace(/\/+/g, '/');
      console.log('[FileList] 双击目录:', { name: record.name, newPath });
      onDirectorySelect?.(newPath);
    } else {
      // 防止重复点击
      if (openingFiles.has(record.path)) {
        console.log('[FileList] 文件正在打开中，忽略重复点击:', record.name);
        return;
      }

      // 如果是文件，根据用户偏好选择打开方式
      if (!sessionInfo) {
        message.error('缺少会话信息');
        return;
      }

      // 添加到正在打开的文件列表
      setOpeningFiles(prev => new Set(prev).add(record.path));

      // 显示loading提示
      const loadingMessage = message.loading(`正在打开文件 ${record.name}...`, 0);

      try {
        const preferredEditor = await unifiedEditorConfig.getDefaultOpenMode();
        console.log(`[FileList] 双击文件: ${record.name}, 全局偏好编辑器: ${preferredEditor}`);

        if (preferredEditor === 'external') {
          // 使用外部编辑器打开
          const editors = await unifiedEditorConfig.getEditors();
          if (editors.length === 0) {
            message.warning('请先配置外部编辑器');
            dialogStates.setEditorConfigVisible(true);
            return;
          }

          // 设置编辑器选择回调
          externalEditorManager.setEditorSelectorCallback(async (file) => {
            return new Promise(async (resolve) => {
              // 获取可用的编辑器列表
              const editorList = await unifiedEditorConfig.getEditors();
              dialogStates.setAvailableEditors(editorList);
              dialogStates.setEditorSelectorFile(file);
              dialogStates.setEditorSelectorVisible(true);

              // 临时存储resolve函数
              (window as any).__editorSelectorResolve = resolve;
            });
          });

          // 打开文件
          await externalEditorManager.openFileWithExternalEditor(
            record,
            sessionInfo,
            tabId
          );
        } else {
          // 使用内置编辑器打开
          await fileOpenManager.openFile(record, sessionInfo, tabId);
        }
      } catch (error) {
        console.error('[FileList] 打开文件失败:', error);
        message.error(`打开文件失败: ${(error as Error).message}`);
      } finally {
        // 关闭loading提示
        loadingMessage();

        // 从正在打开的文件列表中移除
        setOpeningFiles(prev => {
          const newSet = new Set(prev);
          newSet.delete(record.path);
          return newSet;
        });
      }
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
    dialogStates.setDownloadFile(file);
    dialogStates.setDownloadFiles(selectedFiles);
    dialogStates.setDownloadDialogVisible(true);
  }, [dialogStates]);

  // 下载确认处理
  const handleDownloadConfirm = async (config: DownloadConfig) => {
    console.log('FileList: 下载确认', config);
    try {
      if (!sessionInfo) {
        console.error('没有会话信息');
        return;
      }

      const downloadableFiles = dialogStates.downloadFiles.filter(f => !f.isDirectory);
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

      dialogStates.setDownloadDialogVisible(false);
    } catch (error) {
      console.error('下载失败:', error);
    }
  };

  // 下载取消处理
  const handleDownloadCancel = () => {
    console.log('FileList: 下载取消');
    dialogStates.setDownloadDialogVisible(false);
  };

  // 上传处理函数
  const handleUploadRequest = useCallback((targetPath: string) => {
    console.log('FileList: 收到上传请求', targetPath);
    dialogStates.setUploadPath(targetPath);
    dialogStates.setUploadDialogVisible(true);
  }, [dialogStates]);

  // 上传确认处理
  const handleUploadConfirm = async (config: any) => {
    console.log('FileList: 上传确认', config);
    try {
      // 上传逻辑由 UploadDialog 内部处理，这里只关闭对话框
      dialogStates.setUploadDialogVisible(false);
      // 刷新文件列表 - 传递当前文件列表，实际的刷新逻辑由父组件处理
      onFileListChange?.(fileList);
    } catch (error) {
      console.error('上传失败:', error);
    }
  };

  // 上传对话框关闭处理（不触发取消逻辑）
  const handleUploadDialogClose = () => {
    console.log('FileList: 上传对话框关闭');
    dialogStates.setUploadDialogVisible(false);
  };

  // 创建请求处理函数
  const handleCreateRequest = useCallback((type: 'file' | 'folder') => {
    console.log('FileList: 收到创建请求', type);
    dialogStates.setCreateType(type);
    dialogStates.setCreateDialogVisible(true);
  }, [dialogStates]);

  // 创建确认处理
  const handleCreateConfirm = async (name: string) => {
    if (!sessionInfo) {
      console.error('FileList: 缺少会话信息');
      return;
    }

    try {
      console.log('FileList: 创建确认', { type: dialogStates.createType, name, currentPath });

      const result = await createAction[dialogStates.createType === 'folder' ? 'createFolder' : 'createFile']({
        name,
        currentPath,
        sessionInfo,
        type: dialogStates.createType
      });

      if (result.success) {
        console.log('FileList: 创建成功');
        dialogStates.setCreateDialogVisible(false);

        // 使用与上传功能相同的逻辑更新文件列表
        await fileOperations.updateFileListWithNewFile(name, false);
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
    dialogStates.setCreateDialogVisible(false);
  };

  // 权限设置请求处理函数
  const handlePermissionRequest = useCallback((files: FileEntry[]) => {
    console.log('FileList: 收到权限设置请求', files.map(f => f.name));
    dialogStates.setPermissionFiles(files);
    dialogStates.setPermissionDialogVisible(true);
  }, [dialogStates]);

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
        dialogStates.setPermissionDialogVisible(false);

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
    dialogStates.setPermissionDialogVisible(false);
  };

  // 打开方式请求处理
  const handleOpenWithRequest = useCallback(async (_files: FileEntry[], editorType: 'builtin' | 'external') => {
    console.log(`[FileList] 设置全局打开方式偏好: ${editorType}`);

    try {
      // 设置全局的默认打开方式
      await unifiedEditorConfig.setDefaultOpenMode(editorType);

      message.success(`已设置默认使用${editorType === 'builtin' ? '内置' : '外部'}编辑器打开文件`);
    } catch (error) {
      console.error('[FileList] 设置打开方式偏好失败:', error);
      message.error('设置打开方式失败');
    }
  }, []);

  // 打开文件请求处理（立即打开）
  const handleOpenFileRequest = useCallback(async (files: FileEntry[], editorType: 'builtin' | 'external') => {
    if (files.length !== 1 || files[0].isDirectory) {
      message.warning('请选择一个文件进行编辑');
      return;
    }

    if (!sessionInfo) {
      message.error('缺少会话信息');
      return;
    }

    const file = files[0];

    // 防止重复点击
    if (openingFiles.has(file.path)) {
      console.log('[FileList] 文件正在打开中，忽略重复请求:', file.name);
      return;
    }

    console.log(`[FileList] 打开文件请求: ${file.name} - ${editorType}`);

    // 添加到正在打开的文件列表
    setOpeningFiles(prev => new Set(prev).add(file.path));

    // 显示loading提示
    const loadingMessage = message.loading(`正在打开文件 ${file.name}...`, 0);

    try {
      if (editorType === 'builtin') {
        // 使用内置编辑器打开
        await fileOpenManager.openFile(file, sessionInfo, tabId, 'built-in');
      } else {
        // 使用外部编辑器打开
        const editors = await unifiedEditorConfig.getEditors();
        if (editors.length === 0) {
          message.warning('请先配置外部编辑器');
          dialogStates.setEditorConfigVisible(true);
          return;
        }

        // 设置编辑器选择回调
        externalEditorManager.setEditorSelectorCallback(async (file) => {
          return new Promise(async (resolve) => {
            // 获取可用的编辑器列表
            const editorList = await unifiedEditorConfig.getEditors();
            dialogStates.setAvailableEditors(editorList);
            dialogStates.setEditorSelectorFile(file);
            dialogStates.setEditorSelectorVisible(true);

            // 临时存储resolve函数
            (window as any).__editorSelectorResolve = resolve;
          });
        });

        // 打开文件
        await externalEditorManager.openFileWithExternalEditor(
          file,
          sessionInfo,
          tabId
        );
      }
    } catch (error) {
      console.error('[FileList] 打开文件失败:', error);
      message.error(`打开文件失败: ${(error as Error).message}`);
    } finally {
      // 关闭loading提示
      loadingMessage();

      // 从正在打开的文件列表中移除
      setOpeningFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.path);
        return newSet;
      });
    }
  }, [sessionInfo, tabId, openingFiles, setOpeningFiles]);

  // 编辑器配置请求处理
  const handleEditorConfigRequest = useCallback(() => {
    console.log('[FileList] 编辑器配置请求');
    dialogStates.setEditorConfigVisible(true);
  }, [dialogStates]);

  // 编辑器选择确认处理
  const handleEditorSelect = useCallback((editorId: string, remember: boolean) => {
    console.log('[FileList] 编辑器选择:', editorId, remember);

    if (remember && dialogStates.editorSelectorFile) {
      // 记住文件类型关联
      const ext = dialogStates.editorSelectorFile.name.split('.').pop();
      if (ext) {
        unifiedEditorConfig.setFileAssociation(ext, editorId);
      }
    }

    dialogStates.setEditorSelectorVisible(false);
    dialogStates.setEditorSelectorFile(null);

    // 调用resolve函数
    const resolve = (window as any).__editorSelectorResolve;
    if (resolve) {
      resolve(editorId);
      delete (window as any).__editorSelectorResolve;
    }
  }, [dialogStates]);

  // 编辑器选择取消处理
  const handleEditorSelectCancel = useCallback(() => {
    console.log('[FileList] 编辑器选择取消');

    dialogStates.setEditorSelectorVisible(false);
    dialogStates.setEditorSelectorFile(null);

    // 调用resolve函数
    const resolve = (window as any).__editorSelectorResolve;
    if (resolve) {
      resolve(null);
      delete (window as any).__editorSelectorResolve;
    }
  }, [dialogStates]);

  // 编辑器配置关闭处理
  const handleEditorConfigClose = useCallback(() => {
    console.log('[FileList] 编辑器配置关闭');
    dialogStates.setEditorConfigVisible(false);
  }, [dialogStates]);

  // 复制文件处理
  const handleCopyRequest = useCallback((files: FileEntry[]) => {
    console.log('[FileList] 复制文件请求:', files.map(f => f.name));
    if (!sessionInfo) {
      message.error('缺少会话信息');
      return;
    }
    clipboardManager.copy(files, currentPath, sessionInfo.id);
    message.success(`已复制 ${files.length} 个项目`);
  }, [currentPath, sessionInfo]);

  // 剪切文件处理
  const handleCutRequest = useCallback((files: FileEntry[]) => {
    console.log('[FileList] 剪切文件请求:', files.map(f => f.name));
    if (!sessionInfo) {
      message.error('缺少会话信息');
      return;
    }
    clipboardManager.cut(files, currentPath, sessionInfo.id);
    message.success(`已剪切 ${files.length} 个项目`);
  }, [currentPath, sessionInfo]);

  // 粘贴文件处理
  const handlePasteRequest = useCallback(async () => {
    console.log('[FileList] 粘贴文件请求');

    const clipboardContent = clipboardManager.getClipboard();
    if (!clipboardContent) {
      message.warning('剪贴板为空');
      return;
    }

    if (!sessionInfo) {
      message.error('缺少会话信息');
      return;
    }

    try {
      // 显示进度对话框
      setCopyPasteProgress({
        visible: true,
        minimized: false,
        operation: clipboardContent.operation,
        currentFile: '',
        totalFiles: clipboardContent.files.length,
        currentIndex: 0,
        progress: 0
      });

      await fileOperationService.executeCopyPaste({
        sourceFiles: clipboardContent.files,
        sourcePath: clipboardContent.sourcePath,
        sourceSessionId: clipboardContent.sourceSessionId,
        targetPath: currentPath,
        targetSessionId: sessionInfo.id,
        operation: clipboardContent.operation,
        onProgress: (currentFile, totalFiles, currentIndex) => {
          console.log(`[FileList] 粘贴进度: ${currentFile} (${currentIndex}/${totalFiles})`);
          setCopyPasteProgress(prev => ({
            ...prev,
            currentFile,
            totalFiles,
            currentIndex
          }));
        }
      });

      // 隐藏进度对话框
      setCopyPasteProgress(prev => ({ ...prev, visible: false }));

      // 粘贴完成后清理剪贴板（如果是剪切操作）
      clipboardManager.onPasteComplete();

      message.success('粘贴操作完成');

      // 刷新文件列表
      onRefresh?.();

    } catch (error) {
      console.error('[FileList] 粘贴操作失败:', error);

      const errorMessage = (error as Error).message;

      // 检查是否是sshpass相关错误，如果是就不显示错误信息（因为已经弹出安装对话框）
      if (errorMessage.includes('需要安装sshpass工具') ||
          errorMessage.includes('sshpass: command not found')) {
        console.log('[FileList] sshpass安装对话框已处理，不显示错误信息');
      } else {
        message.error(`粘贴失败: ${errorMessage}`);
      }

      // 隐藏进度对话框
      setCopyPasteProgress(prev => ({ ...prev, visible: false }));
    }
  }, [currentPath, tabId, sessionInfo, onRefresh]);

  // 最小化进度对话框
  const handleMinimizeProgress = useCallback(() => {
    setCopyPasteProgress(prev => ({ ...prev, minimized: true }));
  }, []);

  // 展开进度对话框
  const handleExpandProgress = useCallback(() => {
    setCopyPasteProgress(prev => ({ ...prev, minimized: false }));
  }, []);

  // 添加快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 检查是否在文件列表容器内或有焦点
      const isFileListFocused = containerRef.current && (
        containerRef.current.contains(document.activeElement) ||
        document.activeElement === containerRef.current ||
        selectedRowKeys.length > 0
      );

      if (!isFileListFocused) {
        return;
      }

      // 处理复制快捷键 Ctrl+C
      if (e.ctrlKey && e.key === 'c' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (selectedRowKeys.length > 0) {
          const selectedFiles = fileList.filter(f => selectedRowKeys.includes(f.name));
          handleCopyRequest(selectedFiles);
        }
        return;
      }

      // 处理剪切快捷键 Ctrl+X
      if (e.ctrlKey && e.key === 'x' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        if (selectedRowKeys.length > 0) {
          const selectedFiles = fileList.filter(f => selectedRowKeys.includes(f.name));
          handleCutRequest(selectedFiles);
        }
        return;
      }

      // 处理粘贴快捷键 Ctrl+V
      if (e.ctrlKey && e.key === 'v' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handlePasteRequest();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedRowKeys, fileList, handleCopyRequest, handleCutRequest, handlePasteRequest]);

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

  // 处理空白区域右键菜单
  const handleContainerContextMenu = useCallback((event: React.MouseEvent) => {
    // 检查是否点击在表格行上，如果是则不处理（让行的右键事件处理）
    const target = event.target as HTMLElement;
    const isOnRow = target.closest('tr');

    if (isOnRow) {
      return; // 如果点击在行上，让行的右键事件处理
    }

    console.log('[FileList] 空白区域右键菜单被触发');
    event.preventDefault();

    // 获取选中的文件，如果没有选中文件则传空数组
    const selectedFiles = fileList.filter(f => selectedRowKeys.includes(f.name));
    console.log('[FileList] 空白区域选中的文件:', selectedFiles.map(f => f.name));

    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      file: null as any, // 空白区域没有特定文件
      selectedFiles: selectedFiles.length > 0 ? selectedFiles : []
    });
    console.log('[FileList] 空白区域右键菜单状态已设置');
  }, [selectedRowKeys, fileList]);

  // 处理关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 高亮显示文件
  const highlightFile = (fileName: string) => {
    fileOperations.highlightFile(fileName, setHighlightedFiles);
  };

  // 滚动到指定文件
  const scrollToFile = (fileName: string, fileListToUse: FileEntry[]) => {
    fileOperations.scrollToFile(fileName, fileListToUse, containerRef);
  };



  // 处理列宽调整 - 简化版本，只在拖拽结束时更新
  const handleResize = useCallback((index: number) => {
    // 立即更新函数（用于拖拽结束）
    const immediateUpdate = (width: number) => {
      const newColumnWidths = { ...columnWidths };
      const columnKeys = Object.keys(newColumnWidths);
      const columnKey = columnKeys[index] as keyof typeof columnWidths;

      if (columnKey) {
        const newWidth = Math.max(width, 50); // 最小宽度50px
        newColumnWidths[columnKey] = newWidth;
        setColumnWidths(newColumnWidths);
        console.log('[FileList] 列宽更新完成:', { columnKey, newWidth });
      }
    };

    return { immediateUpdate };
  }, [columnWidths]);

  const columns = useFileListColumns({
    columnWidths,
    sortedInfo,
    openingFiles,
    highlightedFiles,
    handleResize,
    formatPermissions,
    formatFileSize,
    getFileIcon,
    containerRef
  });

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
    <div className="file-list-container" ref={containerRef} onContextMenu={handleContainerContextMenu}>
      <Table
        ref={tableRef}
        dataSource={fileList}
        columns={columns}
        rowKey="name"
        pagination={false}
        size="small"
        onChange={handleTableChange}
        scroll={{ y: tableHeight }}
        sticky={false} // 禁用sticky，可能会干扰调整
        showSorterTooltip={false}
        rowSelection={rowSelection}
        tableLayout="fixed" // 明确指定固定布局
        components={{
          header: {
            cell: ResizableTitle,
          },
        }}
        onRow={(record) => {
          // 检查文件是否被剪切
          const isCutFile = sessionInfo ? clipboardManager.isCutFile(sessionInfo.id, currentPath, record.name) : false;

          // 组合CSS类名
          let className = '';
          if (highlightedFiles.has(record.name)) {
            className += 'file-list-row-highlighted ';
          }
          if (isCutFile) {
            className += 'file-list-row-cut ';
          }

          return {
            onDoubleClick: () => handleRowDoubleClick(record),
            onContextMenu: (e) => handleContextMenu(e, record),
            className: className.trim(),
          };
        }}
      />

      {contextMenu && (
        <FileListContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          selectedFiles={contextMenu.selectedFiles || []}
          sessionInfo={sessionInfo}
          tabId={tabId}
          currentPath={currentPath}
          onClose={handleCloseContextMenu}
          onDownloadRequest={handleDownloadRequest}
          onUploadRequest={handleUploadRequest}
          onFileDeleted={onRefresh}
          onCreateRequest={handleCreateRequest}  // 传递创建请求回调
          onPermissionRequest={handlePermissionRequest}  // 传递权限设置请求回调
          onOpenWithRequest={handleOpenWithRequest}  // 传递打开方式请求回调
          onOpenFileRequest={handleOpenFileRequest}  // 传递打开文件请求回调
          onEditorConfigRequest={handleEditorConfigRequest}  // 传递编辑器配置请求回调
          onCopyRequest={handleCopyRequest}  // 传递复制请求回调
          onCutRequest={handleCutRequest}   // 传递剪切请求回调
          onPasteRequest={handlePasteRequest}  // 传递粘贴请求回调
        />
      )}

      {/* 下载对话框 */}
      {sessionInfo && dialogStates.downloadFile && (
        <DownloadDialog
          visible={dialogStates.downloadDialogVisible}
          file={dialogStates.downloadFile}
          files={dialogStates.downloadFiles}
          sessionInfo={sessionInfo}
          defaultSavePath={getDefaultDownloadPath()}
          onConfirm={handleDownloadConfirm}
          onCancel={handleDownloadCancel}
        />
      )}

      {/* 上传对话框 */}
      {sessionInfo && (
        <UploadDialog
          visible={dialogStates.uploadDialogVisible}
          defaultRemotePath={dialogStates.uploadPath}
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
        visible={dialogStates.createDialogVisible}
        type={dialogStates.createType}
        currentPath={currentPath}
        onConfirm={handleCreateConfirm}
        onCancel={handleCreateCancel}
      />

      {/* 权限设置对话框 */}
      {sessionInfo && (
        <PermissionDialog
          visible={dialogStates.permissionDialogVisible}
          files={dialogStates.permissionFiles}
          sessionInfo={sessionInfo}
          currentPath={currentPath}
          onConfirm={handlePermissionConfirm}
          onCancel={handlePermissionCancel}
        />
      )}

      {/* 外部编辑器配置对话框 */}
      <EditorConfigDialog
        visible={dialogStates.editorConfigVisible}
        onClose={handleEditorConfigClose}
      />

      {/* 编辑器选择对话框 */}
      {dialogStates.editorSelectorFile && (
        <EditorSelectorDialog
          visible={dialogStates.editorSelectorVisible}
          file={dialogStates.editorSelectorFile}
          editors={dialogStates.availableEditors}
          onSelect={handleEditorSelect}
          onCancel={handleEditorSelectCancel}
        />
      )}

      {/* 复制粘贴进度对话框 */}
      <CopyPasteProgressDialog
        visible={copyPasteProgress.visible && !copyPasteProgress.minimized}
        operation={copyPasteProgress.operation}
        currentFile={copyPasteProgress.currentFile}
        totalFiles={copyPasteProgress.totalFiles}
        currentIndex={copyPasteProgress.currentIndex}
        onMinimize={handleMinimizeProgress}
      />

      {/* 最小化的进度指示器 */}
      <MinimizedProgressIndicator
        visible={copyPasteProgress.visible && copyPasteProgress.minimized}
        operation={copyPasteProgress.operation}
        currentFile={copyPasteProgress.currentFile}
        totalFiles={copyPasteProgress.totalFiles}
        currentIndex={copyPasteProgress.currentIndex}
        onExpand={handleExpandProgress}
      />
    </div>
  );
};

export default FileList; 