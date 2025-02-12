import React, { useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { getServiceManager } from '../../../../services/monitor/serviceManager';
import { CpuInfo } from '../../../../types/monitor';
import type { ECOption } from '../../../../types/echarts';
import { formatFrequency } from '../../../../utils/format';
import './CpuUsageCard.css';

interface CpuUsageCardProps {
  sessionId: string;
  simple?: boolean;
  detailed?: boolean;
}

const MAX_HISTORY_POINTS = 60; // 保存60个历史数据点

export const CpuUsageCard: React.FC<CpuUsageCardProps> = ({ sessionId, simple, detailed }) => {
  const [cpuInfo, setCpuInfo] = useState<CpuInfo>({
    usage: 0,
    cores: [],
    model: '',
    speed: 0,
    physicalCores: 0,
    logicalCores: 0,
    cache: {},
    usageHistory: [],
    coreUsageHistory: []
  });

  useEffect(() => {
    const monitorManager = getServiceManager().getMonitorManager();
    const session = monitorManager.getSession(sessionId);
    if (!session) return;

    // 初始化数据
    const initialData = session.monitorData?.cpu;
    if (initialData) {
      setCpuInfo(prev => {
        const newInfo = { ...initialData };
        const now = Date.now();

        // 更新总体使用率历史
        newInfo.usageHistory = [
          ...prev.usageHistory,
          { timestamp: now, usage: newInfo.usage, speed: newInfo.currentSpeed }
        ].slice(-MAX_HISTORY_POINTS);

        // 更新每个核心的使用率历史
        newInfo.coreUsageHistory = newInfo.cores.map((usage, index) => {
          const coreHistory = prev.coreUsageHistory[index] || [];
          return [
            ...coreHistory,
            { timestamp: now, usage, speed: newInfo.currentSpeed }
          ].slice(-MAX_HISTORY_POINTS);
        });

        return newInfo;
      });
    }

    // 定时更新数据
    const updateInterval = setInterval(() => {
      const currentSession = monitorManager.getSession(sessionId);
      const currentData = currentSession?.monitorData?.cpu;
      
      if (currentData) {
        setCpuInfo(prev => {
          const newInfo = { ...currentData };
          const now = Date.now();

          // 更新总体使用率历史
          newInfo.usageHistory = [
            ...prev.usageHistory,
            { timestamp: now, usage: newInfo.usage, speed: newInfo.currentSpeed }
          ].slice(-MAX_HISTORY_POINTS);

          // 更新每个核心的使用率历史
          newInfo.coreUsageHistory = newInfo.cores.map((usage, index) => {
            const coreHistory = prev.coreUsageHistory[index] || [];
            return [
              ...coreHistory,
              { timestamp: now, usage, speed: newInfo.currentSpeed }
            ].slice(-MAX_HISTORY_POINTS);
          });

          return newInfo;
        });
      }
    }, session.config?.refreshInterval || 1000);

    return () => clearInterval(updateInterval);
  }, [sessionId]);

  // 简单视图用于左侧资源列表
  if (simple) {
    return (
      <div className="resource-summary">
        <div className="resource-title">CPU</div>
        <div className="resource-value">{Math.round(cpuInfo.usage)}%</div>
        <div className="resource-speed">{formatFrequency(cpuInfo.currentSpeed || cpuInfo.speed)}</div>
      </div>
    );
  }

  // 详细视图
  return (
    <div className="cpu-performance-container">
      {/* 左侧主要区域 */}
      <div className="cpu-main-section">
        {/* CPU使用率主图表 */}
        <div className="cpu-main-chart">
          <div className="chart-header">
            <div className="chart-title">CPU 利用率</div>
            <div className="chart-value">{Math.round(cpuInfo.usage)}%</div>
          </div>
          <ReactECharts
            option={getMainChartOption(cpuInfo)}
            style={{ height: '300px' }}
            notMerge={true}
          />
        </div>

        {/* CPU核心网格图表 */}
        <div className="cpu-cores-grid">
          {cpuInfo.cores.map((usage, index) => (
            <div key={index} className="core-chart">
              <div className="core-header">
                <span>核心 {index + 1}</span>
                <span>{Math.round(usage)}%</span>
              </div>
              <ReactECharts
                option={getCoreChartOption(cpuInfo.coreUsageHistory[index] || [])}
                style={{ height: '100px' }}
                notMerge={true}
              />
            </div>
          ))}
        </div>
      </div>

      {/* 右侧信息面板 */}
      <div className="cpu-info-panel">
        <div className="info-section">
          <div className="info-item">
            <span className="info-label">型号</span>
            <span className="info-value">{cpuInfo.model}</span>
          </div>
          <div className="info-item">
            <span className="info-label">制造商</span>
            <span className="info-value">{cpuInfo.vendor || '未知'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">基本速度</span>
            <span className="info-value">{formatFrequency(cpuInfo.speed)}</span>
          </div>
          {cpuInfo.currentSpeed && (
            <div className="info-item">
              <span className="info-label">当前速度</span>
              <span className="info-value">{formatFrequency(cpuInfo.currentSpeed)}</span>
            </div>
          )}
          <div className="info-item">
            <span className="info-label">物理核心数</span>
            <span className="info-value">{cpuInfo.physicalCores}</span>
          </div>
          <div className="info-item">
            <span className="info-label">逻辑处理器</span>
            <span className="info-value">{cpuInfo.logicalCores}</span>
          </div>
          {cpuInfo.temperature !== undefined && (
            <div className="info-item">
              <span className="info-label">温度</span>
              <span className="info-value">{cpuInfo.temperature}°C</span>
            </div>
          )}
          {cpuInfo.cache.l1 && (
            <div className="info-item">
              <span className="info-label">L1 缓存</span>
              <span className="info-value">{cpuInfo.cache.l1} KB</span>
            </div>
          )}
          {cpuInfo.cache.l2 && (
            <div className="info-item">
              <span className="info-label">L2 缓存</span>
              <span className="info-value">{cpuInfo.cache.l2} KB</span>
            </div>
          )}
          {cpuInfo.cache.l3 && (
            <div className="info-item">
              <span className="info-label">L3 缓存</span>
              <span className="info-value">{cpuInfo.cache.l3} KB</span>
            </div>
          )}
          {cpuInfo.virtualization !== undefined && (
            <div className="info-item">
              <span className="info-label">虚拟化</span>
              <span className="info-value">{cpuInfo.virtualization ? '已启用' : '未启用'}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 主图表配置
const getMainChartOption = (cpuInfo: CpuInfo): ECOption => ({
  grid: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 40,
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
        color: '#E5E5E5'
      }
    }
  },
  series: [
    {
      name: 'CPU使用率',
      type: 'line',
      smooth: true,
      areaStyle: {
        opacity: 0.3,
        color: '#1890ff'
      },
      lineStyle: {
        color: '#1890ff',
        width: 2
      },
      data: cpuInfo.usageHistory.map(item => [
        item.timestamp,
        item.usage,
        item.speed
      ])
    }
  ]
});

// 核心图表配置
const getCoreChartOption = (history: Array<{ timestamp: number; usage: number; speed?: number }>): ECOption => ({
  grid: {
    top: 5,
    right: 5,
    bottom: 5,
    left: 5
  },
  tooltip: {
    trigger: 'axis',
    formatter: (params: any) => {
      const data = params[0].data;
      return `${new Date(data[0]).toLocaleTimeString()}<br/>
              使用率: ${Math.round(data[1])}%`;
    }
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
  series: [
    {
      type: 'line',
      smooth: true,
      areaStyle: {
        opacity: 0.3,
        color: '#1890ff'
      },
      lineStyle: {
        color: '#1890ff',
        width: 1.5
      },
      data: history.map(item => [
        item.timestamp,
        item.usage
      ])
    }
  ]
}); 