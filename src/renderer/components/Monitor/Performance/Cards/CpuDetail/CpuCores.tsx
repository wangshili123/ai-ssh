import React from 'react';
import ReactECharts from 'echarts-for-react';
import { CpuDetailInfo } from '../../../../../types/monitor';
import type { ECOption } from '../../../../../types/echarts';
import './CpuDetailTab.css';

interface CpuCoresProps {
  cpuInfo: CpuDetailInfo;
}

export const CpuCores: React.FC<CpuCoresProps> = ({ cpuInfo }) => {
  return (
    <div className="cpu-cores">
      <div className="cpu-cores-grid">
        {cpuInfo.cores.map((usage, index) => (
          <div key={index} className="core-chart">
            <div className="core-header">
              <span>核心 {index + 1}</span>
              <span>{Math.round(usage)}%</span>
            </div>
            <div className="echarts-container">
              <ReactECharts
                option={getCoreChartOption(cpuInfo.coreUsageHistory[index] || [])}
                style={{ height: '100%', width: '100%' }}
                notMerge={true}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 核心图表配置
const getCoreChartOption = (history: Array<{ timestamp: number; usage: number; speed?: number }>): ECOption => ({
  grid: {
    top: 5,
    right: 5,
    bottom: 5,
    left: 5,
    containLabel: false
  },
  xAxis: {
    type: 'time',
    show: false
  },
  yAxis: {
    type: 'value',
    show: false,
    min: 0,
    max: 100
  },
  series: [{
    type: 'line',
    smooth: true,
    showSymbol: false,
    lineStyle: {
      width: 1,
      color: '#1890ff'
    },
    areaStyle: {
      color: {
        type: 'linear',
        x: 0,
        y: 0,
        x2: 0,
        y2: 1,
        colorStops: [{
          offset: 0,
          color: 'rgba(24,144,255,0.3)'
        }, {
          offset: 1,
          color: 'rgba(24,144,255,0.1)'
        }]
      }
    },
    data: history.map(item => [
      item.timestamp,
      item.usage,
      item.speed
    ])
  }]
}); 