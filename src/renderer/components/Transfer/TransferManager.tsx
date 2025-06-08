/**
 * 统一传输管理器组件
 * 支持上传和下载任务的统一管理，基于 DownloadManager 重构
 */

import React, { useState, useEffect } from 'react';
import { Modal, Button, Empty, Typography, Space, Divider, Tabs } from 'antd';
import { 
  SwapOutlined, 
  DownloadOutlined, 
  UploadOutlined,
  PauseOutlined, 
  PlayCircleOutlined, 
  DeleteOutlined 
} from '@ant-design/icons';
import { downloadService } from '../../services/downloadService';
import { uploadService } from '../../services/uploadService';
import type { TransferTask } from '../../services/transferService';
import TransferProgress from './TransferProgress';
import './TransferManager.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export interface TransferManagerProps {
  visible: boolean;
  onClose: () => void;
  defaultTab?: 'all' | 'download' | 'upload';
}

export const TransferManager: React.FC<TransferManagerProps> = ({
  visible,
  onClose,
  defaultTab = 'all'
}) => {
  const [tasks, setTasks] = useState<TransferTask[]>([]);
  const [activeTab, setActiveTab] = useState(defaultTab);

  // 加载传输任务
  useEffect(() => {
    if (visible) {
      loadTasks();
    }
  }, [visible]);

  // 监听传输事件
  useEffect(() => {
    const handleTransferEvent = (eventName: string) => {
      return (data: any) => {
        console.log(`[TransferManager] 接收到事件: ${eventName}, 数据:`, data);
        loadTasks();
      };
    };

    // 监听下载事件
    downloadService.on('download-started', handleTransferEvent('download-started'));
    downloadService.on('download-progress', handleTransferEvent('download-progress'));
    downloadService.on('download-completed', handleTransferEvent('download-completed'));
    downloadService.on('download-error', handleTransferEvent('download-error'));
    downloadService.on('download-paused', handleTransferEvent('download-paused'));
    downloadService.on('download-resumed', handleTransferEvent('download-resumed'));
    downloadService.on('download-cancelled', handleTransferEvent('download-cancelled'));

    // 监听上传事件
    uploadService.on('upload-started', handleTransferEvent('upload-started'));
    uploadService.on('upload-progress', handleTransferEvent('upload-progress'));
    uploadService.on('upload-completed', handleTransferEvent('upload-completed'));
    uploadService.on('upload-error', handleTransferEvent('upload-error'));
    uploadService.on('upload-paused', handleTransferEvent('upload-paused'));
    uploadService.on('upload-resumed', handleTransferEvent('upload-resumed'));
    uploadService.on('upload-cancelled', handleTransferEvent('upload-cancelled'));

    return () => {
      // 清理下载事件监听
      downloadService.off('download-started', handleTransferEvent('download-started'));
      downloadService.off('download-progress', handleTransferEvent('download-progress'));
      downloadService.off('download-completed', handleTransferEvent('download-completed'));
      downloadService.off('download-error', handleTransferEvent('download-error'));
      downloadService.off('download-paused', handleTransferEvent('download-paused'));
      downloadService.off('download-resumed', handleTransferEvent('download-resumed'));
      downloadService.off('download-cancelled', handleTransferEvent('download-cancelled'));

      // 清理上传事件监听
      uploadService.off('upload-started', handleTransferEvent('upload-started'));
      uploadService.off('upload-progress', handleTransferEvent('upload-progress'));
      uploadService.off('upload-completed', handleTransferEvent('upload-completed'));
      uploadService.off('upload-error', handleTransferEvent('upload-error'));
      uploadService.off('upload-paused', handleTransferEvent('upload-paused'));
      uploadService.off('upload-resumed', handleTransferEvent('upload-resumed'));
      uploadService.off('upload-cancelled', handleTransferEvent('upload-cancelled'));
    };
  }, []);

  // 加载任务列表
  const loadTasks = () => {
    const downloadTasks = downloadService.getAllTasks();
    const uploadTasks = uploadService.getAllTasks();
    const allTasks = [...downloadTasks, ...uploadTasks];

    console.log(`[TransferManager] 加载任务列表: 下载=${downloadTasks.length}, 上传=${uploadTasks.length}`);
    console.log(`[TransferManager] 上传任务状态:`, uploadTasks.map(t => ({ id: t.id, status: t.status, name: t.localFiles?.[0]?.name })));

    // 按开始时间排序，最新的在前
    allTasks.sort((a, b) => {
      const timeA = a.startTime?.getTime() || 0;
      const timeB = b.startTime?.getTime() || 0;
      return timeB - timeA;
    });

    setTasks(allTasks);
  };

  // 暂停传输
  const handlePause = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.type === 'download') {
        await downloadService.pauseTransfer(taskId);
      } else {
        await uploadService.pauseTransfer(taskId);
      }
    } catch (error) {
      console.error('暂停传输失败:', error);
    }
  };

  // 恢复传输
  const handleResume = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.type === 'download') {
        await downloadService.resumeTransfer(taskId);
      } else {
        await uploadService.resumeTransfer(taskId);
      }
    } catch (error) {
      console.error('恢复传输失败:', error);
    }
  };

  // 取消传输
  const handleCancel = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      if (task.type === 'download') {
        await downloadService.cancelTransfer(taskId);
      } else {
        await uploadService.cancelTransfer(taskId);
      }
    } catch (error) {
      console.error('取消传输失败:', error);
    }
  };

  // 全部暂停
  const handlePauseAll = async () => {
    const activeTasks = getFilteredTasks().filter(task => 
      task.status === 'downloading' || task.status === 'uploading'
    );
    for (const task of activeTasks) {
      await handlePause(task.id);
    }
  };

  // 全部恢复
  const handleResumeAll = async () => {
    const pausedTasks = getFilteredTasks().filter(task => task.status === 'paused');
    for (const task of pausedTasks) {
      await handleResume(task.id);
    }
  };

  // 清除已完成的任务
  const handleClearCompleted = () => {
    downloadService.clearCompletedTasks();
    uploadService.clearCompletedTasks();
  };

  // 根据当前标签页过滤任务
  const getFilteredTasks = (): TransferTask[] => {
    switch (activeTab) {
      case 'download':
        return tasks.filter(task => task.type === 'download');
      case 'upload':
        return tasks.filter(task => task.type === 'upload');
      default:
        return tasks;
    }
  };

  // 获取统计信息
  const getStats = (taskList: TransferTask[]) => {
    const total = taskList.length;
    const active = taskList.filter(task => 
      task.status === 'downloading' || task.status === 'uploading'
    ).length;
    const completed = taskList.filter(task => task.status === 'completed').length;
    const failed = taskList.filter(task => task.status === 'error').length;
    const paused = taskList.filter(task => task.status === 'paused').length;

    return { total, active, completed, failed, paused };
  };

  const filteredTasks = getFilteredTasks();
  const stats = getStats(filteredTasks);
  const allStats = getStats(tasks);

  return (
    <Modal
      title={
        <Space>
          <SwapOutlined />
          <span>传输管理</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="clear" onClick={handleClearCompleted}>
          清除已完成
        </Button>,
        // <Button key="pause-all" icon={<PauseOutlined />} onClick={handlePauseAll}>
        //   全部暂停
        // </Button>,
        // <Button key="resume-all" icon={<PlayCircleOutlined />} onClick={handleResumeAll}>
        //   全部恢复
        // </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>
      ]}
      width={700}
      className="transfer-manager-modal"
      destroyOnClose
    >
      <div className="transfer-manager-content">
        {/* 标签页 */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'all' | 'download' | 'upload')}
          className="transfer-manager-tabs"
        >
          <TabPane
            tab={
              <Space>
                <SwapOutlined />
                <span>全部</span>
                {allStats.total > 0 && <span>({allStats.total})</span>}
              </Space>
            }
            key="all"
          />
          <TabPane
            tab={
              <Space>
                <DownloadOutlined />
                <span>下载</span>
                {tasks.filter(t => t.type === 'download').length > 0 && 
                  <span>({tasks.filter(t => t.type === 'download').length})</span>
                }
              </Space>
            }
            key="download"
          />
          <TabPane
            tab={
              <Space>
                <UploadOutlined />
                <span>上传</span>
                {tasks.filter(t => t.type === 'upload').length > 0 && 
                  <span>({tasks.filter(t => t.type === 'upload').length})</span>
                }
              </Space>
            }
            key="upload"
          />
        </Tabs>

        {/* 统计信息 */}
        <div className="transfer-manager-stats">
          <Space split={<Divider type="vertical" />}>
            <Text>
              总计: <Text strong>{stats.total}</Text>
            </Text>
            <Text>
              传输中: <Text strong style={{ color: '#1890ff' }}>{stats.active}</Text>
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

        {/* 传输任务列表 */}
        <div className="transfer-manager-tasks">
          {filteredTasks.length === 0 ? (
            <Empty
              description={`暂无${activeTab === 'all' ? '传输' : activeTab === 'download' ? '下载' : '上传'}任务`}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div className="transfer-manager-task-list">
              {filteredTasks.map(task => (
                <TransferProgress
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

export default TransferManager;
