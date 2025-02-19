import React, { useState, useEffect, useCallback } from 'react';
import { CpuUsageCard } from './Cards/CpuUsageCard';
import { MemoryUsageCard } from './Cards/MemoryUsageCard';
import { DiskUsageCard } from './Cards/DiskUsageCard';
import { NetworkUsageCard } from './Cards/NetworkUsageCard';
import { MonitorData, PerformanceBasicData } from '../../../types/monitor/monitor';
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
    console.log('初始化 PerformancePage:', { sessionId });
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
    
    if (performanceData?.detail) {
      setDetailData(performanceData.detail);
    }
  }, [monitorData]);

  // 处理资源选择
  const handleResourceSelect = useCallback((resource: ResourceType) => {
    console.log('Resource selected:', { resource, sessionId });
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
        {/* 保持所有详细面板挂载，通过 CSS 控制显示/隐藏 */}
        <div style={{ display: selectedResource === 'cpu' ? 'block' : 'none' }}>
          <DetailResourceCard
            type="cpu"
            detailData={detailData?.cpu}
            basicData={basicData}
            sessionId={sessionId}
          />
        </div>
        <div style={{ display: selectedResource === 'memory' ? 'block' : 'none' }}>
          <DetailResourceCard
            type="memory"
            detailData={detailData?.memory}
            basicData={basicData}
            sessionId={sessionId}
          />
        </div>
        <div style={{ display: selectedResource === 'disk' ? 'block' : 'none' }}>
          <DetailResourceCard
            type="disk"
            detailData={detailData?.disk}
            basicData={basicData}
            sessionId={sessionId}
          />
        </div>
        <div style={{ display: selectedResource === 'network' ? 'block' : 'none' }}>
          <DetailResourceCard
            type="network"
            detailData={detailData?.network}
            basicData={basicData}
            sessionId={sessionId}
          />
        </div>
      </div>
    </div>
  );
}; 