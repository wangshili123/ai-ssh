import React, { useState } from 'react';
import { Tabs } from 'antd';
import { NetworkDetailInfo, MonitorData } from '../../../../../types/monitor';
import { NetworkBasicInfo } from './NetworkBasicInfo';
import { NetworkConnections } from './NetworkConnections';
import { NetworkProcesses } from './NetworkProcesses';
import { DetailLoadingOverlay } from '../../../../Common/DetailLoadingOverlay';
import { getServiceManager } from '@/renderer/services/monitor/serviceManager';
import './NetworkDetailTab.css';

interface NetworkDetailProps {
  networkInfo: NetworkDetailInfo;
  sessionId: string;
}

export const NetworkDetail: React.FC<NetworkDetailProps> = ({ 
  networkInfo,
  sessionId
}) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['basic']));
  const [monitorData, setMonitorData] = useState<MonitorData>();
  const monitorManager = getServiceManager().getMonitorManager();

  const handleTabChange = async (tab: string) => {
    setActiveTab(tab);
    monitorManager.setActiveDetailTab('network', tab);
    if (!loadedTabs.has(tab)) {
      // 第一次切换时立即触发刷新，等待刷新完成
      const newData = await monitorManager.refreshSession(sessionId);
      if (newData?.performance?.detail?.network) {
        setMonitorData(newData);
      }
      setLoadedTabs(prev => new Set([...prev, tab]));
    }
  };

  // 使用最新的数据
  const currentNetworkInfo = monitorData?.performance?.detail?.network || networkInfo;

  const renderTabContent = (Component: React.ReactNode, isFirstLoad: boolean) => {
    if (isFirstLoad) {
      return <DetailLoadingOverlay />;
    }
    return Component;
  };

  const items = [
    {
      key: 'basic',
      label: '基础信息',
      children: <NetworkBasicInfo networkInfo={currentNetworkInfo} />,
    },
    {
      key: 'connections',
      label: '连接分析',
      children: renderTabContent(
        <NetworkConnections networkInfo={currentNetworkInfo} />,
        !loadedTabs.has('connections')
      ),
    },
    {
      key: 'processes',
      label: '进程监控',
      children: renderTabContent(
        <NetworkProcesses networkInfo={currentNetworkInfo} />,
        !loadedTabs.has('processes')
      ),
    },
  ];

  return (
    <div className="network-detail">
      <Tabs 
        activeKey={activeTab}
        onChange={handleTabChange}
        items={items}
        className="network-tabs"
      />
    </div>
  );
}; 