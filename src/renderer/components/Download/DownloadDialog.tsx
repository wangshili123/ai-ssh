/**
 * 文件下载配置对话框组件
 */

import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Checkbox, message, Space, Typography, Collapse, Select, Tooltip, Tag } from 'antd';
import { FolderOpenOutlined, FileOutlined, CloudDownloadOutlined, ThunderboltOutlined, CompressOutlined } from '@ant-design/icons';
import type { FileEntry } from '../../../main/types/file';
import type { SessionInfo } from '../../types';
import { formatFileSize } from '../../utils/fileUtils';
import './DownloadDialog.css';

const { Text } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

export interface DownloadConfig {
  savePath: string;
  fileName: string;
  overwrite: boolean;
  openFolder: boolean;
  sessionId: string;
  // 新增：压缩优化选项
  useCompression?: boolean;
  compressionMethod?: 'auto' | 'gzip' | 'bzip2' | 'xz' | 'none';
  useParallelDownload?: boolean;
  maxParallelChunks?: number;
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

  // 智能压缩策略选择
  const getCompressionRecommendation = (file: FileEntry): {
    recommended: boolean;
    method: 'gzip' | 'bzip2' | 'xz';
    reason: string;
    estimatedSavings: string;
  } => {
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const size = file.size;

    // 高压缩比文件类型
    const highCompressible = ['txt', 'js', 'ts', 'json', 'xml', 'html', 'css', 'md', 'log', 'conf', 'sql', 'csv', 'py', 'java', 'cpp', 'c', 'h'];

    // 不适合压缩的文件类型
    const nonCompressible = ['jpg', 'png', 'gif', 'mp4', 'zip', 'gz', 'rar', '7z', 'exe', 'bin'];

    if (nonCompressible.includes(ext) || size < 1024) {
      return {
        recommended: false,
        method: 'gzip',
        reason: '该文件类型压缩效果有限',
        estimatedSavings: '< 5%'
      };
    }

    if (highCompressible.includes(ext)) {
      if (size > 50 * 1024 * 1024) { // 50MB以上
        return {
          recommended: true,
          method: 'xz',
          reason: '大型文本文件，建议最高压缩',
          estimatedSavings: '70-90%'
        };
      } else {
        return {
          recommended: true,
          method: 'gzip',
          reason: '文本文件，压缩效果显著',
          estimatedSavings: '60-80%'
        };
      }
    }

    // 默认策略
    if (size > 10 * 1024) { // 10KB以上
      return {
        recommended: true,
        method: 'gzip',
        reason: '可能有一定压缩效果',
        estimatedSavings: '20-50%'
      };
    }

    return {
      recommended: false,
      method: 'gzip',
      reason: '文件太小，压缩意义不大',
      estimatedSavings: '< 10%'
    };
  };

  const compressionRecommendation = getCompressionRecommendation(file);

  const [savePath, setSavePath] = useState(defaultSavePath);
  const [fileName, setFileName] = useState(isBatchDownload ? '' : file.name);
  const [overwrite, setOverwrite] = useState(false);
  const [openFolder, setOpenFolder] = useState(true);
  const [loading, setLoading] = useState(false);

  // 新增：压缩优化选项状态
  const [useCompression, setUseCompression] = useState(true); // 默认启用压缩
  const [compressionMethod, setCompressionMethod] = useState<'auto' | 'gzip' | 'bzip2' | 'xz' | 'none'>('auto');
  const [useParallelDownload, setUseParallelDownload] = useState(file.size > 0.5 * 1024 * 1024); // 大于0.5MB默认启用并行
  const [maxParallelChunks, setMaxParallelChunks] = useState(() => {
    return 30; // 大文件，16线程
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

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
        sessionId: sessionInfo.id,
        // 新增：压缩优化选项
        useCompression,
        compressionMethod,
        useParallelDownload,
        maxParallelChunks
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
        <div className="download-file-info-card">
          {isBatchDownload ? (
            <div className="batch-file-info">
              <div className="batch-header">
                <FileOutlined className="download-file-icon" />
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
            <div className="download-file-info-header">
              <FileOutlined className="download-file-icon" />
              <div className="download-file-details">
                <div className="download-file-name">{file.name}</div>
                <div className="download-file-meta">
                  <Text type="secondary">大小: {formatFileSize(file.size || 0)}</Text>
                  <Text type="secondary" className="download-file-path">
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

          {/* 压缩优化选项 */}
          <div className="optimization-options">
            <Collapse
              ghost
              size="small"
              onChange={(keys) => setShowAdvancedOptions(keys.length > 0)}
            >
              <Panel
                header={
                  <Space>
                    <ThunderboltOutlined />
                    <span>下载优化选项</span>
                    {compressionRecommendation.recommended && (
                      <Tag color="green">推荐</Tag>
                    )}
                  </Space>
                }
                key="optimization"
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {/* 智能压缩选项 */}
                  <div className="compression-option">
                    <Checkbox
                      checked={useCompression}
                      onChange={(e) => setUseCompression(e.target.checked)}
                    >
                      <Space>
                        <CompressOutlined />
                        <span>智能压缩传输</span>
                        {compressionRecommendation.recommended && (
                          <Tooltip title={`${compressionRecommendation.reason}，预计节省传输量：${compressionRecommendation.estimatedSavings}`}>
                            <Tag color="green">
                              节省 {compressionRecommendation.estimatedSavings}
                            </Tag>
                          </Tooltip>
                        )}
                      </Space>
                    </Checkbox>

                    {useCompression && (
                      <div style={{ marginLeft: 24, marginTop: 8 }}>
                        <Space>
                          <Text type="secondary">压缩方法:</Text>
                          <Select
                            value={compressionMethod}
                            onChange={setCompressionMethod}
                            style={{ width: 150 }}
                            size="small"
                          >
                            <Option value="auto">
                              自动选择 (推荐 {compressionRecommendation.method})
                            </Option>
                            <Option value="gzip">快速压缩 (gzip)</Option>
                            <Option value="bzip2">平衡压缩 (bzip2)</Option>
                            <Option value="xz">最高压缩 (xz)</Option>
                            <Option value="none">不压缩</Option>
                          </Select>
                        </Space>
                      </div>
                    )}
                  </div>

                  {/* 并行下载选项 */}
                  
                    <div className="parallel-option">
                      <Checkbox
                        checked={useParallelDownload}
                        onChange={(e) => setUseParallelDownload(e.target.checked)}
                      >
                        <Space>
                          <ThunderboltOutlined />
                          <span>并行分块下载</span>
                          <Tooltip title="大文件分块并行下载，提升传输速度">
                            <Tag color="blue">大文件推荐</Tag>
                          </Tooltip>
                        </Space>
                      </Checkbox>

                      {useParallelDownload && (
                        <div style={{ marginLeft: 24, marginTop: 8 }}>
                          <Space>
                            <Text type="secondary">并行块数:</Text>
                            <Select
                              value={maxParallelChunks}
                              onChange={setMaxParallelChunks}
                              style={{ width: 120 }}
                              size="small"
                            >
                              <Option value={1}>1 块</Option>
                              <Option value={2}>2 块</Option>
                              <Option value={4}>4 块</Option>
                              <Option value={6}>6 块</Option>
                              <Option value={8}>8 块 (推荐)</Option>
                              <Option value={12}>12 块</Option>
                              <Option value={30}>30 块 (最大)</Option>
                            </Select>
                          </Space>
                        </div>
                      )}
                    </div>

                  {/* 优化效果预览 */}
                  {(useCompression || useParallelDownload) && (
                    <div className="optimization-preview">
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        <Space>
                          <span>预计优化效果:</span>
                          {useCompression && (
                            <Tag color="green">
                              压缩节省 {compressionRecommendation.estimatedSavings}
                            </Tag>
                          )}
                          {useParallelDownload && file.size > 10 * 1024 * 1024 && (
                            <Tag color="blue">
                              并行提速 {maxParallelChunks}x
                            </Tag>
                          )}
                        </Space>
                      </Text>
                    </div>
                  )}
                </Space>
              </Panel>
            </Collapse>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadDialog;
