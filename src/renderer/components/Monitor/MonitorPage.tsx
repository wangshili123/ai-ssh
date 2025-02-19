import React, { useEffect, useState } from 'react';
import { Tabs, message } from 'antd';
import { PerformancePage } from './Performance/PerformancePage';
import { getServiceManager } from '../../services/monitor/serviceManager';
import { SessionInfo } from '../../types';
import { MonitorData } from '../../types/monitor/monitor';
import { LoadingOverlay } from '../Common/LoadingOverlay';
import { MonitorConfigManager } from '../../services/config/MonitorConfig';
import './MonitorPage.css';

const { TabPane } = Tabs;

interface MonitorPageProps {
  sessionInfo: SessionInfo;
}

export const MonitorPage: React.FC<MonitorPageProps> = ({ sessionInfo }) => {
  const [monitorData, setMonitorData] = useState<MonitorData>();
  const [isLoading, setIsLoading] = useState(true);
  const monitorManager = getServiceManager().getMonitorManager();
  const configManager = MonitorConfigManager.getInstance();
  const config = configManager.getConfig();
  const [activeKey, setActiveKey] = useState<string>(config.defaultPage);

  // 初始化时设置 activeTab
  useEffect(() => {
    monitorManager.setActiveTab(config.defaultPage);
  }, []);

  // 监听刷新事件
  useEffect(() => {
    const handleRefresh = () => {
      console.time(`[Performance] 数据更新耗时 ${sessionInfo.id}`);
      const updatedSession = monitorManager.getSession(sessionInfo.id);
      if (updatedSession?.monitorData) {
        setMonitorData(updatedSession.monitorData);
        setIsLoading(false);
      }
      console.timeEnd(`[Performance] 数据更新耗时 ${sessionInfo.id}`);
    };

    const refreshService = getServiceManager().getRefreshService();
    refreshService.on('refresh', handleRefresh);

    // 返回清理函数
    return () => {
      console.log('[MonitorPage] 清理监控资源:', sessionInfo.id);
      refreshService.off('refresh', handleRefresh);
    };
  }, [sessionInfo.id]);

  // 处理标签页切换
  const handleTabChange = (key: string) => {
    setActiveKey(key);
    monitorManager.setActiveTab(key);
  };

  return (
    <div className="monitor-page">
      {/* 加载状态覆盖层 */}
      {isLoading && (
        <LoadingOverlay 
          spinning={true} 
          tip={`正在初始化监控数据...`} 
        />
      )}
      <Tabs 
        activeKey={activeKey} 
        onChange={handleTabChange}
        defaultActiveKey={config.defaultPage}
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