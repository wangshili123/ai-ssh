import { useState } from 'react';
import type { FileEntry } from '../../../../../main/types/file';
import type { EditorConfig } from '../../ExternalEditor';

/**
 * 管理FileList组件中所有对话框的状态
 */
export const useDialogStates = () => {
  // 下载对话框状态
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

  // 外部编辑器对话框状态
  const [editorConfigVisible, setEditorConfigVisible] = useState(false);
  const [editorSelectorVisible, setEditorSelectorVisible] = useState(false);
  const [editorSelectorFile, setEditorSelectorFile] = useState<FileEntry | null>(null);
  const [availableEditors, setAvailableEditors] = useState<EditorConfig[]>([]);

  return {
    // 下载相关
    downloadDialogVisible,
    setDownloadDialogVisible,
    downloadFile,
    setDownloadFile,
    downloadFiles,
    setDownloadFiles,

    // 上传相关
    uploadDialogVisible,
    setUploadDialogVisible,
    uploadPath,
    setUploadPath,

    // 创建相关
    createDialogVisible,
    setCreateDialogVisible,
    createType,
    setCreateType,

    // 权限相关
    permissionDialogVisible,
    setPermissionDialogVisible,
    permissionFiles,
    setPermissionFiles,

    // 编辑器相关
    editorConfigVisible,
    setEditorConfigVisible,
    editorSelectorVisible,
    setEditorSelectorVisible,
    editorSelectorFile,
    setEditorSelectorFile,
    availableEditors,
    setAvailableEditors,
  };
};
