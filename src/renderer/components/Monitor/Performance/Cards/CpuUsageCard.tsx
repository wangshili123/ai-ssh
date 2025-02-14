import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { CpuBasicInfo, CpuDetailInfo, MonitorData } from '../../../../types/monitor';
import type { ECOption } from '../../../../types/echarts';
import { formatFrequency } from '../../../../utils/format';
import './CpuUsageCard.css';

interface CpuUsageCardProps {
  sessionId: string;
  monitorData?: MonitorData;
  simple?: boolean;
  detailed?: boolean;
}

const MAX_HISTORY_POINTS = 60; // 保存60个历史数据点

export const CpuUsageCard: React.FC<CpuUsageCardProps> = ({ 
  sessionId, 
  monitorData,
  simple, 
  detailed 
}) => {
  const [cpuHistory, setCpuHistory] = useState<{
    usageHistory: CpuDetailInfo['usageHistory'];
    coreUsageHistory: CpuDetailInfo['coreUsageHistory'];
  }>({
    usageHistory: [],
    coreUsageHistory: []
  });

  // 更新历史数据
  useEffect(() => {
    const cpuData = monitorData?.performance?.detail?.cpu;
    if (cpuData?.cores) {
      setCpuHistory(prev => {
        const now = Date.now();
        const newUsageHistory = [
          ...prev.usageHistory,
          { 
            timestamp: now, 
            usage: cpuData.usage || 0, 
            speed: cpuData.currentSpeed || 0 
          }
        ].slice(-MAX_HISTORY_POINTS);

        const newCoreUsageHistory = cpuData.cores.map((usage, index) => {
          const coreHistory = prev.coreUsageHistory[index] || [];
          return [
            ...coreHistory,
            { 
              timestamp: now, 
              usage: usage || 0, 
              speed: cpuData.currentSpeed || 0 
            }
          ].slice(-MAX_HISTORY_POINTS);
        });

        return {
          usageHistory: newUsageHistory,
          coreUsageHistory: newCoreUsageHistory
        };
      });
    }
  }, [monitorData]);

  const cpuBasic = monitorData?.performance?.basic?.cpu || {
    usage: 0,
    speed: 0,
    currentSpeed: 0,
    temperature: undefined
  };

  const cpuDetail = monitorData?.performance?.detail?.cpu || {
    ...cpuBasic,
    cores: [],
    model: '',
    maxSpeed: undefined,
    minSpeed: undefined,
    physicalCores: 0,
    logicalCores: 0,
    cache: {},
    architecture: undefined,
    vendor: undefined,
    socket: undefined,
    virtualization: undefined,
    usageHistory: cpuHistory.usageHistory,
    coreUsageHistory: cpuHistory.coreUsageHistory
  };

  // 简单视图用于左侧资源列表
  if (simple) {
    return (
      <div className="resource-summary cpu-usage-card">
        <div className="resource-title">CPU</div>
        <div className="resource-value">
          <span className="usage-value">{Math.round(cpuBasic.usage)}%</span>
          <span className="resource-speed">{formatFrequency(cpuBasic.currentSpeed || cpuBasic.speed)}</span>
        </div>
      </div>
    );
  }

  // 详细视图
  return (
    <div className="cpu-performance-container">
      {/* 上方区域：CPU信息和使用率图表 */}
      <div className="cpu-top-section">
        {/* CPU信息面板 */}
        <div className="cpu-info-panel">
          <div className="info-row">
            <span className="info-item">
              <span className="info-label">处理器型号:</span>
              <span className="info-value">{cpuDetail.model}</span>
            </span>
            <span className="info-item">
              <span className="info-label">制造商:</span>
              <span className="info-value">{cpuDetail.vendor || '未知'}</span>
            </span>
            <span className="info-item">
              <span className="info-label">基本速度:</span>
              <span className="info-value">{formatFrequency(cpuDetail.speed)}</span>
            </span>
          </div>
          <div className="info-row">
            <span className="info-item">
              <span className="info-label">当前速度:</span>
              <span className="info-value">{formatFrequency(cpuDetail.currentSpeed || cpuDetail.speed)}</span>
            </span>
            <span className="info-item">
              <span className="info-label">物理核心:</span>
              <span className="info-value">{cpuDetail.physicalCores}</span>
            </span>
            <span className="info-item">
              <span className="info-label">逻辑处理器:</span>
              <span className="info-value">{cpuDetail.logicalCores}</span>
            </span>
          </div>
          <div className="info-row">
            {cpuDetail.cache.l1 && (
              <span className="info-item">
                <span className="info-label">L1缓存:</span>
                <span className="info-value">{cpuDetail.cache.l1} KB</span>
              </span>
            )}
            {cpuDetail.cache.l2 && (
              <span className="info-item">
                <span className="info-label">L2缓存:</span>
                <span className="info-value">{cpuDetail.cache.l2} KB</span>
              </span>
            )}
            {cpuDetail.cache.l3 && (
              <span className="info-item">
                <span className="info-label">L3缓存:</span>
                <span className="info-value">{cpuDetail.cache.l3} KB</span>
              </span>
            )}
          </div>
        </div>

        {/* CPU使用率主图表 */}
        <div className="cpu-main-chart">
          <div className="chart-header">
            <div className="chart-title">CPU 利用率</div>
            <div className="chart-value">{Math.round(cpuDetail.usage)}%</div>
          </div>
          <div className="echarts-container">
            <ReactECharts
              option={getMainChartOption(cpuDetail)}
              style={{ height: '100%', width: '100%' }}
              notMerge={true}
            />
          </div>
        </div>
      </div>

      {/* 下方区域：CPU核心网格 */}
      <div className="cpu-cores-section">
        <div className="section-title">每个处理器核心的使用率</div>
        <div className="cpu-cores-grid">
          {cpuDetail.cores.map((usage, index) => (
            <div key={index} className="core-chart">
              <div className="core-header">
                <span>核心 {index + 1}</span>
                <span>{Math.round(usage)}%</span>
              </div>
              <div className="echarts-container">
                <ReactECharts
                  option={getCoreChartOption(cpuHistory.coreUsageHistory[index] || [])}
                  style={{ height: '100%', width: '100%' }}
                  notMerge={true}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// 主图表配置
const getMainChartOption = (cpuInfo: CpuDetailInfo): ECOption => ({
  grid: {
    top: 20,
    right: 20,
    bottom: 40,
    left: 50,
    containLabel: true
  },
  tooltip: {
    trigger: 'axis',
    formatter: (params: any) => {
      const data = params[0].data;
      return `${new Date(data[0]).toLocaleTimeString()}<br/>
              使用率: ${Math.round(data[1])}%<br/>
              ${data[2] ? `频率: ${formatFrequency(data[2])}` : ''}`;
    }
  },
  xAxis: {
    type: 'time',
    splitLine: {
      show: false
    },
    axisLabel: {
      formatter: (value: number) => {
        return new Date(value).toLocaleTimeString('zh-CN', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
      },
      fontSize: 12,
      color: '#666',
      margin: 16,
      rotate: 30
    },
    axisLine: {
      lineStyle: {
        color: '#ddd'
      }
    }
  },
  yAxis: {
    type: 'value',
    min: 0,
    max: 100,
    splitLine: {
      lineStyle: {
        type: 'dashed',
        color: '#eee'
      }
    },
    axisLabel: {
      formatter: '{value}%',
      fontSize: 12,
      color: '#666'
    },
    axisLine: {
      lineStyle: {
        color: '#ddd'
      }
    }
  },
  series: [{
    name: 'CPU使用率',
    type: 'line',
    smooth: true,
    showSymbol: false,
    lineStyle: {
      width: 2,
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
    data: cpuInfo.usageHistory.map(item => [
      item.timestamp,
      item.usage,
      item.speed
    ])
  }]
});

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