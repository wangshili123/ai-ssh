/**
 * 下载进度显示组件
 */

import React from 'react';
import { Progress, Typography, Space, Button, Tag } from 'antd';
import { PauseOutlined, PlayCircleOutlined, CloseOutlined, CompressOutlined, DownloadOutlined, FileZipOutlined, ThunderboltOutlined } from '@ant-design/icons';
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

  // 获取状态颜色
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return '#1890ff'; // 蓝色 - 准备中
      case 'downloading':
        return '#1890ff'; // 蓝色 - 下载中
      case 'completed':
        return '#52c41a'; // 绿色 - 已完成
      case 'error':
        return '#ff4d4f'; // 红色 - 错误
      case 'paused':
        return '#faad14'; // 橙色 - 暂停
      case 'cancelled':
        return '#8c8c8c'; // 灰色 - 已取消
      default:
        return '#1890ff'; // 默认蓝色
    }
  };

  // 获取状态文本
  const getStatusText = (status: string, compressionPhase?: string): string => {
    if (status === 'downloading' && compressionPhase) {
      switch (compressionPhase) {
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

  // 获取压缩阶段文本和图标
  const getCompressionPhaseInfo = (phase?: string): { text: string; icon: React.ReactNode; color: string } => {
    switch (phase) {
      case 'compressing':
        return { text: '压缩中', icon: <CompressOutlined />, color: 'processing' };
      case 'downloading':
        return { text: '传输中', icon: <DownloadOutlined />, color: 'processing' };
      case 'extracting':
        return { text: '解压中', icon: <FileZipOutlined />, color: 'processing' };
      default:
        return { text: '', icon: null, color: '' };
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
          trailColor="#f0f0f0"
          showInfo={false}
          size="small"
          status={task.status === 'error' ? 'exception' : task.status === 'completed' ? 'success' : 'active'}
        />
        
        <div className="progress-info">
          <Space split={<span className="separator">•</span>}>
            <Text type="secondary" className="status-text">
              {getStatusText(task.status, task.progress.compressionPhase)}
            </Text>

            {/* 只在实际传输阶段显示速度和剩余时间 */}
            {task.status === 'downloading' && (!task.progress.compressionPhase || task.progress.compressionPhase === 'downloading') && (
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

      {/* 状态标签区域 - 独立一行 */}
      {(task.status === 'downloading' || task.compressionEnabled || task.parallelEnabled) && (
        <div className="status-tags-section">
          <Space size="small" wrap>
            {/* 压缩阶段显示 */}
            {task.status === 'downloading' && task.progress.compressionPhase && (
              <Tag
                icon={getCompressionPhaseInfo(task.progress.compressionPhase).icon}
                color={getCompressionPhaseInfo(task.progress.compressionPhase).color}
              >
                {getCompressionPhaseInfo(task.progress.compressionPhase).text}
              </Tag>
            )}

            {/* 并行下载状态显示 */}
            {task.status === 'downloading' && task.parallelEnabled && task.progress.downloadChunks && (
              <Tag
                icon={<ThunderboltOutlined />}
                color="blue"
              >
                并行 {task.progress.activeChunks || task.progress.downloadChunks.filter(c => c.status === 'downloading').length}/{task.maxParallelChunks}
              </Tag>
            )}

            {/* 优化效果显示 */}
            {task.compressionEnabled && task.progress.compressionRatio && task.progress.compressionRatio < 0.9 && (
              <Tag color="green">
                压缩节省 {((1 - task.progress.compressionRatio) * 100).toFixed(0)}%
              </Tag>
            )}

            {task.parallelEnabled && task.maxParallelChunks && task.maxParallelChunks > 1 && (
              <Tag color="blue">
                并行提速 {task.maxParallelChunks}x
              </Tag>
            )}
          </Space>
        </div>
      )}

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
