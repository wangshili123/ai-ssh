import React from 'react';
import { Card, Progress } from 'antd';
import type { NetworkBasicInfo, NetworkDetailInfo, MonitorData } from '../../../../types/monitor';
import { formatBitRate } from '../../../../utils/format';
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
  const networkBasic = monitorData?.performance?.basic?.network || {
    totalRx: 0,
    totalTx: 0,
    rxSpeed: 0,
    txSpeed: 0
  };

  const networkDetail = monitorData?.performance?.detail?.network || {
    ...networkBasic,
    interfaces: []
  };

  if (simple) {
    return (
      <div className="resource-summary network-traffic-card">
        <div className="resource-title">网络</div>
        <div className="resource-value">
          <div className="network-speed">
            <div className="speed-item">↑ {formatBitRate(networkBasic.txSpeed)}</div>
            <div className="speed-item">↓ {formatBitRate(networkBasic.rxSpeed)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (detailed) {
    return (
      <div className="resource-details">
        <div className="resource-header">
          <h2>网络使用情况</h2>
          <div className="resource-summary">
            <div className="network-speeds">
              <div className="speed-item">
                <span className="speed-label">发送速率</span>
                <span className="speed-value">{formatBitRate(networkDetail.txSpeed)}</span>
              </div>
              <div className="speed-item">
                <span className="speed-label">接收速率</span>
                <span className="speed-value">{formatBitRate(networkDetail.rxSpeed)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="interfaces-list">
          <h3>网络接口</h3>
          {networkDetail.interfaces.map((iface, index) => (
            <div key={index} className="interface-item">
              <div className="interface-header">
                <span>{iface.name}</span>
              </div>
              <div className="interface-speeds">
                <div className="speed-item">
                  <span>发送: {formatBitRate(iface.txSpeed)}</span>
                  <Progress percent={(iface.txSpeed / networkDetail.txSpeed) * 100} size="small" />
                </div>
                <div className="speed-item">
                  <span>接收: {formatBitRate(iface.rxSpeed)}</span>
                  <Progress percent={(iface.rxSpeed / networkDetail.rxSpeed) * 100} size="small" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card title="网络流量" size="small">
      <div className="network-summary">
        <div className="speed-item">
          <span className="speed-label">发送速率</span>
          <span className="speed-value">{formatBitRate(networkBasic.txSpeed)}</span>
        </div>
        <div className="speed-item">
          <span className="speed-label">接收速率</span>
          <span className="speed-value">{formatBitRate(networkBasic.rxSpeed)}</span>
        </div>
      </div>
    </Card>
  );
}; 