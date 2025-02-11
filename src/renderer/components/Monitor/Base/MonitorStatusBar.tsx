import React from 'react';
import { Space, Tag } from 'antd';
import { 
  CheckCircleOutlined,
  DisconnectOutlined,
  LoadingOutlined,
  WarningOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { SessionInfo } from '../../../types';
import './MonitorStatusBar.css';

interface MonitorStatusBarProps {
  /** 当前会话 */
  session: SessionInfo;
}

/**
 * 获取状态标签配置
 */
const getStatusConfig = (status: SessionInfo['status']) => {
  switch (status) {
    case 'connected':
      return {
        icon: <CheckCircleOutlined />,
        color: 'success',
        text: '已连接'
      };
    case 'disconnected':
      return {
        icon: <DisconnectOutlined />,
        color: 'default',
        text: '已断开'
      };
    case 'connecting':
      return {
        icon: <LoadingOutlined />,
        color: 'processing',
        text: '连接中'
      };
    case 'error':
      return {
        icon: <WarningOutlined />,
        color: 'error',
        text: '连接错误'
      };
    case 'refreshing':
      return {
        icon: <SyncOutlined spin />,
        color: 'processing',
        text: '刷新中'
      };
    default:
      return {
        icon: <WarningOutlined />,
        color: 'warning',
        text: '未知状态'
      };
  }
};

/**
 * 监控状态栏组件
 */
export const MonitorStatusBar: React.FC<MonitorStatusBarProps> = ({ session }) => {
  const statusConfig = getStatusConfig(session.status);
  const lastUpdated = session.lastUpdated 
    ? new Date(session.lastUpdated).toLocaleString()
    : '未更新';

  return (
    <Space className="monitor-status-bar">
      <Tag icon={statusConfig.icon} color={statusConfig.color}>
        {statusConfig.text}
      </Tag>
      <span className="monitor-status-host">
        主机：{session.host}
      </span>
      <span className="monitor-status-user">
        用户：{session.username}
      </span>
      <span className="monitor-status-update">
        最后更新：{lastUpdated}
      </span>
      {session.error && (
        <span className="monitor-status-error">
          错误：{session.error}
        </span>
      )}
    </Space>
  );
}; 