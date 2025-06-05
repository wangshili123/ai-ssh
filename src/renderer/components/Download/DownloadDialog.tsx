/**
 * 文件下载配置对话框组件
 */

import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Checkbox, message, Space, Typography } from 'antd';
import { FolderOpenOutlined, FileOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import type { FileEntry } from '../../../main/types/file';
import type { SessionInfo } from '../../types';
import { formatFileSize } from '../../utils/fileUtils';
import './DownloadDialog.css';

const { Text } = Typography;

export interface DownloadConfig {
  savePath: string;
  fileName: string;
  overwrite: boolean;
  openFolder: boolean;
  sessionId: string;
}

export interface DownloadDialogProps {
  visible: boolean;
  file: FileEntry;
  files?: FileEntry[]; // 批量下载时的文件列表
  sessionInfo: SessionInfo;
  defaultSavePath?: string;
  onConfirm: (config: DownloadConfig) => void;
  onCancel: () => void;
}

export const DownloadDialog: React.FC<DownloadDialogProps> = ({
  visible,
  file,
  files,
  sessionInfo,
  defaultSavePath = '',
  onConfirm,
  onCancel
}) => {
  // 判断是否为批量下载
  const isBatchDownload = files && files.length > 1;
  const downloadFiles = files || [file];

  console.log('DownloadDialog 渲染:', {
    visible,
    fileName: file.name,
    isBatch: isBatchDownload,
    fileCount: downloadFiles.length
  });

  const [savePath, setSavePath] = useState(defaultSavePath);
  const [fileName, setFileName] = useState(isBatchDownload ? '' : file.name);
  const [overwrite, setOverwrite] = useState(false);
  const [openFolder, setOpenFolder] = useState(true);
  const [loading, setLoading] = useState(false);

  // 当文件变化时重置文件名
  useEffect(() => {
    setFileName(isBatchDownload ? '' : file.name);
  }, [file.name, isBatchDownload]);

  // 当默认路径变化时更新保存路径
  useEffect(() => {
    if (defaultSavePath) {
      setSavePath(defaultSavePath);
    }
  }, [defaultSavePath]);

  // 浏览文件夹
  const handleBrowse = async () => {
    try {
      const { ipcRenderer } = window.require('electron');

      if (isBatchDownload) {
        // 批量下载时只选择文件夹
        const result = await ipcRenderer.invoke('dialog:show-open-dialog', {
          defaultPath: savePath,
          properties: ['openDirectory']
        });

        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          setSavePath(result.filePaths[0]);
        }
      } else {
        // 单个文件下载时选择保存路径和文件名
        const result = await ipcRenderer.invoke('dialog:show-save-dialog', {
          defaultPath: savePath ? `${savePath}/${fileName}` : fileName,
          filters: [
            { name: '所有文件', extensions: ['*'] }
          ]
        });

        if (!result.canceled && result.filePath) {
          const path = window.require('path');
          setSavePath(path.dirname(result.filePath));
          setFileName(path.basename(result.filePath));
        }
      }
    } catch (error) {
      console.error('选择保存路径失败:', error);
      message.error('选择保存路径失败');
    }
  };

  // 确认下载
  const handleConfirm = async () => {
    if (!savePath.trim()) {
      message.error('请选择保存路径');
      return;
    }

    if (!isBatchDownload && !fileName.trim()) {
      message.error('请输入文件名');
      return;
    }

    setLoading(true);
    try {
      const config: DownloadConfig = {
        savePath: savePath.trim(),
        fileName: isBatchDownload ? '' : fileName.trim(), // 批量下载时文件名由各个文件自己决定
        overwrite,
        openFolder,
        sessionId: sessionInfo.id
      };

      onConfirm(config);
    } catch (error) {
      console.error('下载配置错误:', error);
      message.error('下载配置错误');
    } finally {
      setLoading(false);
    }
  };

  // 获取完整的保存路径
  const getFullPath = () => {
    if (!savePath || !fileName) return '';
    const path = window.require('path');
    return path.join(savePath, fileName);
  };

  return (
    <Modal
      title={
        <Space>
          <CloudDownloadOutlined />
          <span>{isBatchDownload ? `批量下载 (${downloadFiles.length}个文件)` : '下载文件'}</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          loading={loading}
          onClick={handleConfirm}
          icon={<CloudDownloadOutlined />}
        >
          开始下载
        </Button>
      ]}
      width={520}
      className="download-dialog"
      destroyOnClose
      zIndex={9999}
      maskClosable={false}
    >
      <div className="download-dialog-content">
        {/* 文件信息卡片 */}
        <div className="file-info-card">
          {isBatchDownload ? (
            <div className="batch-file-info">
              <div className="batch-header">
                <FileOutlined className="file-icon" />
                <div className="batch-details">
                  <div className="batch-title">批量下载 {downloadFiles.length} 个文件</div>
                  <div className="batch-meta">
                    <Text type="secondary">
                      总大小: {formatFileSize(downloadFiles.reduce((sum, f) => sum + (f.size || 0), 0))}
                    </Text>
                  </div>
                </div>
              </div>
              <div className="batch-file-list">
                {downloadFiles.slice(0, 5).map((f, index) => (
                  <div key={index} className="batch-file-item">
                    <Text>{f.name}</Text>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {formatFileSize(f.size || 0)}
                    </Text>
                  </div>
                ))}
                {downloadFiles.length > 5 && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    还有 {downloadFiles.length - 5} 个文件...
                  </Text>
                )}
              </div>
            </div>
          ) : (
            <div className="file-info-header">
              <FileOutlined className="file-icon" />
              <div className="file-details">
                <div className="file-name">{file.name}</div>
                <div className="file-meta">
                  <Text type="secondary">大小: {formatFileSize(file.size || 0)}</Text>
                  <Text type="secondary" className="file-path">
                    来源: {file.path}
                  </Text>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 保存配置 */}
        <div className="save-config">
          <div className="config-section">
            <label className="config-label">保存位置</label>
            <div className="path-input-group">
              <Input
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                placeholder="选择保存文件夹"
                className="path-input"
              />
              <Button
                icon={<FolderOpenOutlined />}
                onClick={handleBrowse}
                className="browse-button"
              >
                浏览...
              </Button>
            </div>
          </div>

          {!isBatchDownload && (
            <div className="config-section">
              <label className="config-label">文件名</label>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="输入文件名"
                className="filename-input"
              />
            </div>
          )}

          {/* 完整路径预览 */}
          {(isBatchDownload ? savePath : getFullPath()) && (
            <div className="path-preview">
              <Text type="secondary" className="preview-label">
                {isBatchDownload ? '保存到文件夹:' : '完整路径:'}
              </Text>
              <Text code className="preview-path">
                {isBatchDownload ? savePath : getFullPath()}
              </Text>
            </div>
          )}

          {/* 下载选项 */}
          <div className="download-options">
            <Checkbox
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            >
              覆盖同名文件
            </Checkbox>
            <Checkbox
              checked={openFolder}
              onChange={(e) => setOpenFolder(e.target.checked)}
            >
              下载完成后打开文件夹
            </Checkbox>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadDialog;
