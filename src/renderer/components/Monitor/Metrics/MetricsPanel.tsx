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
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
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

        {/* 图表 */}
        <div className="metrics-chart">
          <MetricsChart sessionId={sessionId} />
        </div>

        {/* CPU信息卡片 */}
        <Card title="CPU 监控" bordered={false}>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <div className="metrics-statistic">
                <Statistic
                  title="CPU型号"
                  value={cpuInfo?.model || 'N/A'}
                  valueStyle={{ fontSize: '14px' }}
                />
              </div>
            </Col>
            <Col span={8}>
              <div className="metrics-statistic">
                <Statistic
                  title="核心数"
                  value={cpuInfo?.cores || 0}
                  suffix={`/ ${cpuInfo?.threads || 0} 线程`}
                />
              </div>
            </Col>
            <Col span={8}>
              <div className="metrics-statistic">
                <Statistic
                  title="当前频率"
                  value={cpuInfo?.frequency?.current || 0}
                  suffix="MHz"
                />
              </div>
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
            <Col span={12}>
              <div className="metrics-progress">
                <Progress
                  type="dashboard"
                  percent={Math.round(cpuUsage?.total || 0)}
                  format={percent => `${percent}%`}
                />
                <div className="progress-label">CPU使用率</div>
              </div>
            </Col>
            <Col span={12}>
              <Row>
                <Col span={12}>
                  <div className="metrics-statistic">
                    <Statistic
                      title="用户空间"
                      value={cpuUsage?.user || 0}
                      suffix="%"
                      precision={1}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="metrics-statistic">
                    <Statistic
                      title="系统空间"
                      value={cpuUsage?.system || 0}
                      suffix="%"
                      precision={1}
                    />
                  </div>
                </Col>
              </Row>
              <Row style={{ marginTop: '16px' }}>
                <Col span={12}>
                  <div className="metrics-statistic">
                    <Statistic
                      title="IO等待"
                      value={cpuUsage?.iowait || 0}
                      suffix="%"
                      precision={1}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="metrics-statistic">
                    <Statistic
                      title="空闲"
                      value={cpuUsage?.idle || 0}
                      suffix="%"
                      precision={1}
                    />
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>

        {/* 内存信息卡片 */}
        <Card title="内存监控" bordered={false}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <div className="metrics-progress">
                <Progress
                  type="dashboard"
                  percent={getMemoryUsagePercent()}
                  format={percent => `${percent}%`}
                />
                <div className="progress-label">内存使用率</div>
              </div>
            </Col>
            <Col span={12}>
              <Row>
                <Col span={12}>
                  <div className="metrics-statistic">
                    <Statistic
                      title="总内存"
                      value={formatBytes(memoryInfo?.total || 0)}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="metrics-statistic">
                    <Statistic
                      title="已用内存"
                      value={formatBytes(memoryInfo?.used || 0)}
                    />
                  </div>
                </Col>
              </Row>
              <Row style={{ marginTop: '16px' }}>
                <Col span={12}>
                  <div className="metrics-statistic">
                    <Statistic
                      title="可用内存"
                      value={formatBytes(memoryInfo?.available || 0)}
                    />
                  </div>
                </Col>
                <Col span={12}>
                  <div className="metrics-statistic">
                    <Statistic
                      title="缓存"
                      value={formatBytes((memoryInfo?.buffers || 0) + (memoryInfo?.cached || 0))}
                    />
                  </div>
                </Col>
              </Row>
            </Col>
          </Row>
        </Card>
      </Space>

      <style>{`
        .metrics-panel {
          padding: 16px;
          background: #f0f2f5;
          min-height: 100%;
        }
      `}</style>
    </div>
  );
}; 