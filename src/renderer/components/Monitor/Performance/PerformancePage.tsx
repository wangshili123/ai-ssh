import React, { useState } from 'react';
import { Row, Col, Card } from 'antd';
import { CpuUsageCard } from './Cards/CpuUsageCard';
import { MemoryUsageCard } from './Cards/MemoryUsageCard';
import { DiskUsageCard } from './Cards/DiskUsageCard';
import { NetworkTrafficCard } from './Cards/NetworkTrafficCard';
import './PerformancePage.css';

interface PerformancePageProps {
  sessionId: string;
}

export const PerformancePage: React.FC<PerformancePageProps> = ({ sessionId }) => {
  const [selectedResource, setSelectedResource] = useState<'cpu' | 'memory' | 'disk' | 'network'>('cpu');

  return (
    <div className="performance-container">
      {/* 左侧资源列表 */}
      <div className="performance-sidebar">
        <div className="resource-list">
          <Card 
            className={`resource-item ${selectedResource === 'cpu' ? 'selected' : ''}`}
            onClick={() => setSelectedResource('cpu')}
          >
            <CpuUsageCard sessionId={sessionId} simple />
          </Card>
          <Card 
            className={`resource-item ${selectedResource === 'memory' ? 'selected' : ''}`}
            onClick={() => setSelectedResource('memory')}
          >
            <MemoryUsageCard sessionId={sessionId} simple />
          </Card>
          <Card 
            className={`resource-item ${selectedResource === 'disk' ? 'selected' : ''}`}
            onClick={() => setSelectedResource('disk')}
          >
            <DiskUsageCard sessionId={sessionId} simple />
          </Card>
          <Card 
            className={`resource-item ${selectedResource === 'network' ? 'selected' : ''}`}
            onClick={() => setSelectedResource('network')}
          >
            <NetworkTrafficCard sessionId={sessionId} simple />
          </Card>
        </div>
      </div>

      {/* 右侧详细信息 */}
      <div className="performance-details">
        {selectedResource === 'cpu' && (
          <CpuUsageCard sessionId={sessionId} detailed />
        )}
        {selectedResource === 'memory' && (
          <MemoryUsageCard sessionId={sessionId} detailed />
        )}
        {selectedResource === 'disk' && (
          <DiskUsageCard sessionId={sessionId} detailed />
        )}
        {selectedResource === 'network' && (
          <NetworkTrafficCard sessionId={sessionId} detailed />
        )}
      </div>
    </div>
  );
}; 