import React from 'react';
import { Tooltip } from 'antd';
import { NetworkBasicInfo, NetworkDetailInfo, MonitorData } from '../../../../types/monitor';
import { formatBytes } from '../../../../utils/format';
import { NetworkDetail } from './NetworkDetail/NetworkDetailTab';
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
    interfaces: [],
    connections: {
      total: 0,
      tcp: 0,
      udp: 0,
      listening: 0,
      list: []
    },
    processes: {
      isToolInstalled: false,
      list: []
    },
    history: []
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

  // 简单视图用于左侧资源列表
  if (simple) {
    return (
      <div className="resource-summary network-usage-card">
        <div className="resource-title">网络</div>
        <div className="resource-value network-speeds">
          <Tooltip title="下载速度">
            <div className="speed-item">
              <span className="speed-icon">↓</span>
              <span className="speed-value">{formatBytes(networkBasic.rxSpeed)}/s</span>
            </div>
          </Tooltip>
          <Tooltip title="上传速度">
            <div className="speed-item">
              <span className="speed-icon">↑</span>
              <span className="speed-value">{formatBytes(networkBasic.txSpeed)}/s</span>
            </div>
          </Tooltip>
        </div>
      </div>
    );
  }

  // 详细视图
  if (detailed) {
    return (
      <div className="network-details-view">
        <NetworkDetail networkInfo={networkDetail} sessionId={sessionId} />
      </div>
    );
  }

  return null;
}; 