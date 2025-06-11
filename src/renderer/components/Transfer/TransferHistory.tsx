/**
 * 统一传输历史记录组件
 * 支持上传和下载历史的统一显示
 */

import React, { useState, useEffect } from 'react';
import { Modal, Table, Button, Space, Tag, Typography, Tabs } from 'antd';
import { HistoryOutlined, DownloadOutlined, UploadOutlined, DeleteOutlined } from '@ant-design/icons';
import { downloadService } from '../../services/downloadService';
import { uploadService } from '../../services/uploadService';
import type { TransferTask } from '../../services/transferService';
import { formatFileSize } from '../../utils/fileUtils';

const { Text } = Typography;
const { TabPane } = Tabs;

export interface TransferHistoryProps {
  visible: boolean;
  onClose: () => void;
  filterType?: 'all' | 'download' | 'upload';
}

const TransferHistory: React.FC<TransferHistoryProps> = ({
  visible,
  onClose,
  filterType = 'all'
}) => {
  const [tasks, setTasks] = useState<TransferTask[]>([]);
  const [activeTab, setActiveTab] = useState(filterType);

  useEffect(() => {
    if (visible) {
      loadHistory();
    }
  }, [visible]);

  const loadHistory = () => {
    const downloadTasks = downloadService.getAllTasks();
    const uploadTasks = uploadService.getAllTasks();
    const allTasks = [...downloadTasks, ...uploadTasks];
    
    // 只显示已完成、失败或取消的任务
    const historyTasks = allTasks.filter(task => 
      ['completed', 'error', 'cancelled'].includes(task.status)
    );
    
    // 按结束时间排序
    historyTasks.sort((a, b) => {
      const timeA = a.endTime?.getTime() || 0;
      const timeB = b.endTime?.getTime() || 0;
      return timeB - timeA;
    });
    
    setTasks(historyTasks);
  };

  const getFilteredTasks = () => {
    switch (activeTab) {
      case 'download':
        return tasks.filter(task => task.type === 'download');
      case 'upload':
        return tasks.filter(task => task.type === 'upload');
      default:
        return tasks;
    }
  };

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 80,
      render: (type: string) => (
        <Tag color={type === 'upload' ? 'green' : 'blue'}>
          {type === 'upload' ? <UploadOutlined /> : <DownloadOutlined />}
          {type === 'upload' ? '上传' : '下载'}
        </Tag>
      )
    },
    {
      title: '文件名',
      dataIndex: 'name',
      render: (_: any, record: TransferTask) => {
        if (record.type === 'download') {
          return record.file.name;
        } else {
          const fileCount = record.totalFiles || record.localFiles.length;
          return fileCount === 1 
            ? record.localFiles[0]?.name || '未知文件'
            : `${fileCount}个文件`;
        }
      }
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 100,
      render: (_: any, record: TransferTask) => {
        const size = record.type === 'download' 
          ? record.file.size 
          : record.progress.total;
        return formatFileSize(size);
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (status: string) => {
        const statusConfig = {
          completed: { color: 'success', text: '完成' },
          error: { color: 'error', text: '失败' },
          cancelled: { color: 'default', text: '取消' }
        };
        const config = statusConfig[status as keyof typeof statusConfig];
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '完成时间',
      dataIndex: 'endTime',
      width: 150,
      render: (endTime: Date) => {
        return endTime ? new Date(endTime).toLocaleString() : '--';
      }
    }
  ];

  return (
    <Modal
      title={
        <Space>
          <HistoryOutlined />
          <span>传输历史</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="clear" icon={<DeleteOutlined />} onClick={() => {}}>
          清空历史
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          关闭
        </Button>
      ]}
      width={800}
      className="transfer-history"
    >
      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as 'all' | 'download' | 'upload')}>
        <TabPane
          tab={
            <Space>
              <HistoryOutlined />
              <span>全部</span>
              <span>({tasks.length})</span>
            </Space>
          }
          key="all"
        />
        <TabPane
          tab={
            <Space>
              <DownloadOutlined />
              <span>下载</span>
              <span>({tasks.filter(t => t.type === 'download').length})</span>
            </Space>
          }
          key="download"
        />
        <TabPane
          tab={
            <Space>
              <UploadOutlined />
              <span>上传</span>
              <span>({tasks.filter(t => t.type === 'upload').length})</span>
            </Space>
          }
          key="upload"
        />
      </Tabs>

      <Table
        dataSource={getFilteredTasks()}
        columns={columns}
        rowKey="id"
        size="small"
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showQuickJumper: true
        }}
        scroll={{ y: 400 }}
      />
    </Modal>
  );
};

export default TransferHistory;
