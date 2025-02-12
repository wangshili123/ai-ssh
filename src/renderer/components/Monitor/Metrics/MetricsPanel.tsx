import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Progress, Space, Button, Tooltip } from 'antd';
import { ReloadOutlined, PauseOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { metricsManager } from '../../../services/monitor/metrics/metricsManager';
import { CPUInfo, CPUUsage, MemoryInfo } from '../../../services/monitor/metrics/metricsTypes';
import { formatBytes, formatFrequency } from '../../../utils/format';
import { Line } from '@ant-design/plots';

interface MetricsPanelProps {
  sessionId: string;
}

type ResourceType = 'cpu' | 'memory' | 'disk' | 'network' | 'gpu';

export const MetricsPanel: React.FC<MetricsPanelProps> = ({ sessionId }) => {
  // 状态定义
  const [cpuInfo, setCPUInfo] = useState<CPUInfo | null>(null);
  const [cpuUsage, setCPUUsage] = useState<CPUUsage | null>(null);
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [selectedResource, setSelectedResource] = useState<ResourceType>('cpu');
  const [chartData, setChartData] = useState<any[]>([]);

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
      updateChartData(data);
    };

    metricsManager.on('dataUpdated', handleDataUpdate);

    return () => {
      metricsManager.off('dataUpdated', handleDataUpdate);
      metricsManager.destroy();
    };
  }, [sessionId]);

  // 更新图表数据
  const updateChartData = (data: any) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-CN');
    const newData: Array<{time: string; value: number; core: string}> = [];

    if (selectedResource === 'cpu' && data.cpu?.usage?.length > 0) {
      const cpuData = data.cpu.usage[data.cpu.usage.length - 1];
      if (cpuData?.value?.perCore) {
        cpuData.value.perCore.forEach((usage: number, index: number) => {
          newData.push({
            time: timeStr,
            value: usage,
            core: `CPU ${index}`
          });
        });
      }
    }

    setChartData(prev => {
      const combined = [...prev, ...newData];
      // 保留最近60秒的数据
      return combined.slice(-480); // 8个核心 * 60个点
    });
  };

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

  // 渲染资源卡片
  const renderResourceCard = (type: ResourceType) => {
    let title = '';
    let value = 0;
    let subtitle = '';

    switch (type) {
      case 'cpu':
        title = 'CPU';
        value = Math.round(cpuUsage?.total || 0);
        subtitle = `${formatFrequency((cpuInfo?.frequency?.current || 0) * 1e6)}`;
        break;
      case 'memory':
        title = '内存';
        value = memoryInfo ? Math.round((memoryInfo.used / memoryInfo.total) * 100) : 0;
        subtitle = `${formatBytes(memoryInfo?.used || 0)} / ${formatBytes(memoryInfo?.total || 0)}`;
        break;
      case 'disk':
        title = '磁盘';
        value = 0;
        subtitle = '暂无数据';
        break;
      case 'network':
        title = '网络';
        value = 0;
        subtitle = '暂无数据';
        break;
      case 'gpu':
        title = 'GPU';
        value = 0;
        subtitle = '暂无数据';
        break;
    }

    return (
      <Card 
        bordered={false}
        className={`resource-card ${selectedResource === type ? 'selected' : ''}`}
        onClick={() => setSelectedResource(type)}
      >
        <Progress
          type="dashboard"
          percent={value}
          format={percent => `${percent}%`}
        />
        <div className="resource-title">{title}</div>
        <div className="resource-subtitle">{subtitle}</div>
      </Card>
    );
  };

  // 渲染CPU详细信息
  const renderCPUDetails = () => {
    const config = {
      data: chartData,
      xField: 'time',
      yField: 'value',
      seriesField: 'core',
      yAxis: {
        min: 0,
        max: 100,
        label: {
          formatter: (v: string) => `${v}%`,
        },
      },
      tooltip: {
        showMarkers: true,
        formatter: (datum: any) => ({
          name: datum.core,
          value: `${datum.value}%`
        })
      },
      animation: {
        appear: {
          duration: 0
        }
      },
    };

    return (
      <>
        <Card title="CPU 使用率 - 总体" bordered={false}>
          <div style={{ height: 200 }}>
            <Line {...config} />
          </div>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={8}>
              <Statistic title="使用率" value={cpuUsage?.total || 0} suffix="%" />
            </Col>
            <Col span={8}>
              <Statistic title="速度" value={formatFrequency((cpuInfo?.frequency?.current || 0) * 1e6)} />
            </Col>
            <Col span={8}>
              <Statistic title="进程" value={32} />
            </Col>
          </Row>
        </Card>
        <Card title="CPU 信息" bordered={false} style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic title="处理器" value={cpuInfo?.model || 'N/A'} />
            </Col>
            <Col span={6}>
              <Statistic title="核心数" value={cpuInfo?.cores || 0} />
            </Col>
            <Col span={6}>
              <Statistic title="线程数" value={cpuInfo?.threads || 0} />
            </Col>
          </Row>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col span={6}>
              <Statistic title="基本速度" value={formatFrequency((cpuInfo?.frequency?.min || 0) * 1e6)} />
            </Col>
            <Col span={6}>
              <Statistic title="最大速度" value={formatFrequency((cpuInfo?.frequency?.max || 0) * 1e6)} />
            </Col>
            <Col span={12}>
              <Statistic title="缓存" value={`L1: ${cpuInfo?.cache?.l1d || 0}KB, L2: ${cpuInfo?.cache?.l2 || 0}KB, L3: ${cpuInfo?.cache?.l3 || 0}KB`} />
            </Col>
          </Row>
        </Card>
      </>
    );
  };

  // 渲染内存详细信息
  const renderMemoryDetails = () => {
    return (
      <Card title="内存使用情况" bordered={false}>
        <Progress
          percent={memoryInfo ? Math.round((memoryInfo.used / memoryInfo.total) * 100) : 0}
          strokeWidth={20}
          showInfo={false}
        />
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={8}>
            <Statistic title="已使用" value={formatBytes(memoryInfo?.used || 0)} />
          </Col>
          <Col span={8}>
            <Statistic title="可用" value={formatBytes(memoryInfo?.available || 0)} />
          </Col>
          <Col span={8}>
            <Statistic title="已提交" value={formatBytes((memoryInfo?.total || 0) - (memoryInfo?.available || 0))} />
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={8}>
            <Statistic title="缓存" value={formatBytes((memoryInfo?.buffers || 0) + (memoryInfo?.cached || 0))} />
          </Col>
          <Col span={8}>
            <Statistic title="分页池" value={formatBytes(memoryInfo?.swapUsed || 0)} />
          </Col>
          <Col span={8}>
            <Statistic title="非分页池" value={formatBytes(memoryInfo?.swapTotal || 0)} />
          </Col>
        </Row>
      </Card>
    );
  };

  // 渲染右侧详细信息
  const renderDetails = () => {
    switch (selectedResource) {
      case 'cpu':
        return renderCPUDetails();
      case 'memory':
        return renderMemoryDetails();
      default:
        return <Card>暂无数据</Card>;
    }
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
            {renderResourceCard('cpu')}
            {renderResourceCard('memory')}
            {renderResourceCard('disk')}
            {renderResourceCard('network')}
            {renderResourceCard('gpu')}
          </Space>
        </Col>

        {/* 右侧详细信息 */}
        <Col span={18}>
          {renderDetails()}
        </Col>
      </Row>

      <style>{`
        .resource-card {
          cursor: pointer;
          transition: all 0.3s;
        }
        .resource-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .resource-card.selected {
          border: 2px solid #1890ff;
        }
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