import React, { useEffect, useState } from 'react';
import { Card } from 'antd';
import { Line } from '@ant-design/plots';
import { metricsManager } from '../../../services/monitor/metrics/metricsManager';
import { TimeSeriesData, CPUUsage, MemoryInfo } from '../../../services/monitor/metrics/metricsTypes';
import { formatDateTime, formatPercent } from '../../../utils/format';

interface MetricsChartProps {
  sessionId: string;
}

interface ChartData {
  timestamp: string;
  value: number;
  metric: string;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({ sessionId }) => {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    const handleDataUpdate = (metricsData: any) => {
      const newData: ChartData[] = [];

      // 处理CPU使用率数据
      metricsData.cpu.usage.forEach((item: TimeSeriesData<CPUUsage>) => {
        newData.push({
          timestamp: formatDateTime(item.timestamp),
          value: item.value.total,
          metric: 'CPU使用率'
        });
      });

      // 处理内存使用率数据
      if (metricsData.memory.info) {
        const memInfo = metricsData.memory.info as MemoryInfo;
        const memoryUsage = (memInfo.used / memInfo.total) * 100;
        newData.push({
          timestamp: formatDateTime(Date.now()),
          value: memoryUsage,
          metric: '内存使用率'
        });
      }

      setData(newData);
    };

    metricsManager.on('dataUpdated', handleDataUpdate);

    return () => {
      metricsManager.off('dataUpdated', handleDataUpdate);
    };
  }, [sessionId]);

  const config = {
    data,
    xField: 'timestamp',
    yField: 'value',
    seriesField: 'metric',
    yAxis: {
      label: {
        formatter: (v: string) => formatPercent(parseFloat(v)),
      },
      min: 0,
      max: 100,
    },
    xAxis: {
      type: 'time',
    },
    tooltip: {
      showMarkers: false,
      formatter: (datum: any) => {
        return {
          name: datum.metric,
          value: formatPercent(datum.value),
        };
      },
    },
    legend: {
      position: 'top' as const,
    },
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    point: {
      size: 3,
      shape: 'circle',
      style: {
        opacity: 0.5,
        stroke: '#fff',
        lineWidth: 1,
      },
    },
    state: {
      active: {
        style: {
          shadowBlur: 4,
          stroke: '#000',
          fill: 'red',
        },
      },
    },
    theme: {
      geometries: {
        line: {
          line: {
            style: {
              lineWidth: 2,
            },
          },
        },
      },
    },
  };

  return (
    <Card title="资源使用趋势" bordered={false}>
      <Line {...config} />
    </Card>
  );
}; 