import React from 'react';
import { Card, Progress } from 'antd';
import type { MonitorData } from '../../../../types/monitor';
import { formatBytes } from '../../../../utils/format';
import './MemoryUsageCard.css';

interface MemoryUsageCardProps {
  sessionId: string;
  monitorData?: MonitorData;
  simple?: boolean;
  detailed?: boolean;
}

export const MemoryUsageCard: React.FC<MemoryUsageCardProps> = ({ 
  sessionId, 
  monitorData,
  simple, 
  detailed 
}) => {
  const memoryInfo = monitorData?.memory || {
    total: 0,
    used: 0,
    free: 0,
    cached: 0,
    buffers: 0,
    usagePercent: 0
  };

  if (simple) {
    return (
      <div className="resource-summary">
        <div className="resource-title">内 存</div>
        <div className="resource-value">{Math.round(memoryInfo.usagePercent)}%</div>
        <Progress percent={Math.round(memoryInfo.usagePercent)} showInfo={false} size="small" />
      </div>
    );
  }

  if (detailed) {
    return (
      <div className="resource-details">
        <div className="resource-header">
          <h2>内存使用情况</h2>
          <div className="resource-summary">
            <div className="usage-circle">
              <Progress
                type="circle"
                percent={Math.round(memoryInfo.usagePercent)}
                format={percent => percent ? `${percent}%` : '0%'}
              />
            </div>
            <div className="basic-info">
              <p>总内存: {formatBytes(memoryInfo.total)}</p>
              <p>已使用: {formatBytes(memoryInfo.used)}</p>
              <p>可用: {formatBytes(memoryInfo.free)}</p>
              <p>缓存: {formatBytes(memoryInfo.cached)}</p>
              <p>缓冲区: {formatBytes(memoryInfo.buffers)}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card title="内存使用" size="small">
      <Progress
        type="circle"
        percent={Math.round(memoryInfo.usagePercent)}
        format={percent => percent ? `${percent}%` : '0%'}
      />
      <div style={{ marginTop: 16 }}>
        <p>总内存: {formatBytes(memoryInfo.total)}</p>
        <p>已使用: {formatBytes(memoryInfo.used)}</p>
        <p>可用: {formatBytes(memoryInfo.free)}</p>
        <p>缓存: {formatBytes(memoryInfo.cached)}</p>
        <p>缓冲区: {formatBytes(memoryInfo.buffers)}</p>
      </div>
    </Card>
  );
}; 