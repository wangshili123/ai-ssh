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
  const defaultPage = sessionInfo.config?.defaultPage || 'performance';
  const [activeKey, setActiveKey] = useState<string>(defaultPage);
  const monitorManager = getServiceManager().getMonitorManager();

  // 初始化时设置 activeTab
  useEffect(() => {
    monitorManager.setActiveTab(defaultPage);
  }, []);

  useEffect(() => {
    const initMonitor = async () => {
      console.time(`[Performance] 监控页面初始化总耗时 ${sessionInfo.id}`);
      try {
        // 创建监控会话
        console.time(`[Performance] 创建监控会话耗时 ${sessionInfo.id}`);
        const monitorSession = monitorManager.createSession({
          ...sessionInfo,
          config: {
            refreshInterval: sessionInfo.config?.refreshInterval || 1000,
            autoRefresh: sessionInfo.config?.autoRefresh ?? true,
            defaultPage: defaultPage,
            collectServiceInfo: sessionInfo.config?.collectServiceInfo ?? false,
            recordHistory: sessionInfo.config?.recordHistory ?? false,
            enableCache: sessionInfo.config?.enableCache ?? true,
            cacheExpiration: sessionInfo.config?.cacheExpiration || 30000
          }
        });
        console.timeEnd(`[Performance] 创建监控会话耗时 ${sessionInfo.id}`);

        // 连接监控会话
        console.time(`[Performance] 连接监控会话耗时 ${sessionInfo.id}`);
        await monitorManager.connectSession(monitorSession.id);
        console.timeEnd(`[Performance] 连接监控会话耗时 ${sessionInfo.id}`);
        
        // 监听刷新事件
        const handleRefresh = () => {
          console.time(`[Performance] 数据更新耗时 ${sessionInfo.id}`);
          const updatedSession = monitorManager.getSession(monitorSession.id);
          if (updatedSession?.monitorData) {
            setMonitorData(updatedSession.monitorData);
          }
          console.timeEnd(`[Performance] 数据更新耗时 ${sessionInfo.id}`);
        };

        const refreshService = getServiceManager().getRefreshService();
        refreshService.on('refresh', handleRefresh);
        return () => {
          refreshService.off('refresh', handleRefresh);
          monitorManager.disconnectSession(monitorSession.id);
        };
      } catch (error) {
        console.error('[MonitorPage] 监控连接失败:', error);
        message.error('监控连接失败: ' + (error as Error).message);
      }
      console.timeEnd(`[Performance] 监控页面初始化总耗时 ${sessionInfo.id}`);
    };

    initMonitor();
  }, [sessionInfo.id]);

  // 处理标签页切换
  const handleTabChange = (key: string) => {
    setActiveKey(key);
    monitorManager.setActiveTab(key);
  };

  return (
    <div className="monitor-page">
      <Tabs 
        activeKey={activeKey} 
        onChange={handleTabChange}
        defaultActiveKey={defaultPage}
      >
        <TabPane tab="性能监控" key="performance">
          <PerformancePage 
            sessionId={sessionInfo.id} 
            monitorData={monitorData} 
            monitorManager={monitorManager}
          />
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