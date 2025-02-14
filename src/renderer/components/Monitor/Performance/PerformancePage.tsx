import React, { useState, useEffect } from 'react';
import { CpuUsageCard } from './Cards/CpuUsageCard';
import { MemoryUsageCard } from './Cards/MemoryUsageCard';
import { DiskUsageCard } from './Cards/DiskUsageCard';
import { NetworkUsageCard } from './Cards/NetworkUsageCard';
import { MonitorData } from '../../../types/monitor';
import { MonitorManager } from '../../../services/monitor/monitorManager';
import './PerformancePage.css';

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
  const defaultResource = 'cpu' as const;
  const [selectedResource, setSelectedResource] = useState<'cpu' | 'memory' | 'disk' | 'network'>(defaultResource);

  // 初始化时设置默认的 activeCard
  useEffect(() => {
    monitorManager.setActiveCard(defaultResource);
  }, []);

  // 处理资源选择变更
  const handleResourceSelect = (resource: 'cpu' | 'memory' | 'disk' | 'network') => {
    setSelectedResource(resource);
    monitorManager.setActiveCard(resource);
  };

  return (
    <div className="performance-container">
      {/* 左侧资源列表 */}
      <div className="performance-sidebar">
        <div className="resource-list">
          <div 
            className={`resource-summary ${selectedResource === 'cpu' ? 'selected' : ''}`}
            onClick={() => handleResourceSelect('cpu')}
          >
            <CpuUsageCard sessionId={sessionId} monitorData={monitorData} simple />
          </div>
          <div 
            className={`resource-summary ${selectedResource === 'memory' ? 'selected' : ''}`}
            onClick={() => handleResourceSelect('memory')}
          >
            <MemoryUsageCard sessionId={sessionId} monitorData={monitorData} simple />
          </div>
          <div 
            className={`resource-summary ${selectedResource === 'disk' ? 'selected' : ''}`}
            onClick={() => handleResourceSelect('disk')}
          >
            <DiskUsageCard sessionId={sessionId} monitorData={monitorData} simple />
          </div>
          <div 
            className={`resource-summary ${selectedResource === 'network' ? 'selected' : ''}`}
            onClick={() => handleResourceSelect('network')}
          >
            <NetworkUsageCard sessionId={sessionId} monitorData={monitorData} simple />
          </div>
        </div>
      </div>

      {/* 右侧详细信息 */}
      <div className="performance-details">
        {selectedResource === 'cpu' && (
          <CpuUsageCard sessionId={sessionId} monitorData={monitorData} detailed />
        )}
        {selectedResource === 'memory' && (
          <MemoryUsageCard sessionId={sessionId} monitorData={monitorData} detailed />
        )}
        {selectedResource === 'disk' && (
          <DiskUsageCard sessionId={sessionId} monitorData={monitorData} detailed />
        )}
        {selectedResource === 'network' && (
          <NetworkUsageCard sessionId={sessionId} monitorData={monitorData} detailed />
        )}
      </div>
    </div>
  );
}; 