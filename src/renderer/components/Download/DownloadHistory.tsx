/**
 * 下载历史组件
 */

import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Space, Tag, Typography, Tooltip, Progress, Empty } from 'antd';
import { 
  DownloadOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined, 
  CloseCircleOutlined,
  PauseCircleOutlined,
  FolderOpenOutlined,
  DeleteOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { downloadService, type DownloadTask } from '../../services/downloadService';
import { formatBytes, formatDuration } from '../../utils/format';
import './DownloadHistory.css';

const { Text } = Typography;
const { Column } = Table;

export interface DownloadHistoryProps {
  visible: boolean;
  onClose: () => void;
}

export const DownloadHistory: React.FC<DownloadHistoryProps> = ({
  visible,
  onClose
}) => {
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载下载历史
  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible]);

  // 监听下载事件
  useEffect(() => {
    const handleDownloadEvent = () => {
      if (visible) {
        loadHistory();
      }
    };

    downloadService.on('download-started', handleDownloadEvent);
    downloadService.on('download-progress', handleDownloadEvent);
    downloadService.on('download-completed', handleDownloadEvent);
    downloadService.on('download-error', handleDownloadEvent);
    downloadService.on('download-paused', handleDownloadEvent);
    downloadService.on('download-resumed', handleDownloadEvent);
    downloadService.on('download-cancelled', handleDownloadEvent);
    downloadService.on('tasks-cleared', handleDownloadEvent);

    return () => {
      downloadService.off('download-started', handleDownloadEvent);
      downloadService.off('download-progress', handleDownloadEvent);
      downloadService.off('download-completed', handleDownloadEvent);
      downloadService.off('download-error', handleDownloadEvent);
      downloadService.off('download-paused', handleDownloadEvent);
      downloadService.off('download-resumed', handleDownloadEvent);
      downloadService.off('download-cancelled', handleDownloadEvent);
      downloadService.off('tasks-cleared', handleDownloadEvent);
    };
  }, [visible]);

  // 加载历史记录
  const loadHistory = () => {
    setLoading(true);
    try {
      const allTasks = downloadService.getAllTasks();
      // 按开始时间倒序排列
      const sortedTasks = allTasks.sort((a, b) => {
        const timeA = a.startTime?.getTime() || 0;
        const timeB = b.startTime?.getTime() || 0;
        return timeB - timeA;
      });
      setTasks(sortedTasks);
    } finally {
      setLoading(false);
    }
  };

  // 获取状态标签
  const getStatusTag = (status: DownloadTask['status']) => {
    const statusConfig = {
      pending: { color: 'blue', icon: <DownloadOutlined />, text: '等待中' },
      downloading: { color: 'processing', icon: <DownloadOutlined />, text: '下载中' },
      paused: { color: 'warning', icon: <PauseCircleOutlined />, text: '已暂停' },
      completed: { color: 'success', icon: <CheckCircleOutlined />, text: '已完成' },
      error: { color: 'error', icon: <ExclamationCircleOutlined />, text: '失败' },
      cancelled: { color: 'default', icon: <CloseCircleOutlined />, text: '已取消' }
    };

    const config = statusConfig[status];
    return (
      <Tag color={config.color} icon={config.icon}>
        {config.text}
      </Tag>
    );
  };

  // 获取进度显示
  const getProgressDisplay = (task: DownloadTask) => {
    if (task.status === 'completed') {
      return <Progress percent={100} size="small" status="success" />;
    } else if (task.status === 'error' || task.status === 'cancelled') {
      return <Progress percent={task.progress.percentage} size="small" status="exception" />;
    } else {
      return <Progress percent={task.progress.percentage} size="small" />;
    }
  };

  // 获取下载速度和剩余时间
  const getSpeedAndTime = (task: DownloadTask) => {
    if (task.status === 'downloading' && task.progress.speed > 0) {
      const speed = formatBytes(task.progress.speed) + '/s';
      const remainingTime = formatDuration(task.progress.remainingTime);
      return `${speed} - 剩余 ${remainingTime}`;
    } else if (task.status === 'completed' && task.startTime && task.endTime) {
      const duration = task.endTime.getTime() - task.startTime.getTime();
      return `用时 ${formatDuration(Math.floor(duration / 1000))}`;
    }
    return '-';
  };

  // 重试下载
  const handleRetry = async (task: DownloadTask) => {
    try {
      await downloadService.startDownload(task.file, task.config);
    } catch (error) {
      console.error('重试下载失败:', error);
    }
  };

  // 打开文件夹
  const handleOpenFolder = async (task: DownloadTask) => {
    if (task.status === 'completed' && task.config.savePath) {
      try {
        const { ipcRenderer } = window.require('electron');
        await ipcRenderer.invoke('shell:show-item-in-folder', task.config.savePath);
      } catch (error) {
        console.error('打开文件夹失败:', error);
      }
    }
  };

  // 清除历史记录
  const handleClearHistory = () => {
    downloadService.clearCompletedTasks();
  };

  return (
    <Modal
      title={
        <Space>
          <DownloadOutlined />
          <span>下载历史</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="clear" icon={<DeleteOutlined />} onClick={handleClearHistory}>
          清除已完成
        </Button>,
        <Button key="refresh" icon={<ReloadOutlined />} onClick={loadHistory}>
          刷新
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>
      ]}
      width={900}
      className="download-history"
      destroyOnClose
    >
      <div className="download-history-content">
        {tasks.length === 0 ? (
          <Empty
            description="暂无下载历史"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            dataSource={tasks}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            size="small"
          >
            <Column
              title="文件名"
              dataIndex={['file', 'name']}
              key="fileName"
              ellipsis={{ showTitle: false }}
              render={(name: string, task: DownloadTask) => (
                <Tooltip title={`${name} (${formatBytes(task.file.size)})`}>
                  <Text strong>{name}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {formatBytes(task.file.size)}
                  </Text>
                </Tooltip>
              )}
            />
            <Column
              title="状态"
              dataIndex="status"
              key="status"
              width={100}
              render={(status: DownloadTask['status']) => getStatusTag(status)}
            />
            <Column
              title="进度"
              key="progress"
              width={150}
              render={(_, task: DownloadTask) => (
                <div>
                  {getProgressDisplay(task)}
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {formatBytes(task.progress.transferred)} / {formatBytes(task.progress.total)}
                  </Text>
                </div>
              )}
            />
            <Column
              title="速度/用时"
              key="speed"
              width={120}
              render={(_, task: DownloadTask) => (
                <Text style={{ fontSize: '12px' }}>
                  {getSpeedAndTime(task)}
                </Text>
              )}
            />
            <Column
              title="开始时间"
              dataIndex="startTime"
              key="startTime"
              width={120}
              render={(startTime: Date) => (
                <Text style={{ fontSize: '12px' }}>
                  {startTime ? startTime.toLocaleString() : '-'}
                </Text>
              )}
            />
            <Column
              title="操作"
              key="actions"
              width={100}
              render={(_, task: DownloadTask) => (
                <Space size="small">
                  {task.status === 'error' && (
                    <Tooltip title="重试">
                      <Button
                        type="text"
                        size="small"
                        icon={<ReloadOutlined />}
                        onClick={() => handleRetry(task)}
                      />
                    </Tooltip>
                  )}
                  {task.status === 'completed' && (
                    <Tooltip title="打开文件夹">
                      <Button
                        type="text"
                        size="small"
                        icon={<FolderOpenOutlined />}
                        onClick={() => handleOpenFolder(task)}
                      />
                    </Tooltip>
                  )}
                </Space>
              )}
            />
          </Table>
        )}
      </div>
    </Modal>
  );
};

export default DownloadHistory;
