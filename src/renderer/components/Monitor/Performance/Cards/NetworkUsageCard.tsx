import React from 'react';
import { Progress } from 'antd';
import { NetworkBasicInfo, NetworkDetailInfo, MonitorData } from '../../../../types/monitor';
import { formatBytes } from '../../../../utils/format';
import { getProgressColor, getResourceStatus } from '../../../../utils/theme';
import './NetworkUsageCard.css';

interface NetworkUsageCardProps {
  sessionId: string;
  monitorData?: MonitorData;
  simple?: boolean;
  detailed?: boolean;
}

export const NetworkUsageCard: React.FC<NetworkUsageCardProps> = ({ 
  sessionId, 
  monitorData,
  simple, 
  detailed 
}) => {
  // 定义基础数据的默认值
  const defaultBasic: NetworkBasicInfo = {
    totalRx: 0,
    totalTx: 0,
    rxSpeed: 0,
    txSpeed: 0
  };

  // 定义网络接口的默认值
  const defaultInterface = {
    name: '',
    rx: 0,
    tx: 0,
    rxSpeed: 0,
    txSpeed: 0
  };

  // 定义详细数据的默认值
  const defaultDetail: NetworkDetailInfo = {
    ...defaultBasic,
    interfaces: []
  };

  // 安全地获取基础数据
  const networkBasic = {
    ...defaultBasic,
    ...(monitorData?.performance?.basic?.network || {})
  };

  // 安全地获取详细数据
  const networkDetail = {
    ...defaultDetail,
    ...(monitorData?.performance?.detail?.network || {}),
    // 确保接口数组有默认值，并且每个接口都有完整的属性
    interfaces: (monitorData?.performance?.detail?.network?.interfaces || [])
      .map(iface => ({
        ...defaultInterface,
        ...iface
      }))
  };

  // 计算总带宽使用率（假设最大带宽为1Gbps）
  const maxBandwidth = 1000 * 1000 * 1000; // 1 Gbps in bytes
  const bandwidthUsage = Math.min(100, ((networkBasic.rxSpeed + networkBasic.txSpeed) / maxBandwidth) * 100);

  // 简单视图用于左侧资源列表
  if (simple) {
    const status = getResourceStatus(bandwidthUsage);
    return (
      <div className={`resource-summary network-usage-card ${status}`}>
        <div className="resource-title">网络</div>
        <div className="resource-value">
          <span className="usage-value">
            ↓{formatBytes(networkBasic.rxSpeed)}/s
          </span>
          <span className="usage-value">
            ↑{formatBytes(networkBasic.txSpeed)}/s
          </span>
        </div>
        <Progress 
          percent={Math.round(bandwidthUsage)} 
          showInfo={false} 
          size="small"
          strokeColor={getProgressColor(bandwidthUsage)}
        />
      </div>
    );
  }

  // 详细视图
  if (detailed) {
    return (
      <div className="network-details-view">
        {/* 网络详细信息的实现将在后续添加 */}
        <div>网络监控详细信息开发中...</div>
      </div>
    );
  }

  return null;
}; 