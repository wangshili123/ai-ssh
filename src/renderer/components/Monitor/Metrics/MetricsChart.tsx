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
  time: string;
  value: number;
  type: string;
}

export const MetricsChart: React.FC<MetricsChartProps> = ({ sessionId }) => {
  const [data, setData] = useState<ChartData[]>([]);

  useEffect(() => {
    console.log('[MetricsChart] 初始化监听, sessionId:', sessionId);

    const handleDataUpdate = (metricsData: any) => {
      console.log('[MetricsChart] 原始数据:', JSON.stringify(metricsData, null, 2));
      const newData: ChartData[] = [];
      const currentTime = formatDateTime(Date.now());

      // 处理CPU使用率数据
      if (metricsData.cpu?.usage?.length > 0) {
        const cpuData = metricsData.cpu.usage[metricsData.cpu.usage.length - 1];
        console.log('[MetricsChart] CPU原始数据:', cpuData);
        if (cpuData?.value?.total != null) {
          const cpuValue = Number(cpuData.value.total);
          console.log('[MetricsChart] CPU处理后的值:', cpuValue);
          newData.push({
            time: currentTime,
            value: cpuValue,
            type: 'CPU使用率'
          });
        }
      }

      // 处理内存使用率数据
      if (metricsData.memory?.info) {
        const memInfo = metricsData.memory.info;
        console.log('[MetricsChart] 内存原始数据:', memInfo);
        if (memInfo.total > 0) {
          const memoryUsage = (memInfo.used / memInfo.total) * 100;
          console.log('[MetricsChart] 内存处理后的值:', memoryUsage);
          newData.push({
            time: currentTime,
            value: memoryUsage,
            type: '内存使用率'
          });
        }
      }

      console.log('[MetricsChart] 新数据点:', JSON.stringify(newData, null, 2));

      // 更新状态
      setData(prevData => {
        console.log('[MetricsChart] 之前的数据:', JSON.stringify(prevData, null, 2));
        
        // 合并新旧数据，每种类型保留最新的10个点
        const maxPoints = 10;
        const types = ['CPU使用率', '内存使用率'];
        const result: ChartData[] = [];

        types.forEach(type => {
          // 获取当前类型的所有数据点
          const typeData = [...prevData.filter(d => d.type === type), 
                          ...newData.filter(d => d.type === type)];
          
          // 按时间排序
          typeData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
          
          // 只保留最新的点
          const latestData = typeData.slice(-maxPoints);
          result.push(...latestData);
        });

        console.log('[MetricsChart] 更新后的数据:', JSON.stringify(result, null, 2));
        return result;
      });
    };

    // 立即获取一次数据
    const initData = metricsManager.getData();
    console.log('[MetricsChart] 初始数据:', JSON.stringify(initData, null, 2));
    handleDataUpdate(initData);

    metricsManager.on('dataUpdated', handleDataUpdate);

    return () => {
      console.log('[MetricsChart] 清理监听');
      metricsManager.off('dataUpdated', handleDataUpdate);
    };
  }, [sessionId]);

  // 确保数据有效
  const validData = data.filter(item => 
    item && 
    typeof item.value === 'number' && 
    !isNaN(item.value) && 
    typeof item.time === 'string' && 
    typeof item.type === 'string'
  );

  console.log('[MetricsChart] 最终渲染数据:', JSON.stringify(validData, null, 2));

  const config = {
    data: validData,
    xField: 'time',
    yField: 'value',
    seriesField: 'type',
    xAxis: {
      type: 'time',
      mask: 'HH:mm:ss',
    },
    yAxis: {
      min: 0,
      max: 100,
      label: {
        formatter: (v: string) => `${Math.round(parseFloat(v))}%`,
      },
    },
    tooltip: {
      showMarkers: true,
      shared: true,
      showCrosshairs: true,
      formatter: (datum: any) => ({
        name: datum.type,
        value: `${Math.round(datum.value)}%`,
      }),
    },
    legend: {
      position: 'top' as const,
    },
    smooth: true,
    animation: {
      appear: {
        duration: 0,
      },
    },
    color: ['#1890ff', '#2fc25b'],
    lineStyle: (datum: any) => {
      return {
        lineWidth: 2,
      };
    },
    point: {
      size: 4,
      shape: 'circle',
      style: {
        fill: '#fff',
        stroke: '#5B8FF9',
        lineWidth: 2,
      },
    },
    interactions: [
      {
        type: 'element-active',
      },
    ],
  };

  return (
    <Card title="资源使用趋势" bordered={false}>
      <div style={{ height: 300 }}>
        <Line {...config} />
      </div>
    </Card>
  );
}; 