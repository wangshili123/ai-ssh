import React from 'react';
import { Progress } from 'antd';
import { DiskBasicInfo, DiskDetailInfo, MonitorData } from '../../../../types/monitor';
import { formatBytes } from '../../../../utils/format';
import { getProgressColor, getResourceStatus } from '../../../../utils/theme';
import { DiskDetail } from './DiskDetail/DiskDetailTab';
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
  const diskBasic = monitorData?.performance?.basic?.disk || {
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0
  };

  const diskDetail = monitorData?.performance?.detail?.disk || {
    ...diskBasic,
    readSpeed: 0,
    writeSpeed: 0,
    partitions: [],
    ioHistory: [],
    deviceStats: {},
    health: undefined,
    spaceAnalysis: undefined,
    ioAnalysis: undefined
  };

  // 简单视图用于左侧资源列表
  if (simple) {
    const status = getResourceStatus(diskBasic.usagePercent);
    return (
      <div className={`resource-summary disk-usage-card ${status}`}>
        <div className="resource-title">磁盘</div>
        <div className="resource-value">
          <span className="usage-value">{Math.round(diskBasic.usagePercent)}%</span>
          <span className="disk-details">
            {formatBytes(diskBasic.used)}/{formatBytes(diskBasic.total)}
          </span>
        </div>
        <Progress 
          percent={Math.round(diskBasic.usagePercent)} 
          showInfo={false} 
          size="small"
          strokeColor={getProgressColor(diskBasic.usagePercent)}
        />
      </div>
    );
  }

  // 详细视图
  if (detailed) {
    return <DiskDetail diskInfo={diskDetail} />;
  }

  return null;
}; 