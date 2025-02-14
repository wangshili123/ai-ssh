import React, { useState } from 'react';
import { Tabs } from 'antd';
import { DiskDetailInfo } from '../../../../../types/monitor';
import { DiskOverview } from './DiskOverview';
import { DiskHealth } from './DiskHealth';
import { DiskSpace } from './DiskSpace';
import { DiskIo } from './DiskIo';
import './DiskDetailTab.css';

interface DiskDetailProps {
  diskInfo: DiskDetailInfo;
}

export const DiskDetail: React.FC<DiskDetailProps> = ({ diskInfo }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const items = [
    {
      key: 'overview',
      label: '分区列表',
      children: <DiskOverview diskInfo={diskInfo} />,
    },
    {
      key: 'health',
      label: '健康状态',
      children: <DiskHealth health={diskInfo.health} />,
    },
    {
      key: 'space',
      label: '空间分析',
      children: <DiskSpace spaceAnalysis={diskInfo.spaceAnalysis} />,
    },
    {
      key: 'io',
      label: 'IO分析',
      children: <DiskIo ioAnalysis={diskInfo.ioAnalysis} />,
    },
  ];

  return (
    <div className="disk-detail">
      <Tabs 
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
        className="disk-tabs"
      />
    </div>
  );
}; 