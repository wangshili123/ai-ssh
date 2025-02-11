import React, { useEffect, useState } from 'react';
import { Tabs } from 'antd';
import { SessionInfo } from '../../types';
import { MonitorLayout } from './Base/MonitorLayout';
import { MonitorManager } from '../../services/monitor/monitorManager';
import './MonitorTab.css';

const { TabPane } = Tabs;

interface MonitorTabProps {
  /** 会话ID */
  sessionId: string;
  /** 关闭回调 */
  onClose?: () => void;
}

/**
 * 监控标签页组件
 */
export const MonitorTab: React.FC<MonitorTabProps> = ({ sessionId, onClose }) => {
  const [session, setSession] = useState<SessionInfo>();
  const [activeKey, setActiveKey] = useState('process');

  useEffect(() => {
    const monitorManager = MonitorManager.getInstance();
    const currentSession = monitorManager.getSession(sessionId);
    
    if (currentSession) {
      setSession(currentSession);
      // 连接会话
      monitorManager.connectSession(sessionId).catch(console.error);
    }

    return () => {
      // 组件卸载时断开连接
      if (currentSession) {
        monitorManager.disconnectSession(sessionId);
      }
    };
  }, [sessionId]);

  if (!session) {
    return null;
  }

  return (
    <MonitorLayout session={session}>
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        type="card"
        className="monitor-tabs"
      >
        <TabPane tab="进程" key="process">
          {/* TODO: 进程监控组件 */}
        </TabPane>
        <TabPane tab="性能" key="performance">
          {/* TODO: 性能监控组件 */}
        </TabPane>
        <TabPane tab="服务" key="service">
          {/* TODO: 服务监控组件 */}
        </TabPane>
        <TabPane tab="用户" key="user">
          {/* TODO: 用户监控组件 */}
        </TabPane>
      </Tabs>
    </MonitorLayout>
  );
}; 