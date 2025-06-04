/**
 * 下载进度显示组件
 */

import React from 'react';
import { Progress, Typography, Space, Button } from 'antd';
import { PauseOutlined, PlayCircleOutlined, CloseOutlined } from '@ant-design/icons';
import type { DownloadTask } from '../../services/downloadService';
import { formatFileSize } from '../../utils/fileUtils';
import './DownloadProgress.css';

const { Text } = Typography;

export interface DownloadProgressProps {
  task: DownloadTask;
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  task,
  onPause,
  onResume,
  onCancel
}) => {
  // 格式化速度
  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
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

  // 获取状态颜色
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'downloading':
        return '#1890ff';
      case 'completed':
        return '#52c41a';
      case 'error':
        return '#ff4d4f';
      case 'paused':
        return '#faad14';
      default:
        return '#8c8c8c';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string): string => {
    switch (status) {
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

  return (
    <div className="download-progress">
      <div className="download-header">
        <div className="file-info">
          <Text strong className="file-name">
            {task.file.name}
          </Text>
          <Text type="secondary" className="file-size">
            {formatFileSize(task.file.size)}
          </Text>
        </div>
        <div className="download-actions">
          {task.status === 'downloading' && onPause && (
            <Button
              type="text"
              size="small"
              icon={<PauseOutlined />}
              onClick={() => onPause(task.id)}
              className="action-button"
            />
          )}
          {task.status === 'paused' && onResume && (
            <Button
              type="text"
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={() => onResume(task.id)}
              className="action-button"
            />
          )}
          {(task.status === 'downloading' || task.status === 'paused') && onCancel && (
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => onCancel(task.id)}
              className="action-button cancel-button"
            />
          )}
        </div>
      </div>

      <div className="progress-section">
        <Progress
          percent={Math.round(task.progress.percentage)}
          strokeColor={getStatusColor(task.status)}
          showInfo={false}
          size="small"
        />
        
        <div className="progress-info">
          <Space split={<span className="separator">•</span>}>
            <Text type="secondary" className="status-text">
              {getStatusText(task.status)}
            </Text>
            
            {task.status === 'downloading' && (
              <>
                <Text type="secondary">
                  {formatSpeed(task.progress.speed)}
                </Text>
                <Text type="secondary">
                  剩余: {formatRemainingTime(task.progress.remainingTime)}
                </Text>
              </>
            )}
            
            <Text type="secondary">
              {formatFileSize(task.progress.transferred)} / {formatFileSize(task.progress.total)}
            </Text>
          </Space>
        </div>
      </div>

      {task.status === 'error' && task.error && (
        <div className="error-message">
          <Text type="danger" className="error-text">
            错误: {task.error}
          </Text>
        </div>
      )}
    </div>
  );
};

export default DownloadProgress;
