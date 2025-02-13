import React from 'react';
import { Card, Progress } from 'antd';
import type { MonitorData } from '../../../../types/monitor';
import { formatBytes } from '../../../../utils/format';
import './DiskUsageCard.css';

interface DiskUsageCardProps {
  sessionId: string;
  monitorData?: MonitorData;
  simple?: boolean;
  detailed?: boolean;
}

export const DiskUsageCard: React.FC<DiskUsageCardProps> = ({ 
  sessionId, 
  monitorData,
  simple, 
  detailed 
}) => {
  const diskInfo = monitorData?.disk || {
    devices: [],
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0
  };

  if (simple) {
    return (
      <div className="resource-summary">
        <div className="resource-title">磁 盘</div>
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
                format={percent => percent ? `${percent}%` : '0%'}
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
        format={percent => percent ? `${percent}%` : '0%'}
      />
      <div style={{ marginTop: 16 }}>
        <p>总容量: {formatBytes(diskInfo.total)}</p>
        <p>已使用: {formatBytes(diskInfo.used)}</p>
        <p>可用: {formatBytes(diskInfo.free)}</p>
      </div>
    </Card>
  );
}; 