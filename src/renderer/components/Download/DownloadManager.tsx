/**
 * 下载管理器组件
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button, Empty, Typography, Space, Divider } from 'antd';
import { DownloadOutlined, PauseOutlined, PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import { downloadService, type DownloadTask } from '../../services/downloadService';
import DownloadProgress from './DownloadProgress';
import './DownloadManager.css';

const { Title, Text } = Typography;

export interface DownloadManagerProps {
  visible: boolean;
  onClose: () => void;
}

export const DownloadManager: React.FC<DownloadManagerProps> = ({
  visible,
  onClose
}) => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  // 加载下载任务
  useEffect(() => {
    if (visible) {
      loadTasks();
    }
  }, [visible]);

  // 监听下载事件
  useEffect(() => {
    const handleDownloadEvent = () => {
      loadTasks();
    };

    downloadService.on('download-started', handleDownloadEvent);
    downloadService.on('download-progress', handleDownloadEvent);
    downloadService.on('download-completed', handleDownloadEvent);
    downloadService.on('download-error', handleDownloadEvent);
    downloadService.on('download-paused', handleDownloadEvent);
    downloadService.on('download-resumed', handleDownloadEvent);
    downloadService.on('download-cancelled', handleDownloadEvent);

    return () => {
      downloadService.off('download-started', handleDownloadEvent);
      downloadService.off('download-progress', handleDownloadEvent);
      downloadService.off('download-completed', handleDownloadEvent);
      downloadService.off('download-error', handleDownloadEvent);
      downloadService.off('download-paused', handleDownloadEvent);
      downloadService.off('download-resumed', handleDownloadEvent);
      downloadService.off('download-cancelled', handleDownloadEvent);
    };
  }, []);

  // 加载任务列表
  const loadTasks = () => {
    const allTasks = downloadService.getAllTasks();
    setTasks(allTasks);
  };

  // 暂停下载
  const handlePause = async (taskId: string) => {
    try {
      await downloadService.pauseDownload(taskId);
    } catch (error) {
      console.error('暂停下载失败:', error);
    }
  };

  // 恢复下载
  const handleResume = async (taskId: string) => {
    try {
      await downloadService.resumeDownload(taskId);
    } catch (error) {
      console.error('恢复下载失败:', error);
    }
  };

  // 取消下载
  const handleCancel = async (taskId: string) => {
    try {
      await downloadService.cancelDownload(taskId);
    } catch (error) {
      console.error('取消下载失败:', error);
    }
  };

  // 全部暂停
  const handlePauseAll = async () => {
    const activeTasks = tasks.filter(task => task.status === 'downloading');
    for (const task of activeTasks) {
      await handlePause(task.id);
    }
  };

  // 全部恢复
  const handleResumeAll = async () => {
    const pausedTasks = tasks.filter(task => task.status === 'paused');
    for (const task of pausedTasks) {
      await handleResume(task.id);
    }
  };

  // 清除已完成的任务
  const handleClearCompleted = () => {
    // 这里可以实现清除已完成任务的逻辑
    console.log('清除已完成的任务');
  };

  // 获取统计信息
  const getStats = () => {
    const total = tasks.length;
    const downloading = tasks.filter(task => task.status === 'downloading').length;
    const completed = tasks.filter(task => task.status === 'completed').length;
    const failed = tasks.filter(task => task.status === 'error').length;
    const paused = tasks.filter(task => task.status === 'paused').length;

    return { total, downloading, completed, failed, paused };
  };

  const stats = getStats();

  return (
    <Modal
      title={
        <Space>
          <DownloadOutlined />
          <span>下载管理</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="clear" onClick={handleClearCompleted}>
          清除已完成
        </Button>,
        <Button key="pause-all" icon={<PauseOutlined />} onClick={handlePauseAll}>
          全部暂停
        </Button>,
        <Button key="resume-all" icon={<PlayCircleOutlined />} onClick={handleResumeAll}>
          全部恢复
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>
      ]}
      width={600}
      className="download-manager"
      destroyOnClose
    >
      <div className="download-manager-content">
        {/* 统计信息 */}
        <div className="download-stats">
          <Space split={<Divider type="vertical" />}>
            <Text>
              总计: <Text strong>{stats.total}</Text>
            </Text>
            <Text>
              下载中: <Text strong style={{ color: '#1890ff' }}>{stats.downloading}</Text>
            </Text>
            <Text>
              已完成: <Text strong style={{ color: '#52c41a' }}>{stats.completed}</Text>
            </Text>
            {stats.paused > 0 && (
              <Text>
                已暂停: <Text strong style={{ color: '#faad14' }}>{stats.paused}</Text>
              </Text>
            )}
            {stats.failed > 0 && (
              <Text>
                失败: <Text strong style={{ color: '#ff4d4f' }}>{stats.failed}</Text>
              </Text>
            )}
          </Space>
        </div>

        <Divider />

        {/* 下载任务列表 */}
        <div className="download-tasks">
          {tasks.length === 0 ? (
            <Empty
              description="暂无下载任务"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div className="task-list">
              {tasks.map(task => (
                <DownloadProgress
                  key={task.id}
                  task={task}
                  onPause={handlePause}
                  onResume={handleResume}
                  onCancel={handleCancel}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default DownloadManager;
