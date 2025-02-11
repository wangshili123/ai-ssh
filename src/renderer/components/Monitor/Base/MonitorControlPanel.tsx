import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import { 
  ReloadOutlined, 
  PauseOutlined, 
  PlayCircleOutlined,
  SettingOutlined,
  ExportOutlined
} from '@ant-design/icons';
import { SessionInfo } from '../../../types';
import './MonitorControlPanel.css';

interface MonitorControlPanelProps {
  /** 当前会话 */
  session: SessionInfo;
}

/**
 * 监控控制面板组件
 */
export const MonitorControlPanel: React.FC<MonitorControlPanelProps> = ({ session }) => {
  const isConnected = session.status === 'connected';
  const isRefreshing = session.status === 'refreshing';
  const isAutoRefresh = session.config?.autoRefresh;

  // 刷新数据
  const handleRefresh = () => {
    // TODO: 实现数据刷新
  };

  // 切换自动刷新
  const handleToggleAutoRefresh = () => {
    // TODO: 实现自动刷新切换
  };

  // 打开设置
  const handleOpenSettings = () => {
    // TODO: 实现设置弹窗
  };

  // 导出数据
  const handleExport = () => {
    // TODO: 实现数据导出
  };

  return (
    <Space className="monitor-control-panel">
      <Tooltip title="刷新数据">
        <Button
          icon={<ReloadOutlined spin={isRefreshing} />}
          onClick={handleRefresh}
          disabled={!isConnected}
        />
      </Tooltip>
      <Tooltip title={isAutoRefresh ? "停止自动刷新" : "开始自动刷新"}>
        <Button
          icon={isAutoRefresh ? <PauseOutlined /> : <PlayCircleOutlined />}
          onClick={handleToggleAutoRefresh}
          disabled={!isConnected}
        />
      </Tooltip>
      <Tooltip title="监控设置">
        <Button
          icon={<SettingOutlined />}
          onClick={handleOpenSettings}
        />
      </Tooltip>
      <Tooltip title="导出数据">
        <Button
          icon={<ExportOutlined />}
          onClick={handleExport}
          disabled={!isConnected}
        />
      </Tooltip>
    </Space>
  );
}; 