/**
 * 统一传输通知管理器
 * 管理上传和下载通知的显示
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { downloadService } from '../../services/downloadService';
import { uploadService } from '../../services/uploadService';
import type { TransferTask } from '../../services/transferService';
import TransferNotification from './TransferNotification';
import './TransferNotificationManager.css';

interface NotificationItem {
  id: string;
  task: TransferTask;
  timestamp: number;
}

export const TransferNotificationManager: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    // 监听下载事件
    const handleDownloadStarted = (task: TransferTask) => {
      addNotification(task);
    };

    const handleDownloadProgress = (task: TransferTask) => {
      updateNotification(task);
    };

    const handleDownloadCompleted = (task: TransferTask) => {
      updateNotification(task);
      // 3秒后自动移除完成的通知
      setTimeout(() => {
        removeNotification(task.id);
      }, 3000);
    };

    const handleDownloadError = (task: TransferTask) => {
      updateNotification(task);
    };

    const handleDownloadPaused = (task: TransferTask) => {
      updateNotification(task);
    };

    const handleDownloadResumed = (task: TransferTask) => {
      updateNotification(task);
    };

    // 监听上传事件
    const handleUploadStarted = (task: TransferTask) => {
      addNotification(task);
    };

    const handleUploadProgress = (task: TransferTask) => {
      updateNotification(task);
    };

    const handleUploadCompleted = (task: TransferTask) => {
      updateNotification(task);
      // 3秒后自动移除完成的通知
      setTimeout(() => {
        removeNotification(task.id);
      }, 3000);
    };

    const handleUploadError = (task: TransferTask) => {
      updateNotification(task);
    };

    const handleUploadPaused = (task: TransferTask) => {
      updateNotification(task);
    };

    const handleUploadResumed = (task: TransferTask) => {
      updateNotification(task);
    };

    // 注册下载事件监听
    downloadService.on('download-started', handleDownloadStarted);
    downloadService.on('download-progress', handleDownloadProgress);
    downloadService.on('download-completed', handleDownloadCompleted);
    downloadService.on('download-error', handleDownloadError);
    downloadService.on('download-paused', handleDownloadPaused);
    downloadService.on('download-resumed', handleDownloadResumed);

    // 注册上传事件监听
    uploadService.on('upload-started', handleUploadStarted);
    uploadService.on('upload-progress', handleUploadProgress);
    uploadService.on('upload-completed', handleUploadCompleted);
    uploadService.on('upload-error', handleUploadError);
    uploadService.on('upload-paused', handleUploadPaused);
    uploadService.on('upload-resumed', handleUploadResumed);

    return () => {
      // 清理下载事件监听
      downloadService.off('download-started', handleDownloadStarted);
      downloadService.off('download-progress', handleDownloadProgress);
      downloadService.off('download-completed', handleDownloadCompleted);
      downloadService.off('download-error', handleDownloadError);
      downloadService.off('download-paused', handleDownloadPaused);
      downloadService.off('download-resumed', handleDownloadResumed);

      // 清理上传事件监听
      uploadService.off('upload-started', handleUploadStarted);
      uploadService.off('upload-progress', handleUploadProgress);
      uploadService.off('upload-completed', handleUploadCompleted);
      uploadService.off('upload-error', handleUploadError);
      uploadService.off('upload-paused', handleUploadPaused);
      uploadService.off('upload-resumed', handleUploadResumed);
    };
  }, []);

  const addNotification = (task: TransferTask) => {
    setNotifications(prev => {
      // 检查是否已存在
      const exists = prev.some(item => item.id === task.id);
      if (exists) return prev;

      const newItem: NotificationItem = {
        id: task.id,
        task,
        timestamp: Date.now()
      };

      // 最多显示5个通知
      const updated = [newItem, ...prev].slice(0, 5);
      return updated;
    });
  };

  const updateNotification = (task: TransferTask) => {
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

  const removeNotification = (taskId: string) => {
    setNotifications(prev => prev.filter(item => item.id !== taskId));
  };

  // 创建通知容器
  const notificationContainer = (
    <div className="transfer-notification-manager">
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
            <TransferNotification
              task={item.task}
              onClose={() => removeNotification(item.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  // 使用 Portal 将通知渲染到 body
  return createPortal(notificationContainer, document.body);
};

export default TransferNotificationManager;
