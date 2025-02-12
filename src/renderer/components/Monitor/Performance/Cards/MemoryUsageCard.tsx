import React, { useEffect, useState } from 'react';
import { Card, Progress } from 'antd';
import { monitorManager } from '../../../../services/monitor/monitorManager';
import { formatBytes } from '../../../../utils/format';
import { MemoryInfo } from '../../../../types/monitor';

interface MemoryUsageCardProps {
  sessionId: string;
  simple?: boolean;
  detailed?: boolean;
}

export const MemoryUsageCard: React.FC<MemoryUsageCardProps> = ({ sessionId }) => {
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo>({
    total: 0,
    used: 0,
    free: 0,
    cached: 0,
    buffers: 0,
    usagePercent: 0,
  });

  useEffect(() => {
    const session = monitorManager.getSession(sessionId);
    if (!session) return;

    // 初始化数据
    if (session.monitorData?.memory) {
      setMemoryInfo(session.monitorData.memory);
    }

    // 监听会话更新
    const updateInterval = setInterval(() => {
      const session = monitorManager.getSession(sessionId);
      if (session?.monitorData?.memory) {
        setMemoryInfo(session.monitorData.memory);
      }
    }, session.config?.refreshInterval || 5000);

    return () => clearInterval(updateInterval);
  }, [sessionId]);

  return (
    <Card title="内存使用" size="small">
      <Progress
        type="circle"
        percent={Math.round(memoryInfo.usagePercent)}
        format={(percent) => `${percent}%`}
      />
      <div style={{ marginTop: 16 }}>
        <p>总内存: {formatBytes(memoryInfo.total)}</p>
        <p>已使用: {formatBytes(memoryInfo.used)}</p>
        <p>可用: {formatBytes(memoryInfo.free)}</p>
        <p>缓存: {formatBytes(memoryInfo.cached)}</p>
        <p>缓冲区: {formatBytes(memoryInfo.buffers)}</p>
      </div>
    </Card>
  );
}; 