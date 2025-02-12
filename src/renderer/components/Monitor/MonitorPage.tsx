import React, { useEffect } from 'react';
import { Tabs } from 'antd';
import { MetricsPanel } from './Metrics/MetricsPanel';
import { metricsManager } from '../../services/monitor/metrics/metricsManager';
import { SessionInfo } from '../../types';
import './Monitor.css';

interface MonitorPageProps {
  session: SessionInfo;
}

export const MonitorPage: React.FC<MonitorPageProps> = ({ session }) => {
  useEffect(() => {
    // 初始化监控管理器
    metricsManager.initialize().catch(error => {
      console.error('Failed to initialize metrics manager:', error);
    });

    // 组件卸载时清理
    return () => {
      metricsManager.destroy();
    };
  }, [session.id]);

  const items = [
    {
      key: 'metrics',
      label: '系统监控',
      children: <MetricsPanel sessionId={session.id} />,
    },
    {
      key: 'process',
      label: '进程监控',
      children: <div>进程监控功能开发中...</div>,
    },
    {
      key: 'service',
      label: '服务监控',
      children: <div>服务监控功能开发中...</div>,
    },
    {
      key: 'log',
      label: '日志监控',
      children: <div>日志监控功能开发中...</div>,
    }
  ];

  return (
    <div className="monitor-page">
      <Tabs
        defaultActiveKey="metrics"
        items={items}
        type="card"
      />
    </div>
  );
}; 