/**
 * 下载通知管理器 - 管理多个下载通知的显示
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { downloadService, type DownloadTask } from '../../services/downloadService';
import DownloadNotification from './DownloadNotification';
import './DownloadNotificationManager.css';

interface NotificationItem {
  id: string;
  task: DownloadTask;
  timestamp: number;
}

export const DownloadNotificationManager: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    // 监听下载开始事件
    const handleDownloadStarted = (task: DownloadTask) => {
      setNotifications(prev => {
        // 检查是否已存在相同任务的通知
        const existingIndex = prev.findIndex(item => item.id === task.id);
        if (existingIndex >= 0) {
          // 更新现有通知
          const updated = [...prev];
          updated[existingIndex] = {
            id: task.id,
            task,
            timestamp: Date.now()
          };
          return updated;
        } else {
          // 添加新通知
          return [...prev, {
            id: task.id,
            task,
            timestamp: Date.now()
          }];
        }
      });
    };

    // 监听下载进度更新
    const handleDownloadProgress = (task: DownloadTask) => {
      setNotifications(prev => {
        const index = prev.findIndex(item => item.id === task.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            task
          };
          return updated;
        }
        return prev;
      });
    };

    // 监听下载完成事件
    const handleDownloadCompleted = (task: DownloadTask) => {
      setNotifications(prev => {
        const index = prev.findIndex(item => item.id === task.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            task
          };
          return updated;
        }
        return prev;
      });

      // 3秒后自动移除完成的通知
      setTimeout(() => {
        handleCloseNotification(task.id);
      }, 3000);
    };

    // 监听下载错误事件
    const handleDownloadError = (task: DownloadTask) => {
      setNotifications(prev => {
        const index = prev.findIndex(item => item.id === task.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            task
          };
          return updated;
        }
        return prev;
      });
    };

    // 监听下载取消事件
    const handleDownloadCancelled = (task: DownloadTask) => {
      // 立即移除取消的通知
      handleCloseNotification(task.id);
    };

    // 注册事件监听器
    downloadService.on('download-started', handleDownloadStarted);
    downloadService.on('download-progress', handleDownloadProgress);
    downloadService.on('download-completed', handleDownloadCompleted);
    downloadService.on('download-error', handleDownloadError);
    downloadService.on('download-cancelled', handleDownloadCancelled);
    downloadService.on('download-paused', handleDownloadProgress);
    downloadService.on('download-resumed', handleDownloadProgress);

    return () => {
      // 清理事件监听器
      downloadService.off('download-started', handleDownloadStarted);
      downloadService.off('download-progress', handleDownloadProgress);
      downloadService.off('download-completed', handleDownloadCompleted);
      downloadService.off('download-error', handleDownloadError);
      downloadService.off('download-cancelled', handleDownloadCancelled);
      downloadService.off('download-paused', handleDownloadProgress);
      downloadService.off('download-resumed', handleDownloadProgress);
    };
  }, []);

  // 关闭通知
  const handleCloseNotification = (taskId: string) => {
    setNotifications(prev => prev.filter(item => item.id !== taskId));
  };

  // 如果没有通知，不渲染任何内容
  if (notifications.length === 0) {
    return null;
  }

  // 创建通知容器
  const notificationContainer = (
    <div className="download-notification-manager">
      <div className="notification-list">
        {notifications.map((item, index) => (
          <div
            key={item.id}
            className="notification-item"
            style={{
              transform: `translateY(${index * 10}px)`,
              zIndex: 1000 - index
            }}
          >
            <DownloadNotification
              task={item.task}
              onClose={() => handleCloseNotification(item.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  // 使用 Portal 将通知渲染到 body
  return createPortal(notificationContainer, document.body);
};

export default DownloadNotificationManager;
