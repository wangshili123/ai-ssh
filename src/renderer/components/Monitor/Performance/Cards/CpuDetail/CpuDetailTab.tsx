import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Tabs, Spin } from 'antd';
import { CpuDetailInfo, MonitorData } from '../../../../../types/monitor/monitor';
import { CpuBasicInfo } from './CpuBasicInfo';
import { CpuCores } from './CpuCores';
import { MonitorManager } from '../../../../../services/monitor/monitorManager';

import './CpuDetailTab.css';
import { getServiceManager } from '@/renderer/services/monitor/serviceManager';

interface CpuDetailProps {
  cpuInfo: CpuDetailInfo;
  sessionId: string;
}

export const CpuDetail: React.FC<CpuDetailProps> = React.memo(({ cpuInfo, sessionId }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['basic']));
  const [monitorData, setMonitorData] = useState<MonitorData>();
  const monitorManager = getServiceManager().getMonitorManager();
 
  const handleTabChange = async (tab: string) => {
    console.log('CpuDetail切换tab', tab);
    setActiveTab(tab);
    monitorManager.setActiveDetailTab('cpu', tab);
    if (!loadedTabs.has(tab)) {
      // 第一次切换时立即触发刷新，等待刷新完成
      console.log('CpuDetail刷新会话数据', sessionId);
      const newData = await monitorManager.refreshSession(sessionId);
      if (newData?.performance?.detail?.cpu) {
        setMonitorData(newData);
      }
      setLoadedTabs(prev => new Set([...prev, tab]));
    }
  };

  // 使用最新的数据
  const currentCpuInfo = monitorData?.performance?.detail?.cpu || cpuInfo;

  const renderTabContent = (Component: React.ReactNode, isFirstLoad: boolean) => {
    if (isFirstLoad) {
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spin tip="加载数据中..." />
        </div>
      );
    }
    return Component;
  };

  const items = useMemo(() => [
    {
      key: 'basic',
      label: '基础信息',
      children: <CpuBasicInfo cpuInfo={currentCpuInfo} />,
    },
    {
      key: 'cores',
      label: '逻辑处理器',
      children: renderTabContent(<CpuCores cpuInfo={currentCpuInfo} />, !loadedTabs.has('cores')),
    },
  ], [currentCpuInfo, loadedTabs]);

  return (
    <div className="cpu-detail">
      <Tabs 
        activeKey={activeTab}
        onChange={handleTabChange}
        items={items}
        className="cpu-tabs"
      />
    </div>
  );
}); 