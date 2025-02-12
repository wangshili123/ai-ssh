import React from 'react';
import { Tabs } from 'antd';
import { PerformancePage } from './Performance/PerformancePage';
import './MonitorPage.css';

interface MonitorPageProps {
  sessionId: string;
}

const { TabPane } = Tabs;

export const MonitorPage: React.FC<MonitorPageProps> = ({ sessionId }) => {
  return (
    <div className="monitor-page">
      <Tabs defaultActiveKey="performance">
        <TabPane tab="性能监控" key="performance">
          <PerformancePage sessionId={sessionId} />
        </TabPane>
        <TabPane tab="进程管理" key="process">
          {/* 进程管理页面将在后续实现 */}
        </TabPane>
        <TabPane tab="服务管理" key="service">
          {/* 服务管理页面将在后续实现 */}
        </TabPane>
        <TabPane tab="用户管理" key="user">
          {/* 用户管理页面将在后续实现 */}
        </TabPane>
      </Tabs>
    </div>
  );
}; 