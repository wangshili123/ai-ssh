import React, { useState } from 'react';
import { CpuUsageCard } from './Cards/CpuUsageCard';
import { MemoryUsageCard } from './Cards/MemoryUsageCard';
import { DiskUsageCard } from './Cards/DiskUsageCard';
import { NetworkTrafficCard } from './Cards/NetworkTrafficCard';
import { MonitorData } from '../../../types/monitor';
import './PerformancePage.css';

interface PerformancePageProps {
  sessionId: string;
  monitorData?: MonitorData;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ 
  sessionId,
  monitorData
}) => {
  const [selectedResource, setSelectedResource] = useState<'cpu' | 'memory' | 'disk' | 'network'>('cpu');

  return (
    <div className="performance-container">
      {/* 左侧资源列表 */}
      <div className="performance-sidebar">
        <div className="resource-list">
          <div 
            className={`resource-summary ${selectedResource === 'cpu' ? 'selected' : ''}`}
            onClick={() => setSelectedResource('cpu')}
          >
            <CpuUsageCard sessionId={sessionId} monitorData={monitorData} simple />
          </div>
          <div 
            className={`resource-summary ${selectedResource === 'memory' ? 'selected' : ''}`}
            onClick={() => setSelectedResource('memory')}
          >
            <MemoryUsageCard sessionId={sessionId} monitorData={monitorData} simple />
          </div>
          <div 
            className={`resource-summary ${selectedResource === 'disk' ? 'selected' : ''}`}
            onClick={() => setSelectedResource('disk')}
          >
            <DiskUsageCard sessionId={sessionId} monitorData={monitorData} simple />
          </div>
          <div 
            className={`resource-summary ${selectedResource === 'network' ? 'selected' : ''}`}
            onClick={() => setSelectedResource('network')}
          >
            <NetworkTrafficCard sessionId={sessionId} monitorData={monitorData} simple />
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
          <NetworkTrafficCard sessionId={sessionId} monitorData={monitorData} detailed />
        )}
      </div>
    </div>
  );
}; 