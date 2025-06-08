/**
 * 统一传输进度显示组件
 * 支持上传和下载的进度显示，基于 DownloadProgress 重构
 */

import React from 'react';
import { Progress, Typography, Space, Button, Tag } from 'antd';
import { 
  PauseOutlined, 
  PlayCircleOutlined, 
  CloseOutlined, 
  CompressOutlined, 
  DownloadOutlined, 
  UploadOutlined,
  FileZipOutlined, 
  ThunderboltOutlined,
  FileOutlined,
  FolderOutlined
} from '@ant-design/icons';
import type { TransferTask } from '../../services/transferService';
import { formatFileSize } from '../../utils/fileUtils';
import './TransferProgress.css';

const { Text } = Typography;

export interface TransferProgressProps {
  task: TransferTask;
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
}

export const TransferProgress: React.FC<TransferProgressProps> = ({
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

  // 获取状态颜色
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'downloading':
      case 'uploading':
        return '#1890ff';
      case 'completed':
        return '#52c41a';
      case 'error':
        return '#ff4d4f';
      case 'paused':
        return '#faad14';
      case 'cancelled':
        return '#8c8c8c';
      default:
        return '#d9d9d9';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string, compressionPhase?: string): string => {
    const isUpload = task.type === 'upload';
    const baseAction = isUpload ? '上传' : '下载';
    
    switch (status) {
      case 'pending':
        return `等待${baseAction}`;
      case 'downloading':
      case 'uploading':
        if (compressionPhase) {
          switch (compressionPhase) {
            case 'compressing':
              return isUpload ? '压缩中' : '远程压缩中';
            case 'transferring':
              return `${baseAction}中`;
            case 'extracting':
              return isUpload ? '远程解压中' : '解压中';
            default:
              return `${baseAction}中`;
          }
        }
        return `${baseAction}中`;
      case 'paused':
        return `${baseAction}已暂停`;
      case 'completed':
        return `${baseAction}完成`;
      case 'error':
        return `${baseAction}失败`;
      case 'cancelled':
        return `${baseAction}已取消`;
      default:
        return status;
    }
  };

  // 获取压缩阶段信息
  const getCompressionPhaseInfo = (phase: string) => {
    switch (phase) {
      case 'compressing':
        return {
          icon: <CompressOutlined />,
          color: 'processing',
          text: task.type === 'upload' ? '压缩中' : '远程压缩中'
        };
      case 'transferring':
        return {
          icon: task.type === 'upload' ? <UploadOutlined /> : <DownloadOutlined />,
          color: 'processing',
          text: task.type === 'upload' ? '上传中' : '下载中'
        };
      case 'extracting':
        return {
          icon: <FileZipOutlined />,
          color: 'processing',
          text: task.type === 'upload' ? '远程解压中' : '解压中'
        };
      default:
        return {
          icon: <FileZipOutlined />,
          color: 'default',
          text: '处理中'
        };
    }
  };

  // 获取文件信息显示
  const getFileInfo = () => {
    if (task.type === 'download') {
      return {
        name: task.file.name,
        size: task.file.size,
        icon: <FileOutlined />
      };
    } else {
      // 上传任务
      const totalFiles = task.totalFiles || task.localFiles.length;
      if (totalFiles === 1) {
        return {
          name: task.localFiles[0]?.name || task.currentFile?.name || '未知文件',
          size: task.localFiles[0]?.size || task.currentFile?.size || 0,
          icon: <FileOutlined />
        };
      } else {
        return {
          name: `${totalFiles}个文件`,
          size: task.progress.total,
          icon: <FolderOutlined />,
          extra: task.progress.currentFileName ? `当前: ${task.progress.currentFileName}` : undefined
        };
      }
    }
  };

  // 获取传输图标
  const getTransferIcon = () => {
    return task.type === 'upload' ? <UploadOutlined /> : <DownloadOutlined />;
  };

  const fileInfo = getFileInfo();
  const isActive = task.status === 'downloading' || task.status === 'uploading';
  const canPause = isActive && onPause;
  const canResume = task.status === 'paused' && onResume;
  const canCancel = (isActive || task.status === 'paused') && onCancel;

  return (
    <div 
      className={`transfer-progress transfer-${task.type}`}
      data-status={task.status}
    >
      <div className="transfer-header">
        <div className="file-info">
          <div className="file-name-row">
            <Space size="small">
              {getTransferIcon()}
              {fileInfo.icon}
              <Text strong className="file-name">
                {fileInfo.name}
              </Text>
            </Space>
          </div>
          <div className="file-details">
            <Text type="secondary" className="file-size">
              {formatFileSize(fileInfo.size)}
            </Text>
            {fileInfo.extra && (
              <Text type="secondary" className="file-extra">
                {fileInfo.extra}
              </Text>
            )}
          </div>
        </div>
        <div className="transfer-actions">
          {/* 暂停/恢复按钮已隐藏 - 简化用户体验 */}
          {canCancel && (
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => onCancel(task.id)}
              className="action-button cancel-button"
              title="取消"
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
            {isActive && (!task.progress.compressionPhase || task.progress.compressionPhase === 'transferring') && (
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

            {/* 上传特有：文件进度 */}
            {task.type === 'upload' && task.progress.filesTotal && task.progress.filesTotal > 1 && (
              <Text type="secondary">
                {task.progress.filesCompleted || 0}/{task.progress.filesTotal}
              </Text>
            )}
          </Space>
        </div>
      </div>

      {/* 状态标签区域 */}
      {(isActive || task.compressionEnabled || task.parallelEnabled) && (
        <div className="status-tags-section">
          <Space size="small" wrap>
            {/* 压缩阶段显示 */}
            {isActive && task.progress.compressionPhase && (
              <Tag
                icon={getCompressionPhaseInfo(task.progress.compressionPhase).icon}
                color={getCompressionPhaseInfo(task.progress.compressionPhase).color}
              >
                {getCompressionPhaseInfo(task.progress.compressionPhase).text}
              </Tag>
            )}

            {/* 并行传输状态显示 */}
            {isActive && task.parallelEnabled && task.progress.transferChunks && (
              <Tag
                icon={<ThunderboltOutlined />}
                color="blue"
              >
                并行 {task.progress.activeChunks || task.progress.transferChunks.filter(c => c.status === 'transferring').length}/{task.maxParallelChunks}
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

      {/* 错误信息显示 */}
      {task.status === 'error' && task.error && (
        <div className="error-message">
          <Text className="error-text">
            {task.error}
          </Text>
        </div>
      )}
    </div>
  );
};

export default TransferProgress;
