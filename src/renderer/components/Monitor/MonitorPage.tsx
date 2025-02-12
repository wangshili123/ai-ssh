import React, { useState } from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import MonitorCpuDetails from './Details/MonitorCpuDetails';
import MonitorMemoryDetails from './Details/MonitorMemoryDetails';
import './MonitorPage.css';

interface MonitorPageProps {
  sessionId: string;
}

type MonitorTabKey = 'process' | 'performance' | 'app-history' | 'startup' | 'users' | 'details' | 'services';

export const MonitorPage: React.FC<MonitorPageProps> = ({ sessionId }) => {
  const [activeTab, setActiveTab] = useState<MonitorTabKey>('performance');

  const items: TabsProps['items'] = [
    {
      key: 'process',
      label: '进程',
      children: <div>进程页面（待实现）</div>,
    },
    {
      key: 'performance',
      label: '性能',
      children: (
        <div className="performance-container">
          <div className="performance-sidebar">
            <div className="resource-list">
              <MonitorCpuDetails sessionId={sessionId} />
              <MonitorMemoryDetails sessionId={sessionId} />
              {/* 后续添加磁盘、网络、GPU等资源监控 */}
            </div>
          </div>
          <div className="performance-details">
            {/* 右侧详细信息区域，将根据选中的资源显示对应的详情 */}
          </div>
        </div>
      ),
    },
    {
      key: 'app-history',
      label: '应用历史记录',
      children: <div>应用历史记录页面（待实现）</div>,
    },
    {
      key: 'startup',
      label: '启动',
      children: <div>启动页面（待实现）</div>,
    },
    {
      key: 'users',
      label: '用户',
      children: <div>用户页面（待实现）</div>,
    },
    {
      key: 'details',
      label: '详细信息',
      children: <div>详细信息页面（待实现）</div>,
    },
    {
      key: 'services',
      label: '服务',
      children: <div>服务页面（待实现）</div>,
    },
  ];

  return (
    <div className="monitor-page">
      <Tabs
        activeKey={activeTab}
        items={items}
        onChange={(key) => setActiveTab(key as MonitorTabKey)}
      />
    </div>
  );
}; 