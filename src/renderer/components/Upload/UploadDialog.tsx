/**
 * 上传文件配置对话框
 * 基于下载对话框的设计，实现文件上传功能
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Switch,
  Button,
  Space,
  Divider,
  Typography,
  Alert,
  Collapse,
  Select,
  InputNumber,
  message,
  Tag,
  Tooltip,
  Checkbox
} from 'antd';
import {
  UploadOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  CompressOutlined
} from '@ant-design/icons';
import { UploadConfig } from '../../services/transferService';
import { uploadService } from '../../services/uploadService';
import UploadDropZone from './UploadDropZone';
import './UploadDialog.css';

const { Text, Title } = Typography;
const { Panel } = Collapse;

export interface UploadDialogProps {
  visible: boolean;
  selectedFiles?: File[];
  defaultRemotePath?: string;
  sessionInfo?: {
    id: string;
    host: string;
    username: string;
  };
  onConfirm?: (config: UploadConfig) => void;
  onCancel?: () => void;
}

const UploadDialog: React.FC<UploadDialogProps> = ({
  visible,
  selectedFiles = [],
  defaultRemotePath = '/home/',
  sessionInfo,
  onConfirm,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [files, setFiles] = useState<File[]>(selectedFiles);
  const [uploading, setUploading] = useState(false);
  const [optimizationExpanded, setOptimizationExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 重置表单和状态
  useEffect(() => {
    if (visible) {
      // 只在对话框首次打开时设置初始文件，避免覆盖用户选择的文件
      if (selectedFiles.length > 0) {
        setFiles(selectedFiles);
      }
      // 使用智能建议设置默认值
      const compressionRec = getCompressionRecommendation();
      const parallelRec = getParallelRecommendation();

      form.setFieldsValue({
        remotePath: defaultRemotePath,
        overwrite: false,
        preservePermissions: true,
        useCompression: compressionRec?.recommended || false,
        compressionMethod: compressionRec?.method || 'auto',
        useParallelTransfer: parallelRec?.recommended || false,
        maxParallelChunks: parallelRec?.recommendedChunks || 4
      });

      // 如果有推荐，自动展开优化选项
      if (compressionRec?.recommended || parallelRec?.recommended) {
        setOptimizationExpanded(true);
      }
    }
  }, [visible, defaultRemotePath, form]); // 移除 selectedFiles 依赖，避免重复重置

  /**
   * 处理文件选择
   */
  const handleFilesSelected = (newFiles: File[]) => {
    setFiles(newFiles);
  };

  /**
   * 处理表单提交
   */
  const handleSubmit = async () => {
    if (files.length === 0) {
      message.warning('请选择要上传的文件');
      return;
    }

    if (!sessionInfo) {
      message.error('会话信息不可用');
      return;
    }

    try {
      const values = await form.validateFields();
      
      const config: UploadConfig = {
        remotePath: values.remotePath,
        overwrite: values.overwrite,
        preservePermissions: values.preservePermissions,
        sessionId: sessionInfo.id,
        // 优化选项
        useCompression: values.useCompression,
        compressionMethod: values.compressionMethod,
        useParallelTransfer: values.useParallelTransfer,
        maxParallelChunks: values.maxParallelChunks
      };

      setUploading(true);
      setIsSubmitting(true);

      // 开始上传
      const taskId = await uploadService.startUpload(files, config);

      message.success(`开始上传 ${files.length} 个文件`);

      // 调用确认回调
      onConfirm?.(config);

      // 关闭对话框（不调用onCancel，避免触发取消逻辑）
      setFiles([]);
      form.resetFields();
      setOptimizationExpanded(false);
      setIsSubmitting(false);
      // 不调用 onCancel，因为这不是取消操作，而是确认后的正常关闭
    } catch (error) {
      console.error('上传启动失败:', error);
      message.error('上传启动失败');
      setIsSubmitting(false);
    } finally {
      setUploading(false);
    }
  };

  /**
   * 处理取消
   */
  const handleCancel = () => {
    // 如果正在提交，不执行取消操作
    if (isSubmitting) {
      return;
    }

    setFiles([]);
    form.resetFields();
    setOptimizationExpanded(false);
    onCancel?.();
  };

  /**
   * 浏览远程路径
   */
  const handleBrowseRemotePath = () => {
    // TODO: 实现远程路径浏览功能
    message.info('远程路径浏览功能开发中...');
  };

  /**
   * 计算总文件大小
   */
  const getTotalSize = () => {
    return files.reduce((total, file) => total + file.size, 0);
  };

  /**
   * 格式化文件大小
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  /**
   * 智能压缩策略选择（参考DownloadDialog）
   */
  const getCompressionRecommendation = () => {
    if (files.length === 0) return null;

    // 分析所有文件，找出最具代表性的建议
    let bestRecommendation = {
      recommended: false,
      method: 'gzip' as 'gzip' | 'bzip2' | 'xz',
      reason: '文件类型压缩效果有限',
      estimatedSavings: '< 5%'
    };

    for (const file of files) {
      const ext = file.name.toLowerCase().split('.').pop() || '';
      const size = file.size;

      // 高压缩比文件类型
      const highCompressible = ['txt', 'js', 'ts', 'json', 'xml', 'html', 'css', 'md', 'log', 'conf', 'sql', 'csv', 'py', 'java', 'cpp', 'c', 'h'];
      // 不适合压缩的文件类型
      const nonCompressible = ['jpg', 'png', 'gif', 'mp4', 'zip', 'gz', 'rar', '7z', 'exe', 'bin'];

      if (nonCompressible.includes(ext) && size < 1024) {
        continue; // 跳过不适合压缩的小文件
      }

      if (highCompressible.includes(ext)) {
        if (size > 50 * 1024 * 1024) { // 50MB以上
          bestRecommendation = {
            recommended: true,
            method: 'xz',
            reason: '检测到大型文本文件，建议最高压缩',
            estimatedSavings: '70-90%'
          };
          break; // 找到最佳建议就停止
        } else if (size > 1024 * 1024) { // 1MB以上
          bestRecommendation = {
            recommended: true,
            method: 'gzip',
            reason: '检测到文本文件，压缩效果显著',
            estimatedSavings: '60-80%'
          };
        }
      } else if (size > 10 * 1024 * 1024) { // 10MB以上的其他文件
        if (!bestRecommendation.recommended) {
          bestRecommendation = {
            recommended: true,
            method: 'gzip',
            reason: '检测到大文件，可能有一定压缩效果',
            estimatedSavings: '20-50%'
          };
        }
      }
    }

    return bestRecommendation;
  };

  /**
   * 智能并行传输建议（参考DownloadDialog）
   */
  const getParallelRecommendation = () => {
    if (files.length === 0) return null;

    const totalSize = getTotalSize();
    const largestFile = Math.max(...files.map(f => f.size));

    // 计算推荐的并行块数
    let recommendedChunks = 1;
    if (largestFile < 5 * 1024 * 1024) recommendedChunks = 1;   // 小于5MB，单线程
    else if (largestFile < 50 * 1024 * 1024) recommendedChunks = 4;  // 小于50MB，4线程
    else if (largestFile < 200 * 1024 * 1024) recommendedChunks = 8; // 小于200MB，8线程
    else if (largestFile < 1024 * 1024 * 1024) recommendedChunks = 12; // 小于1GB，12线程
    else recommendedChunks = 16; // 超大文件，16线程

    // 降低推荐阈值，对于大文件更积极地推荐并行
    if (totalSize > 10 * 1024 * 1024 || largestFile > 5 * 1024 * 1024) {
      return {
        recommended: true,
        reason: '检测到大文件，建议启用并行传输以提高速度',
        recommendedChunks
      };
    }

    return {
      recommended: false,
      reason: '文件较小，并行传输优势不明显',
      recommendedChunks: 1
    };
  };

  // 获取智能建议
  const compressionRec = getCompressionRecommendation();
  const parallelRec = getParallelRecommendation();

  // 如果有推荐，自动展开优化选项
  React.useEffect(() => {
    if (compressionRec?.recommended || parallelRec?.recommended) {
      setOptimizationExpanded(true);
    }
  }, [compressionRec?.recommended, parallelRec?.recommended]);

  return (
    <Modal
      title={
        <Space>
          <UploadOutlined />
          <span>上传文件</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      width={600}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={uploading}
          onClick={handleSubmit}
          disabled={files.length === 0}
        >
          开始上传
        </Button>
      ]}
      className="upload-dialog"
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          remotePath: defaultRemotePath,
          overwrite: false,
          preservePermissions: true,
          useCompression: compressionRec?.recommended || false,
          compressionMethod: compressionRec?.method || 'auto',
          useParallelTransfer: parallelRec?.recommended || false,
          maxParallelChunks: parallelRec?.recommendedChunks || 4
        }}
      >
        {/* 文件选择区域 */}
        <div className="upload-file-section">
          <Title level={5}>选择文件</Title>
          <UploadDropZone
            onFilesSelected={handleFilesSelected}
            selectedFiles={files}
            maxFiles={50}
            maxSize={5 * 1024 * 1024 * 1024} // 5GB
          />
          
          {files.length > 0 && (
            <div className="upload-file-summary">
              <Text type="secondary">
                已选择 {files.length} 个文件，总大小 {formatFileSize(getTotalSize())}
              </Text>
            </div>
          )}
        </div>

        <Divider />

        {/* 远程路径配置 */}
        <Form.Item
          label="远程保存路径"
          name="remotePath"
          rules={[
            { required: true, message: '请输入远程保存路径' },
            { pattern: /^\//, message: '路径必须以 / 开头' }
          ]}
        >
          <Input
            placeholder="/home/user/uploads/"
            suffix={
              <Button
                type="text"
                icon={<FolderOpenOutlined />}
                onClick={handleBrowseRemotePath}
                size="small"
              />
            }
          />
        </Form.Item>

        {/* 基础选项 */}
        <Space direction="vertical" style={{ width: '100%' }}>
          <Form.Item name="overwrite" valuePropName="checked">
            <Switch />
            <span style={{ marginLeft: 8 }}>覆盖同名文件</span>
          </Form.Item>

          <Form.Item name="preservePermissions" valuePropName="checked">
            <Switch />
            <span style={{ marginLeft: 8 }}>保持文件权限</span>
          </Form.Item>
        </Space>

        {/* 优化选项 */}
        <div className="optimization-options">
          <Collapse
            ghost
            size="small"
            activeKey={optimizationExpanded ? ['optimization'] : []}
            onChange={(keys) => setOptimizationExpanded(keys.includes('optimization'))}
          >
            <Panel
              header={
                <Space>
                  <ThunderboltOutlined />
                  <span>上传优化选项</span>
                  {(compressionRec?.recommended || parallelRec?.recommended) && (
                    <Tag color="green">推荐</Tag>
                  )}
                </Space>
              }
              key="optimization"
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {/* 智能压缩选项 */}
                <div className="compression-option">
                  <Form.Item name="useCompression" valuePropName="checked" style={{ marginBottom: 8 }}>
                    <Checkbox>
                      <Space>
                        <CompressOutlined />
                        <span>智能压缩传输</span>
                        {compressionRec?.recommended && (
                          <Tooltip title={`${compressionRec.reason}，预计节省传输量：${compressionRec.estimatedSavings}`}>
                            <Tag color="green">
                              节省 {compressionRec.estimatedSavings}
                            </Tag>
                          </Tooltip>
                        )}
                      </Space>
                    </Checkbox>
                  </Form.Item>

                  <Form.Item
                    label="压缩方法"
                    name="compressionMethod"
                    style={{ marginLeft: 24, marginBottom: 16 }}
                  >
                    <Select style={{ width: 200 }} size="small">
                      <Select.Option value="auto">
                        自动选择 {compressionRec?.method && `(推荐 ${compressionRec.method})`}
                      </Select.Option>
                      <Select.Option value="gzip">快速压缩 (gzip)</Select.Option>
                      <Select.Option value="bzip2">平衡压缩 (bzip2)</Select.Option>
                      <Select.Option value="xz">最高压缩 (xz)</Select.Option>
                    </Select>
                  </Form.Item>
                </div>

                {/* 并行传输选项 */}
                {getTotalSize() > 10 * 1024 * 1024 && (
                  <div className="parallel-option">
                    <Form.Item name="useParallelTransfer" valuePropName="checked" style={{ marginBottom: 8 }}>
                      <Checkbox>
                        <Space>
                          <ThunderboltOutlined />
                          <span>并行分块上传</span>
                          <Tooltip title="大文件分块并行上传，提升传输速度">
                            <Tag color="blue">大文件推荐</Tag>
                          </Tooltip>
                        </Space>
                      </Checkbox>
                    </Form.Item>

                    <Form.Item
                      label="并行块数"
                      name="maxParallelChunks"
                      style={{ marginLeft: 24, marginBottom: 16 }}
                    >
                      <Select style={{ width: 120 }} size="small">
                        <Select.Option value={1}>1 块</Select.Option>
                        <Select.Option value={2}>2 块</Select.Option>
                        <Select.Option value={4}>4 块</Select.Option>
                        <Select.Option value={6}>6 块</Select.Option>
                        <Select.Option value={8}>8 块 (推荐)</Select.Option>
                        <Select.Option value={12}>12 块</Select.Option>
                        <Select.Option value={16}>16 块 (最大)</Select.Option>
                      </Select>
                    </Form.Item>
                  </div>
                )}

                {/* 优化效果预览 */}
                {(compressionRec?.recommended || parallelRec?.recommended) && (
                  <div className="optimization-preview">
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      <Space>
                        <span>预计优化效果:</span>
                        {compressionRec?.recommended && (
                          <Tag color="green">
                            压缩节省 {compressionRec.estimatedSavings}
                          </Tag>
                        )}
                        {parallelRec?.recommended && getTotalSize() > 10 * 1024 * 1024 && (
                          <Tag color="blue">
                            并行提速 {parallelRec.recommendedChunks}x
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

        {/* 会话信息显示 */}
        {sessionInfo && (
          <div className="session-info">
            <Text type="secondary">
              目标服务器: {sessionInfo.username}@{sessionInfo.host}
            </Text>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default UploadDialog;
