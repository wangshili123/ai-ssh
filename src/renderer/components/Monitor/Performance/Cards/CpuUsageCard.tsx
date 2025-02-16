import React from 'react';
import { Progress } from 'antd';
import { CpuBasicInfo, CpuDetailInfo, MonitorData } from '../../../../types/monitor';
import { formatFrequency } from '../../../../utils/format';
import { getProgressColor, getResourceStatus } from '../../../../utils/theme';
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
  // 定义默认的缓存对象
  const defaultCache = {
    l1: 0,
    l2: 0,
    l3: 0
  };

  // 定义基础数据的默认值
  const defaultBasic: CpuBasicInfo = {
    usage: 0,
    speed: 0,
    currentSpeed: 0,
    temperature: 'not_installed'
  };

  // 定义详细数据的默认值
  const defaultDetail: CpuDetailInfo = {
    ...defaultBasic,
    cores: [],
    model: '',
    maxSpeed: 0,
    minSpeed: 0,
    physicalCores: 0,
    logicalCores: 0,
    cache: defaultCache,
    architecture: 'Unknown',
    vendor: 'Unknown',
    socket: 'Unknown',
    virtualization: false,
    usageHistory: [],
    coreUsageHistory: []
  };

  // 安全地获取基础数据
  const cpuBasic = {
    ...defaultBasic,
    ...(monitorData?.performance?.basic?.cpu || {})
  };

  // 安全地获取详细数据
  const cpuDetail = {
    ...defaultDetail,
    ...(monitorData?.performance?.detail?.cpu || {}),
    // 确保嵌套对象有完整的默认值
    cache: {
      ...defaultCache,
      ...(monitorData?.performance?.detail?.cpu?.cache || {})
    },
    // 确保数组类型的属性有默认值
    cores: monitorData?.performance?.detail?.cpu?.cores || [],
    usageHistory: monitorData?.performance?.detail?.cpu?.usageHistory || [],
    coreUsageHistory: monitorData?.performance?.detail?.cpu?.coreUsageHistory || []
  };

  // 简单视图用于左侧资源列表
  if (simple) {
    const status = getResourceStatus(cpuBasic.usage);
    return (
      <div className={`resource-summary cpu-usage-card ${status}`}>
        <div className="resource-title">CPU</div>
        <div className="resource-value">
          <span className="usage-value">{Math.round(cpuBasic.usage)}%</span>
          <span className="resource-speed">{formatFrequency(cpuBasic.currentSpeed || cpuBasic.speed)}</span>
        </div>
        <Progress 
          percent={Math.round(cpuBasic.usage)} 
          showInfo={false} 
          size="small"
          strokeColor={getProgressColor(cpuBasic.usage)}
        />
      </div>
    );
  }

  // 详细视图
  if (detailed) {
    return <CpuDetail cpuInfo={cpuDetail} sessionId={sessionId} />;
  }

  return null;
}; 