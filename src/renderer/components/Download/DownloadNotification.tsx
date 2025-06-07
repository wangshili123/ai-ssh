/**
 * 下载通知组件 - 显示在界面右下角的下载进度通知
 */

import React, { useState, useEffect } from 'react';
import { Progress, Button, Space, Typography } from 'antd';
import { 
  DownloadOutlined, 
  PauseOutlined, 
  PlayCircleOutlined, 
  CloseOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { downloadService, type DownloadTask } from '../../services/downloadService';
import { formatFileSize } from '../../utils/fileUtils';
import './DownloadNotification.css';

const { Text } = Typography;

interface DownloadNotificationProps {
  task: DownloadTask;
  onClose?: () => void;
}

export const DownloadNotification: React.FC<DownloadNotificationProps> = ({
  task,
  onClose
}) => {
  const [currentTask, setCurrentTask] = useState(task);

  // 监听任务状态变化
  useEffect(() => {
    const handleTaskUpdate = (updatedTask: DownloadTask) => {
      if (updatedTask.id === task.id) {
        setCurrentTask(updatedTask);
      }
    };

    downloadService.on('download-progress', handleTaskUpdate);
    downloadService.on('download-completed', handleTaskUpdate);
    downloadService.on('download-error', handleTaskUpdate);
    downloadService.on('download-paused', handleTaskUpdate);
    downloadService.on('download-resumed', handleTaskUpdate);
    downloadService.on('download-cancelled', handleTaskUpdate);

    return () => {
      downloadService.off('download-progress', handleTaskUpdate);
      downloadService.off('download-completed', handleTaskUpdate);
      downloadService.off('download-error', handleTaskUpdate);
      downloadService.off('download-paused', handleTaskUpdate);
      downloadService.off('download-resumed', handleTaskUpdate);
      downloadService.off('download-cancelled', handleTaskUpdate);
    };
  }, [task.id]);

  // 格式化速度
  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0 || !isFinite(bytesPerSecond) || bytesPerSecond < 0) return '0 B/s';
    return `${formatFileSize(bytesPerSecond)}/s`;
  };

  // 格式化剩余时间
  const formatRemainingTime = (seconds: number): string => {
    if (seconds === 0 || !isFinite(seconds)) return '--:--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
  };

  // 获取状态图标
  const getStatusIcon = () => {
    switch (currentTask.status) {
      case 'downloading':
        return <DownloadOutlined style={{ color: '#1890ff' }} />;
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      case 'paused':
        return <PauseOutlined style={{ color: '#faad14' }} />;
      default:
        return <DownloadOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    if (currentTask.status === 'downloading' && currentTask.progress.compressionPhase) {
      switch (currentTask.progress.compressionPhase) {
        case 'compressing':
          return '正在压缩';
        case 'downloading':
          return '传输中';
        case 'extracting':
          return '正在解压';
        default:
          return '下载中';
      }
    }

    switch (currentTask.status) {
      case 'pending':
        return '准备中';
      case 'downloading':
        return '下载中';
      case 'paused':
        return '已暂停';
      case 'completed':
        return '已完成';
      case 'error':
        return '下载失败';
      case 'cancelled':
        return '已取消';
      default:
        return '未知状态';
    }
  };

  // 处理暂停
  const handlePause = async () => {
    try {
      await downloadService.pauseDownload(currentTask.id);
    } catch (error) {
      console.error('暂停下载失败:', error);
    }
  };

  // 处理恢复
  const handleResume = async () => {
    try {
      await downloadService.resumeDownload(currentTask.id);
    } catch (error) {
      console.error('恢复下载失败:', error);
    }
  };

  // 处理取消
  const handleCancel = async () => {
    try {
      await downloadService.cancelDownload(currentTask.id);
      onClose?.();
    } catch (error) {
      console.error('取消下载失败:', error);
    }
  };

  // 处理重试
  const handleRetry = async () => {
    try {
      await downloadService.startDownload(currentTask.file, currentTask.config);
      onClose?.();
    } catch (error) {
      console.error('重试下载失败:', error);
    }
  };

  // 渲染操作按钮
  const renderActions = () => {
    const actions = [];

    if (currentTask.status === 'downloading') {
      actions.push(
        <Button
          key="pause"
          type="text"
          size="small"
          icon={<PauseOutlined />}
          onClick={handlePause}
          title="暂停"
        />
      );
    }

    if (currentTask.status === 'paused') {
      actions.push(
        <Button
          key="resume"
          type="text"
          size="small"
          icon={<PlayCircleOutlined />}
          onClick={handleResume}
          title="恢复"
        />
      );
    }

    if (currentTask.status === 'error') {
      actions.push(
        <Button
          key="retry"
          type="text"
          size="small"
          onClick={handleRetry}
          title="重试"
        >
          重试
        </Button>
      );
    }

    if (['downloading', 'paused'].includes(currentTask.status)) {
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
    }

    if (['completed', 'error', 'cancelled'].includes(currentTask.status)) {
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
    <div className="download-notification">
      <div className="notification-header">
        <Space>
          {getStatusIcon()}
          <Text strong className="file-name">
            {currentTask.file.name}
          </Text>
        </Space>
        <Text type="secondary" className="status-text">
          {getStatusText()}
        </Text>
      </div>

      <div className="notification-content">
        {/* 进度条 */}
        <Progress
          percent={Math.round(currentTask.progress.percentage)}
          size="small"
          status={
            currentTask.status === 'error' ? 'exception' :
            currentTask.status === 'completed' ? 'success' : 'active'
          }
          showInfo={false}
        />

        {/* 进度信息 */}
        <div className="progress-info">
          <Space split={<span className="separator">•</span>} size="small">
            <Text type="secondary" className="progress-text">
              {formatFileSize(currentTask.progress.transferred)} / {formatFileSize(currentTask.progress.total)}
            </Text>
            
            {currentTask.status === 'downloading' && (
              <>
                <Text type="secondary" className="speed-text">
                  {formatSpeed(currentTask.progress.speed)}
                </Text>
                <Text type="secondary" className="time-text">
                  剩余: {formatRemainingTime(currentTask.progress.remainingTime)}
                </Text>
              </>
            )}
          </Space>
        </div>

        {/* 错误信息 */}
        {currentTask.status === 'error' && currentTask.error && (
          <div className="error-info">
            <Text type="danger" className="error-text">
              {currentTask.error}
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

export default DownloadNotification;
