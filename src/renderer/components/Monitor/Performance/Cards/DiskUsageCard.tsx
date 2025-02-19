import React, { useState } from 'react';
import { Progress } from 'antd';
import { DiskBasicInfo, DiskDetailInfo, MonitorData } from '../../../../types/monitor/monitor';
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
  const [activeTab, setActiveTab] = useState('basic');

  // 定义基础数据的默认值
  const defaultBasic: DiskBasicInfo = {
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0
  };

  // 定义详细数据的默认值
  const defaultDetail: DiskDetailInfo = {
    ...defaultBasic,
    readSpeed: 0,
    writeSpeed: 0,
    deviceStats: {},
    partitions: [],
    ioHistory: [],
    health: {
      devices: [],
      lastCheck: 0
    },
    spaceAnalysis: {
      largeDirectories: [],
      largeFiles: [],
      fileTypes: [],
      lastScan: 0
    },
    ioAnalysis: {
      topProcesses: [],
      deviceStats: [],
      timestamp: 0,
      isToolInstalled: false
    }
  };

  // 安全地获取基础数据
  const diskBasic = {
    ...defaultBasic,
    ...(monitorData?.performance?.basic?.disk || {})
  };

  // 安全地获取详细数据
  const diskDetail = {
    ...defaultDetail,
    ...(monitorData?.performance?.detail?.disk || {}),
    // 确保所有数组和对象类型的属性都有默认值
    deviceStats: monitorData?.performance?.detail?.disk?.deviceStats || {},
    partitions: monitorData?.performance?.detail?.disk?.partitions || [],
    ioHistory: monitorData?.performance?.detail?.disk?.ioHistory || [],
    health: {
      devices: [],
      lastCheck: 0,
      ...(monitorData?.performance?.detail?.disk?.health || {})
    },
    spaceAnalysis: {
      largeDirectories: [],
      largeFiles: [],
      fileTypes: [],
      lastScan: 0,
      ...(monitorData?.performance?.detail?.disk?.spaceAnalysis || {})
    },
    ioAnalysis: {
      topProcesses: [],
      deviceStats: [],
      timestamp: 0,
      isToolInstalled: false,
      ...(monitorData?.performance?.detail?.disk?.ioAnalysis || {})
    }
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
    return <DiskDetail diskInfo={diskDetail} sessionId={sessionId} />;
  }

  return null;
}; 