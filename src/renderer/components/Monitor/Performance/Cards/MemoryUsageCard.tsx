import React, { useEffect, useState } from 'react';
import { Card, Progress } from 'antd';
import { getServiceManager } from '../../../../services/monitor/serviceManager';
import { MemoryInfo } from '../../../../types/monitor';
import { formatBytes } from '../../../../utils/format';
import './MemoryUsageCard.css';

interface MemoryUsageCardProps {
  sessionId: string;
  simple?: boolean;
  detailed?: boolean;
}

export const MemoryUsageCard: React.FC<MemoryUsageCardProps> = ({ sessionId, simple, detailed }) => {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo>({
    total: 0,
    used: 0,
    free: 0,
    cached: 0,
    buffers: 0,
    usagePercent: 0
  });

  useEffect(() => {
    const monitorManager = getServiceManager().getMonitorManager();
    const session = monitorManager.getSession(sessionId);
    if (!session) return;

    if (session.monitorData?.memory) {
      setMemoryInfo(session.monitorData.memory);
    }

    const updateInterval = setInterval(() => {
      const currentSession = monitorManager.getSession(sessionId);
      if (currentSession?.monitorData?.memory) {
        setMemoryInfo(currentSession.monitorData.memory);
      }
    }, session.config?.refreshInterval || 5000);

    return () => clearInterval(updateInterval);
  }, [sessionId]);

  if (simple) {
    return (
      <div className="resource-summary">
        <div className="resource-title">内存</div>
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