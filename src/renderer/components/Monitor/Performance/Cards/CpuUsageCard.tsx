import React from 'react';
import { CpuBasicInfo, CpuDetailInfo, MonitorData } from '../../../../types/monitor';
import { formatFrequency } from '../../../../utils/format';
import { CpuDetail } from './CpuDetail/CpuDetailTab';
import './CpuUsageCard.css';

interface CpuUsageCardProps {
  sessionId: string;
  monitorData?: MonitorData;
  simple?: boolean;
  detailed?: boolean;
}

export const CpuUsageCard: React.FC<CpuUsageCardProps> = ({ 
  sessionId, 
  monitorData,
  simple, 
  detailed 
}) => {
  const cpuBasic = monitorData?.performance?.basic?.cpu || {
    usage: 0,
    speed: 0,
    currentSpeed: 0,
    temperature: undefined
  };

  const cpuDetail = monitorData?.performance?.detail?.cpu || {
    ...cpuBasic,
    cores: [],
    model: '',
    maxSpeed: undefined,
    minSpeed: undefined,
    physicalCores: 0,
    logicalCores: 0,
    cache: {},
    architecture: undefined,
    vendor: undefined,
    socket: undefined,
    virtualization: undefined,
    usageHistory: [],
    coreUsageHistory: []
  };

  // 简单视图用于左侧资源列表
  if (simple) {
    return (
      <div className="resource-summary cpu-usage-card">
        <div className="resource-title">CPU</div>
        <div className="resource-value">
          <span className="usage-value">{Math.round(cpuBasic.usage)}%</span>
          <span className="resource-speed">{formatFrequency(cpuBasic.currentSpeed || cpuBasic.speed)}</span>
        </div>
      </div>
    );
  }

  // 详细视图
  if (detailed) {
    return <CpuDetail cpuInfo={cpuDetail} sessionId={sessionId} />;
  }

  return null;
}; 