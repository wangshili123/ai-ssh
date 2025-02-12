import React, { useEffect, useState } from 'react';
import { Tabs, message } from 'antd';
import { PerformancePage } from './Performance/PerformancePage';
import { getServiceManager } from '../../services/monitor/serviceManager';
import { SessionInfo } from '../../types';
import { MonitorData } from '../../types/monitor';
import './MonitorPage.css';

const { TabPane } = Tabs;

interface MonitorPageProps {
  sessionInfo: SessionInfo;
}

export const MonitorPage: React.FC<MonitorPageProps> = ({ sessionInfo }) => {
  const [monitorData, setMonitorData] = useState<MonitorData>();
  const [activeKey, setActiveKey] = useState<string>(sessionInfo.config?.defaultPage || 'performance');

  useEffect(() => {
    const initMonitor = async () => {
      try {
        const monitorManager = getServiceManager().getMonitorManager();
        
        // 创建监控会话
        console.log('[MonitorPage] 创建监控会话:', sessionInfo);
        const monitorSession = monitorManager.createSession({
          ...sessionInfo,
          config: {
            refreshInterval: sessionInfo.config?.refreshInterval || 1000,
            autoRefresh: sessionInfo.config?.autoRefresh ?? true,
            defaultPage: sessionInfo.config?.defaultPage || 'performance',
            collectServiceInfo: sessionInfo.config?.collectServiceInfo ?? false,
            recordHistory: sessionInfo.config?.recordHistory ?? false,
            enableCache: sessionInfo.config?.enableCache ?? true,
            cacheExpiration: sessionInfo.config?.cacheExpiration || 30000
          }
        });

        // 连接监控会话
        console.log('[MonitorPage] 连接监控会话:', monitorSession.id);
        await monitorManager.connectSession(monitorSession.id);
        
        // 监听刷新事件
        const handleRefresh = () => {
          const updatedSession = monitorManager.getSession(monitorSession.id);
          if (updatedSession?.monitorData) {
            setMonitorData(updatedSession.monitorData);
          }
        };

        const refreshService = getServiceManager().getRefreshService();
        refreshService.on('refresh', handleRefresh);

        // 初始获取数据
        handleRefresh();

        return () => {
          refreshService.off('refresh', handleRefresh);
          monitorManager.disconnectSession(monitorSession.id);
        };
      } catch (error) {
        console.error('[MonitorPage] 监控连接失败:', error);
        message.error('监控连接失败: ' + (error as Error).message);
      }
    };

    initMonitor();
  }, [sessionInfo.id]);

  return (
    <div className="monitor-page">
      <Tabs 
        activeKey={activeKey} 
        onChange={setActiveKey}
        defaultActiveKey={sessionInfo.config?.defaultPage || 'performance'}
      >
        <TabPane tab="性能监控" key="performance">
          <PerformancePage sessionId={sessionInfo.id} monitorData={monitorData} />
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