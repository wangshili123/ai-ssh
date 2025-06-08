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
  message
} from 'antd';
import {
  UploadOutlined,
  FolderOpenOutlined,
  SettingOutlined,
  InfoCircleOutlined
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

  // 重置表单和状态
  useEffect(() => {
    if (visible) {
      setFiles(selectedFiles);
      form.setFieldsValue({
        remotePath: defaultRemotePath,
        overwrite: false,
        preservePermissions: true,
        useCompression: false,
        compressionMethod: 'auto',
        useParallelTransfer: false,
        maxParallelChunks: 4
      });
    }
  }, [visible, selectedFiles, defaultRemotePath, form]);

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

      // 开始上传
      const taskId = await uploadService.startUpload(files, config);
      
      message.success(`开始上传 ${files.length} 个文件`);
      
      // 调用确认回调
      onConfirm?.(config);
      
      // 关闭对话框
      handleCancel();
    } catch (error) {
      console.error('上传启动失败:', error);
      message.error('上传启动失败');
    } finally {
      setUploading(false);
    }
  };

  /**
   * 处理取消
   */
  const handleCancel = () => {
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
   * 智能压缩建议
   */
  const getCompressionRecommendation = () => {
    if (files.length === 0) return null;

    const totalSize = getTotalSize();
    const hasLargeFiles = files.some(file => file.size > 100 * 1024 * 1024); // 100MB
    const hasCompressibleFiles = files.some(file => 
      /\.(txt|log|json|xml|csv|sql)$/i.test(file.name)
    );

    if (hasLargeFiles || hasCompressibleFiles) {
      return {
        recommended: true,
        reason: hasLargeFiles ? '检测到大文件，建议启用压缩传输' : '检测到可压缩文件，建议启用压缩传输'
      };
    }

    return {
      recommended: false,
      reason: '当前文件类型压缩效果有限'
    };
  };

  /**
   * 并行传输建议
   */
  const getParallelRecommendation = () => {
    const totalSize = getTotalSize();
    const hasLargeFiles = files.some(file => file.size > 50 * 1024 * 1024); // 50MB

    if (totalSize > 100 * 1024 * 1024 || hasLargeFiles) {
      return {
        recommended: true,
        reason: '检测到大文件，建议启用并行传输以提高速度'
      };
    }

    return {
      recommended: false,
      reason: '文件较小，并行传输优势不明显'
    };
  };

  const compressionRec = getCompressionRecommendation();
  const parallelRec = getParallelRecommendation();

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
          useCompression: false,
          compressionMethod: 'auto',
          useParallelTransfer: false,
          maxParallelChunks: 4
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
        <Collapse
          ghost
          activeKey={optimizationExpanded ? ['optimization'] : []}
          onChange={(keys) => setOptimizationExpanded(keys.includes('optimization'))}
        >
          <Panel
            header={
              <Space>
                <SettingOutlined />
                <span>上传优化选项</span>
              </Space>
            }
            key="optimization"
          >
            {/* 压缩传输 */}
            <div className="optimization-option">
              <Form.Item name="useCompression" valuePropName="checked">
                <Switch />
                <span style={{ marginLeft: 8 }}>智能压缩传输</span>
              </Form.Item>
              
              {compressionRec && (
                <Alert
                  message={compressionRec.reason}
                  type={compressionRec.recommended ? "info" : "warning"}
                  showIcon
                  icon={<InfoCircleOutlined />}
                  style={{ marginBottom: 16 }}
                />
              )}

              <Form.Item
                label="压缩方法"
                name="compressionMethod"
                style={{ marginLeft: 24 }}
              >
                <Select>
                  <Select.Option value="auto">自动选择</Select.Option>
                  <Select.Option value="gzip">Gzip</Select.Option>
                  <Select.Option value="bzip2">Bzip2</Select.Option>
                  <Select.Option value="xz">XZ</Select.Option>
                </Select>
              </Form.Item>
            </div>

            <Divider />

            {/* 并行传输 */}
            <div className="optimization-option">
              <Form.Item name="useParallelTransfer" valuePropName="checked">
                <Switch />
                <span style={{ marginLeft: 8 }}>并行分块上传</span>
              </Form.Item>

              {parallelRec && (
                <Alert
                  message={parallelRec.reason}
                  type={parallelRec.recommended ? "info" : "warning"}
                  showIcon
                  icon={<InfoCircleOutlined />}
                  style={{ marginBottom: 16 }}
                />
              )}

              <Form.Item
                label="最大并行块数"
                name="maxParallelChunks"
                style={{ marginLeft: 24 }}
              >
                <InputNumber min={1} max={8} />
              </Form.Item>
            </div>
          </Panel>
        </Collapse>

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
