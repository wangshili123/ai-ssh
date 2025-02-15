import React, { useState, useEffect, useCallback } from 'react';
import { CpuUsageCard } from './Cards/CpuUsageCard';
import { MemoryUsageCard } from './Cards/MemoryUsageCard';
import { DiskUsageCard } from './Cards/DiskUsageCard';
import { NetworkUsageCard } from './Cards/NetworkUsageCard';
import { MonitorData, PerformanceBasicData } from '../../../types/monitor';
import { MonitorManager } from '../../../services/monitor/monitorManager';
import './PerformancePage.css';

type ResourceType = 'cpu' | 'memory' | 'disk' | 'network';

// 基础资源卡片组件
const BasicResourceCard = React.memo(({ 
  type, 
  basicData, 
  isSelected, 
  onSelect,
  sessionId 
}: {
  type: ResourceType;
  basicData: PerformanceBasicData;
  isSelected: boolean;
  onSelect: (type: ResourceType) => void;
  sessionId: string;
}) => {
  const monitorData: MonitorData = {
    performance: {
      basic: basicData
    },
    timestamp: Date.now()
  };

  const renderCard = () => {
    switch (type) {
      case 'cpu':
        return <CpuUsageCard sessionId={sessionId} monitorData={monitorData} simple />;
      case 'memory':
        return <MemoryUsageCard sessionId={sessionId} monitorData={monitorData} simple />;
      case 'disk':
        return <DiskUsageCard sessionId={sessionId} monitorData={monitorData} simple />;
      case 'network':
        return <NetworkUsageCard sessionId={sessionId} monitorData={monitorData} simple />;
    }
  };

  return (
    <div 
      className={`resource-summary ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(type)}
    >
      {renderCard()}
    </div>
  );
});

// 详细资源卡片组件
const DetailResourceCard = React.memo(({ 
  type, 
  detailData,
  basicData,
  sessionId 
}: {
  type: ResourceType;
  detailData: any;
  basicData: PerformanceBasicData;
  sessionId: string;
}) => {
  const monitorData: MonitorData = {
    performance: {
      basic: basicData,
      detail: {
        [type]: detailData
      }
    },
    timestamp: Date.now()
  };

  switch (type) {
    case 'cpu':
      return <CpuUsageCard sessionId={sessionId} monitorData={monitorData} detailed />;
    case 'memory':
      return <MemoryUsageCard sessionId={sessionId} monitorData={monitorData} detailed />;
    case 'disk':
      return <DiskUsageCard sessionId={sessionId} monitorData={monitorData} detailed />;
    case 'network':
      return <NetworkUsageCard sessionId={sessionId} monitorData={monitorData} detailed />;
    default:
      return null;
  }
});

interface PerformancePageProps {
  sessionId: string;
  monitorData?: MonitorData;
  monitorManager: MonitorManager;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ 
  sessionId,
  monitorData,
  monitorManager
}) => {
  // 基础数据状态
  const [basicData, setBasicData] = useState<PerformanceBasicData>({
    cpu: {
      usage: 0,
      speed: 0
    },
    memory: {
      total: 0,
      used: 0,
      free: 0,
      usagePercent: 0,
      cached: 0,
      buffers: 0,
      swap: {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0
      }
    },
    disk: {
      total: 0,
      used: 0,
      free: 0,
      usagePercent: 0
    },
    network: {
      totalRx: 0,
      totalTx: 0,
      rxSpeed: 0,
      txSpeed: 0
    }
  });
  
  // 详细数据状态
  const [detailData, setDetailData] = useState<any>(null);
  
  // 选中的资源
  const defaultResource = 'cpu' as const;
  const [selectedResource, setSelectedResource] = useState<ResourceType>(defaultResource);

  // 初始化时设置默认的 activeCard
  useEffect(() => {
    monitorManager.setActiveCard(defaultResource);
  }, []);

  // 处理数据更新
  useEffect(() => {
    const performanceData = monitorData?.performance;
    if (performanceData?.basic) {
      setBasicData(prev => ({
        ...prev,
        ...performanceData.basic
      }));
    }
    
    if (performanceData?.detail?.[selectedResource]) {
      setDetailData(performanceData.detail[selectedResource]);
    }
  }, [monitorData, selectedResource]);

  // 处理资源选择
  const handleResourceSelect = useCallback((resource: ResourceType) => {
    setSelectedResource(resource);
    monitorManager.setActiveCard(resource);
  }, [monitorManager]);

  return (
    <div className="performance-container">
      <div className="performance-sidebar">
        {(['cpu', 'memory', 'disk', 'network'] as const).map(type => (
          <BasicResourceCard
            key={type}
            type={type}
            basicData={basicData}
            isSelected={selectedResource === type}
            onSelect={handleResourceSelect}
            sessionId={sessionId}
          />
        ))}
      </div>
      <div className="performance-details">
        <DetailResourceCard
          type={selectedResource}
          detailData={detailData}
          basicData={basicData}
          sessionId={sessionId}
        />
      </div>
    </div>
  );
}; 