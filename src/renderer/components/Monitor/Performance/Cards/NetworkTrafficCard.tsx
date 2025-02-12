import React, { useEffect, useState } from 'react';
import { Card, Progress } from 'antd';
import { monitorManager } from '../../../../services/monitor/monitorManager';
import { NetworkInfo } from '../../../../types/monitor';
import { formatBitRate } from '../../../../utils/format';

interface NetworkTrafficCardProps {
  sessionId: string;
  simple?: boolean;
  detailed?: boolean;
}

export const NetworkTrafficCard: React.FC<NetworkTrafficCardProps> = ({ sessionId, simple, detailed }) => {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    interfaces: [],
    totalRx: 0,
    totalTx: 0,
    rxSpeed: 0,
    txSpeed: 0
  });

  useEffect(() => {
    const session = monitorManager.getSession(sessionId);
    if (!session) return;

    if (session.monitorData?.network) {
      setNetworkInfo(session.monitorData.network);
    }

    const updateInterval = setInterval(() => {
      const session = monitorManager.getSession(sessionId);
      if (session?.monitorData?.network) {
        setNetworkInfo(session.monitorData.network);
      }
    }, session.config?.refreshInterval || 5000);

    return () => clearInterval(updateInterval);
  }, [sessionId]);

  if (simple) {
    return (
      <div className="resource-summary">
        <div className="resource-title">网络</div>
        <div className="resource-value">
          ↑ {formatBitRate(networkInfo.txSpeed)}
          <br />
          ↓ {formatBitRate(networkInfo.rxSpeed)}
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
                <span className="speed-value">{formatBitRate(networkInfo.txSpeed)}</span>
              </div>
              <div className="speed-item">
                <span className="speed-label">接收速率</span>
                <span className="speed-value">{formatBitRate(networkInfo.rxSpeed)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="interfaces-list">
          <h3>网络接口</h3>
          {networkInfo.interfaces.map((iface, index) => (
            <div key={index} className="interface-item">
              <div className="interface-header">
                <span>{iface.name}</span>
              </div>
              <div className="interface-speeds">
                <div className="speed-item">
                  <span>发送: {formatBitRate(iface.txSpeed)}</span>
                  <Progress percent={(iface.txSpeed / networkInfo.txSpeed) * 100} size="small" />
                </div>
                <div className="speed-item">
                  <span>接收: {formatBitRate(iface.rxSpeed)}</span>
                  <Progress percent={(iface.rxSpeed / networkInfo.rxSpeed) * 100} size="small" />
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
          <span className="speed-value">{formatBitRate(networkInfo.txSpeed)}</span>
        </div>
        <div className="speed-item">
          <span className="speed-label">接收速率</span>
          <span className="speed-value">{formatBitRate(networkInfo.rxSpeed)}</span>
        </div>
      </div>
    </Card>
  );
}; 