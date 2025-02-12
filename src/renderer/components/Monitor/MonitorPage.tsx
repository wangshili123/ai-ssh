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

  // 根据会话配置获取默认标签页
  const defaultTab = session.config?.defaultPage || 'process';

  const items = [
    {
      key: 'process',
      label: '进程',
      children: <div>进程监控功能开发中...</div>,
    },
    {
      key: 'performance',
      label: '性能',
      children: <MetricsPanel sessionId={session.id} />,
    },
    {
      key: 'history',
      label: '应用历史记录',
      children: <div>应用历史记录功能开发中...</div>,
    },
    {
      key: 'startup',
      label: '启动',
      children: <div>启动管理功能开发中...</div>,
    },
    {
      key: 'user',
      label: '用户',
      children: <div>用户管理功能开发中...</div>,
    },
    {
      key: 'detail',
      label: '详细信息',
      children: <div>详细信息功能开发中...</div>,
    },
    {
      key: 'service',
      label: '服务',
      children: <div>服务管理功能开发中...</div>,
    }
  ];

  return (
    <div className="monitor-page">
      <Tabs
        defaultActiveKey={defaultTab}
        items={items}
        type="card"
        animated={false}
        size="small"
        tabBarStyle={{
          marginBottom: 0,
          padding: '8px 16px 0',
          backgroundColor: '#f0f2f5',
        }}
      />
    </div>
  );
}; 