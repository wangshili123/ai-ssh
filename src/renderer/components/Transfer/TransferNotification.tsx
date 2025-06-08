/**
 * 统一传输通知组件
 * 支持上传和下载的通知显示
 */

import React from 'react';
import { Progress, Typography, Space, Button, Tag } from 'antd';
import {
  CloseOutlined,
  DownloadOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PauseOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import type { TransferTask } from '../../services/transferService';
import { downloadService } from '../../services/downloadService';
import { uploadService } from '../../services/uploadService';
import { formatFileSize } from '../../utils/fileUtils';
import './TransferNotification.css';

const { Text } = Typography;

export interface TransferNotificationProps {
  task: TransferTask;
  onClose?: () => void;
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
}

const TransferNotification: React.FC<TransferNotificationProps> = ({
  task,
  onClose,
  onPause,
  onResume,
  onCancel
}) => {
  // 格式化剩余时间
  const formatRemainingTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds <= 0) return '--';

    if (seconds < 60) {
      return `${Math.round(seconds)}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}分钟`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return hours > 24 ? `${Math.floor(hours / 24)}天` : `${hours}小时${minutes}分钟`;
    }
  };
  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return task.type === 'upload' ? <UploadOutlined /> : <DownloadOutlined />;
    }
  };



  const getFileName = () => {
    if (task.type === 'download') {
      return (task as any).file.name;
    } else {
      const fileCount = (task as any).totalFiles || (task as any).localFiles.length;
      return fileCount === 1
        ? (task as any).localFiles[0]?.name || '未知文件'
        : `${fileCount}个文件`;
    }
  };



  const getStatusText = () => {
    switch (task.status) {
      case 'pending':
        return '等待中';
      case 'downloading':
        return '下载中';
      case 'uploading':
        return '上传中';
      case 'paused':
        return '已暂停';
      case 'completed':
        return '已完成';
      case 'error':
        return '失败';
      case 'cancelled':
        return '已取消';
      default:
        return '未知状态';
    }
  };

  const isActive = task.status === 'downloading' || task.status === 'uploading';

  // 处理操作按钮
  const handlePause = async () => {
    try {
      if (task.type === 'download') {
        await downloadService.pauseTransfer(task.id);
      } else {
        await uploadService.pauseTransfer(task.id);
      }
    } catch (error) {
      console.error('暂停失败:', error);
    }
  };

  const handleResume = async () => {
    try {
      if (task.type === 'download') {
        await downloadService.resumeTransfer(task.id);
      } else {
        await uploadService.resumeTransfer(task.id);
      }
    } catch (error) {
      console.error('恢复失败:', error);
    }
  };

  const handleCancel = async () => {
    try {
      if (task.type === 'download') {
        await downloadService.cancelTransfer(task.id);
      } else {
        await uploadService.cancelTransfer(task.id);
      }
      onClose?.();
    } catch (error) {
      console.error('取消失败:', error);
    }
  };

  // 渲染操作按钮
  const renderActions = () => {
    const actions = [];

    // 暂停/恢复按钮已隐藏 - 简化用户体验

    if (['downloading', 'uploading'].includes(task.status)) {
      actions.push(
        <Button
          key="cancel"
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleCancel}
          title="取消"
          danger
        />
      );
    } else {
      actions.push(
        <Button
          key="close"
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={onClose}
          title="关闭"
        />
      );
    }

    return actions;
  };

  return (
    <div className={`transfer-notification transfer-${task.type}`} data-status={task.status}>
      {/* 通知头部 */}
      <div className="notification-header">
        <Space>
          {getStatusIcon()}
          <Text strong className="file-name">
            {getFileName()}
          </Text>
        </Space>
        <div className="header-actions">
          <Text type="secondary" className="status-text">
            {getStatusText()}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={onClose}
            className="close-button"
            title="关闭通知"
          />
        </div>
      </div>

      {/* 通知内容 */}
      <div className="notification-content">
        {/* 进度条 */}
        {isActive && (
          <Progress
            percent={Math.round(task.progress.percentage)}
            strokeColor={
              task.status === 'downloading' || task.status === 'uploading' ?
                (task.type === 'upload' ? '#52c41a' : '#1890ff') :
              task.status === 'completed' ? '#52c41a' :
              task.status === 'error' ? '#ff4d4f' :
              task.status === 'paused' ? '#faad14' : '#1890ff'
            }
            trailColor="#f0f0f0"
            size="small"
            status={
              task.status === 'error' ? 'exception' :
              task.status === 'completed' ? 'success' : 'active'
            }
            showInfo={false}
          />
        )}

        {/* 进度信息 */}
        {isActive && (
          <div className="progress-info">
            <Space split={<span className="separator">•</span>} size="small">
              <Text type="secondary" className="progress-text">
                {formatFileSize(task.progress.transferred)} / {formatFileSize(task.progress.total)}
              </Text>
              <Text type="secondary" className="speed-text">
                {formatFileSize(task.progress.speed)}/s
              </Text>
              {task.progress.remainingTime > 0 && (
                <Text type="secondary" className="time-text">
                  剩余: {formatRemainingTime(task.progress.remainingTime)}
                </Text>
              )}
            </Space>
          </div>
        )}

        {/* 优化标签显示 */}
        {isActive && (task.compressionEnabled || task.parallelEnabled) && (
          <div className="notification-tags" style={{ marginTop: '6px', paddingTop: '4px', borderTop: '1px solid #f0f0f0' }}>
            <Space size="small" wrap>
              {/* 压缩阶段显示 */}
              {task.progress.compressionPhase && (
                <Tag color="orange" style={{ fontSize: '10px', padding: '0 6px', borderRadius: '8px' }}>
                  {task.progress.compressionPhase === 'compressing' ? '正在压缩' :
                   task.progress.compressionPhase === 'transferring' ? '传输中' :
                   task.progress.compressionPhase === 'extracting' ? '正在解压' : '压缩传输'}
                </Tag>
              )}

              {/* 并行传输状态显示 */}
              {task.parallelEnabled && task.transferChunks && (
                <Tag icon={<ThunderboltOutlined />} color="blue" style={{ fontSize: '10px', padding: '0 6px', borderRadius: '8px' }}>
                  并行 {task.transferChunks.filter((c: any) => c.status === 'transferring').length}/{task.maxParallelChunks}
                </Tag>
              )}
            </Space>
          </div>
        )}

        {/* 错误信息 */}
        {task.status === 'error' && task.error && (
          <div className="error-info">
            <Text type="danger" className="error-text">
              {task.error}
            </Text>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="notification-actions">
        <Space size="small">
          {renderActions()}
        </Space>
      </div>
    </div>
  );
};

export default TransferNotification;
