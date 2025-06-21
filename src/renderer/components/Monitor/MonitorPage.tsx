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
  tabId: string;
}

export const MonitorPage: React.FC<MonitorPageProps> = ({ sessionInfo, tabId }) => {
  const [monitorData, setMonitorData] = useState<MonitorData>();
  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<any>({ defaultPage: 'performance', refreshInterval: 5 });
  const monitorManager = getServiceManager().getMonitorManager();
  const configManager = MonitorConfigManager.getInstance();
  const [activeKey, setActiveKey] = useState<string>('performance');

  // 异步加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const loadedConfig = await configManager.getConfig();
        console.log('[MonitorPage] 配置加载完成:', loadedConfig);
        setConfig(loadedConfig);
        setActiveKey(loadedConfig.defaultPage);

        // 设置 activeTab
        console.log('[MonitorPage] 初始化设置activeTab:', {
          tabId,
          sessionId: sessionInfo.id,
          defaultPage: loadedConfig.defaultPage
        });
        monitorManager.setActiveTab(loadedConfig.defaultPage);
      } catch (error) {
        console.error('[MonitorPage] 配置加载失败:', error);
        // 使用默认配置
        const defaultConfig = { defaultPage: 'performance', refreshInterval: 5 };
        setConfig(defaultConfig);
        setActiveKey(defaultConfig.defaultPage);
        monitorManager.setActiveTab(defaultConfig.defaultPage);
      }
    };

    loadConfig();
  }, []);

  // 监听刷新事件
  useEffect(() => {
    const handleRefresh = (sessionId: string, refreshTabId: string) => {
      // 只处理属于当前标签页的刷新
      if (refreshTabId !== tabId) return;
      
      console.time(`[Performance] 数据更新耗时 ${sessionInfo.id}`);
      const updatedData = monitorManager.getTabData(tabId);
      if (updatedData) {
        setMonitorData(updatedData);
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
  }, [sessionInfo.id, tabId]);

  // 处理标签页切换
  const handleTabChange = (key: string) => {
    console.log('[MonitorPage] 标签页切换:', {
      tabId,
      sessionId: sessionInfo.id,
      oldKey: activeKey,
      newKey: key
    });
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
            tabId={tabId}
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