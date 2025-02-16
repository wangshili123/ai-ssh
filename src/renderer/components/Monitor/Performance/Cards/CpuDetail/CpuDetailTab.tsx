import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { CpuDetailInfo } from '../../../../../types/monitor';
import { CpuBasicInfo } from './CpuBasicInfo';
import { CpuCores } from './CpuCores';
import { MonitorManager } from '../../../../../services/monitor/monitorManager';

import './CpuDetailTab.css';
import { getServiceManager } from '@/renderer/services/monitor/serviceManager';

interface CpuDetailProps {
  cpuInfo: CpuDetailInfo;
  sessionId: string;
}

export const CpuDetail: React.FC<CpuDetailProps> = ({ cpuInfo, sessionId }) => {
  const [activeTab, setActiveTab] = useState('basic');
  const monitorManager = getServiceManager().getMonitorManager();
 

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    monitorManager.setActiveDetailTab('cpu', tab);
  };

  const items = [
    {
      key: 'basic',
      label: '基础信息',
      children: <CpuBasicInfo cpuInfo={cpuInfo} />,
    },
    {
      key: 'cores',
      label: '逻辑处理器',
      children: <CpuCores cpuInfo={cpuInfo} />,
    },
  ];

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
}; 