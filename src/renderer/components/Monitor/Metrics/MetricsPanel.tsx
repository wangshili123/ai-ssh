import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Progress, Space, Button, Tooltip } from 'antd';
import { ReloadOutlined, PauseOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { metricsManager } from '../../../services/monitor/metrics/metricsManager';
import { CPUInfo, CPUUsage, MemoryInfo } from '../../../services/monitor/metrics/metricsTypes';
import { formatBytes } from '../../../utils/format';
import { MetricsChart } from './MetricsChart';

interface MetricsPanelProps {
  sessionId: string;
}

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ sessionId }) => {
  // 状态定义
  const [cpuInfo, setCPUInfo] = useState<CPUInfo | null>(null);
  const [cpuUsage, setCPUUsage] = useState<CPUUsage | null>(null);
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);

  // 初始化和清理
  useEffect(() => {
    const initialize = async () => {
      try {
        await metricsManager.initialize();
        const data = metricsManager.getData();
        setCPUInfo(data.cpu.info);
        setMemoryInfo(data.memory.info);
      } catch (error) {
        console.error('Failed to initialize metrics panel:', error);
      }
    };

    initialize();

    // 监听数据更新
    const handleDataUpdate = (data: any) => {
      if (data.cpu.usage.length > 0) {
        setCPUUsage(data.cpu.usage[data.cpu.usage.length - 1].value);
      }
      if (data.memory.info) {
        setMemoryInfo(data.memory.info);
      }
    };

    metricsManager.on('dataUpdated', handleDataUpdate);

    return () => {
      metricsManager.off('dataUpdated', handleDataUpdate);
      metricsManager.destroy();
    };
  }, [sessionId]);

  // 处理刷新控制
  const handleRefreshToggle = () => {
    if (isRefreshing) {
      metricsManager.stopRefresh();
    } else {
      metricsManager.startRefresh();
    }
    setIsRefreshing(!isRefreshing);
  };

  const handleManualRefresh = () => {
    metricsManager.refresh();
  };

  // 计算内存使用率
  const getMemoryUsagePercent = () => {
    if (!memoryInfo) return 0;
    return Math.round((memoryInfo.used / memoryInfo.total) * 100);
  };

  return (
    <div className="metrics-panel">
      {/* 控制栏 */}
      <div className="metrics-control">
        <Space>
          <Tooltip title={isRefreshing ? '暂停刷新' : '开始刷新'}>
            <Button
              type="text"
              icon={isRefreshing ? <PauseOutlined /> : <PlayCircleOutlined />}
              onClick={handleRefreshToggle}
            />
          </Tooltip>
          <Tooltip title="手动刷新">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={handleManualRefresh}
            />
          </Tooltip>
        </Space>
      </div>

      <Row gutter={16}>
        {/* 左侧资源列表 */}
        <Col span={6}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {/* CPU */}
            <Card bordered={false}>
              <Progress
                type="dashboard"
                percent={Math.round(cpuUsage?.total || 0)}
                format={percent => `${percent}%`}
              />
              <div className="resource-title">CPU</div>
              <div className="resource-subtitle">
                {cpuInfo?.frequency?.current || 0} MHz
              </div>
            </Card>

            {/* 内存 */}
            <Card bordered={false}>
              <Progress
                type="dashboard"
                percent={getMemoryUsagePercent()}
                format={percent => `${percent}%`}
              />
              <div className="resource-title">内存</div>
              <div className="resource-subtitle">
                {formatBytes(memoryInfo?.used || 0)} / {formatBytes(memoryInfo?.total || 0)}
              </div>
            </Card>

            {/* 磁盘 */}
            <Card bordered={false}>
              <Progress
                type="dashboard"
                percent={0}
                format={() => '0%'}
              />
              <div className="resource-title">磁盘</div>
              <div className="resource-subtitle">
                暂无数据
              </div>
            </Card>

            {/* 网络 */}
            <Card bordered={false}>
              <Progress
                type="dashboard"
                percent={0}
                format={() => '0%'}
              />
              <div className="resource-title">网络</div>
              <div className="resource-subtitle">
                暂无数据
              </div>
            </Card>
          </Space>
        </Col>

        {/* 右侧详细信息 */}
        <Col span={18}>
          {/* 图表区域 */}
          <Card title="资源使用趋势" bordered={false}>
            <div style={{ height: 300 }}>
              <MetricsChart sessionId={sessionId} />
            </div>
          </Card>

          {/* CPU详细信息 */}
          <Card title="CPU详细信息" bordered={false} style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Statistic title="型号" value={cpuInfo?.model || 'N/A'} />
              </Col>
              <Col span={6}>
                <Statistic title="核心数" value={cpuInfo?.cores || 0} suffix={`/ ${cpuInfo?.threads || 0} 线程`} />
              </Col>
              <Col span={6}>
                <Statistic title="用户空间" value={cpuUsage?.user || 0} suffix="%" precision={1} />
              </Col>
              <Col span={6}>
                <Statistic title="系统空间" value={cpuUsage?.system || 0} suffix="%" precision={1} />
              </Col>
            </Row>
          </Card>

          {/* 内存详细信息 */}
          <Card title="内存详细信息" bordered={false} style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={6}>
                <Statistic title="总内存" value={formatBytes(memoryInfo?.total || 0)} />
              </Col>
              <Col span={6}>
                <Statistic title="已用内存" value={formatBytes(memoryInfo?.used || 0)} />
              </Col>
              <Col span={6}>
                <Statistic title="可用内存" value={formatBytes(memoryInfo?.available || 0)} />
              </Col>
              <Col span={6}>
                <Statistic title="缓存" value={formatBytes((memoryInfo?.buffers || 0) + (memoryInfo?.cached || 0))} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <style>{`
        .resource-title {
          text-align: center;
          font-size: 16px;
          margin-top: 8px;
        }
        .resource-subtitle {
          text-align: center;
          font-size: 12px;
          color: rgba(0, 0, 0, 0.45);
        }
      `}</style>
    </div>
  );
}; 