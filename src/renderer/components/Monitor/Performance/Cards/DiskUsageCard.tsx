import React, { useEffect, useState } from 'react';
import { Card, Progress } from 'antd';
import { monitorManager } from '../../../../services/monitor/monitorManager';
import { DiskInfo } from '../../../../types/monitor';
import { formatBytes } from '../../../../utils/format';

interface DiskUsageCardProps {
  sessionId: string;
  simple?: boolean;
  detailed?: boolean;
}

export const DiskUsageCard: React.FC<DiskUsageCardProps> = ({ sessionId, simple, detailed }) => {
  const [diskInfo, setDiskInfo] = useState<DiskInfo>({
    devices: [],
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0
  });

  useEffect(() => {
    const session = monitorManager.getSession(sessionId);
    if (!session) return;

    if (session.monitorData?.disk) {
      setDiskInfo(session.monitorData.disk);
    }

    const updateInterval = setInterval(() => {
      const session = monitorManager.getSession(sessionId);
      if (session?.monitorData?.disk) {
        setDiskInfo(session.monitorData.disk);
      }
    }, session.config?.refreshInterval || 5000);

    return () => clearInterval(updateInterval);
  }, [sessionId]);

  if (simple) {
    return (
      <div className="resource-summary">
        <div className="resource-title">磁盘</div>
        <div className="resource-value">{Math.round(diskInfo.usagePercent)}%</div>
        <Progress percent={Math.round(diskInfo.usagePercent)} showInfo={false} size="small" />
      </div>
    );
  }

  if (detailed) {
    return (
      <div className="resource-details">
        <div className="resource-header">
          <h2>磁盘使用情况</h2>
          <div className="resource-summary">
            <div className="usage-circle">
              <Progress
                type="circle"
                percent={Math.round(diskInfo.usagePercent)}
                format={(percent) => `${percent}%`}
              />
            </div>
            <div className="basic-info">
              <p>总容量: {formatBytes(diskInfo.total)}</p>
              <p>已使用: {formatBytes(diskInfo.used)}</p>
              <p>可用: {formatBytes(diskInfo.free)}</p>
            </div>
          </div>
        </div>

        <div className="devices-list">
          <h3>磁盘设备</h3>
          {diskInfo.devices.map((device, index) => (
            <div key={index} className="device-item">
              <div className="device-header">
                <span>{device.device} ({device.mountpoint})</span>
                <span>{Math.round(device.usagePercent)}%</span>
              </div>
              <Progress percent={Math.round(device.usagePercent)} size="small" />
              <div className="device-details">
                <p>总容量: {formatBytes(device.total)}</p>
                <p>已使用: {formatBytes(device.used)}</p>
                <p>可用: {formatBytes(device.free)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card title="磁盘使用" size="small">
      <Progress
        type="circle"
        percent={Math.round(diskInfo.usagePercent)}
        format={(percent) => `${percent}%`}
      />
      <div style={{ marginTop: 16 }}>
        <p>总容量: {formatBytes(diskInfo.total)}</p>
        <p>已使用: {formatBytes(diskInfo.used)}</p>
        <p>可用: {formatBytes(diskInfo.free)}</p>
      </div>
    </Card>
  );
}; 