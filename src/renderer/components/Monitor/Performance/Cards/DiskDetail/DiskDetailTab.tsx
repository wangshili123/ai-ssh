import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Tabs, Spin } from 'antd';
import { DiskDetailInfo, MonitorData } from '../../../../../types/monitor/monitor';
import { DiskBasicInfo } from './DiskBasicInfo';
import { DiskOverview } from './DiskOverview';
import { DiskHealth } from './DiskHealth';
import { DiskSpace } from './DiskSpace';
import { DiskIo } from './DiskIo';
import './DiskDetailTab.css';
import { getServiceManager } from '@/renderer/services/monitor/serviceManager';

interface DiskDetailProps {
  tabId: string;
  diskInfo: DiskDetailInfo;
  sessionId: string;
}

export const DiskDetail: React.FC<DiskDetailProps> = React.memo(({ 
  tabId,
  diskInfo,
  sessionId
}) => {
  const monitorManager = getServiceManager().getMonitorManager();
  const [activeTab, setActiveTab] = useState('basic');
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['basic', 'overview']));
  const [monitorData, setMonitorData] = useState<MonitorData>();

  const handleTabChange = async (tab: string) => {
    setActiveTab(tab);
    monitorManager.setActiveDetailTab('disk', tab);
    if (!loadedTabs.has(tab)) {
      // 第一次切换时立即触发刷新，等待刷新完成
      const newData = await monitorManager.refreshSession(sessionId,tabId);
      if (newData?.performance?.detail?.disk) {
        setMonitorData(newData);
      }
      setLoadedTabs(prev => new Set([...prev, tab]));
    }
  };

  // 使用最新的数据
  const currentDiskInfo = monitorData?.performance?.detail?.disk || diskInfo;

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
      children: <DiskBasicInfo diskInfo={currentDiskInfo} />,
    },
    {
      key: 'overview',
      label: '分区列表',
      children: <DiskOverview diskInfo={currentDiskInfo} />,
    },
    {
      key: 'health',
      label: '健康状态',
      children: renderTabContent(<DiskHealth health={currentDiskInfo.health} />, !loadedTabs.has('health')),
    },
    {
      key: 'space',
      label: '空间分析',
      children: renderTabContent(<DiskSpace spaceAnalysis={currentDiskInfo.spaceAnalysis} />, !loadedTabs.has('space')),
    },
    {
      key: 'io',
      label: 'IO分析',
      children: renderTabContent(<DiskIo ioAnalysis={currentDiskInfo.ioAnalysis} />, !loadedTabs.has('io')),
    },
  ], [currentDiskInfo, loadedTabs]);

  return (
    <div className="disk-detail">
      <Tabs 
        activeKey={activeTab}
        onChange={handleTabChange}
        items={items}
        className="disk-tabs"
      />
    </div>
  );
}); 