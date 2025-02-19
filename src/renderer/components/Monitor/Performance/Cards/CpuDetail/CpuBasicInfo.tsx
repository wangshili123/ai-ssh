import React from 'react';
import { Tooltip } from 'antd';
import ReactECharts from 'echarts-for-react';

import { ExclamationCircleOutlined } from '@ant-design/icons';
import { CpuDetailInfo } from '../../../../../types/monitor/monitor';
import { formatFrequency } from '../../../../../utils/format';
import './CpuDetailTab.css';
import { ECOption } from '@/types/echarts';

interface CpuBasicInfoProps {
  cpuInfo: CpuDetailInfo;
}

export const CpuBasicInfo: React.FC<CpuBasicInfoProps> = ({ cpuInfo }) => {
  return (
    <div className="cpu-basic-info">
      {/* CPU信息面板 */}
      <div className="cpu-info-panel">
        <div className="info-row">
          <span className="info-item">
            <span className="info-label">处理器型号:</span>
            <span className="info-value">{cpuInfo.model}</span>
          </span>
          <span className="info-item">
            <span className="info-label">制造商:</span>
            <span className="info-value">{cpuInfo.vendor || '未知'}</span>
          </span>
        </div>
        <div className="info-row">
          <span className="info-item">
            <span className="info-label">最大频率:</span>
            <span className="info-value">{formatFrequency(cpuInfo.maxSpeed || 0)}</span>
          </span>
          <span className="info-item">
            <span className="info-label">最小频率:</span>
            <span className="info-value">{formatFrequency(cpuInfo.minSpeed || 0)}</span>
          </span>
          <span className="info-item">
            <span className="info-label">当前频率:</span>
            <span className="info-value">{formatFrequency(cpuInfo.currentSpeed || cpuInfo.speed)}</span>
          </span>
        </div>
        <div className="info-row">
          <span className="info-item">
            <span className="info-label">物理核心:</span>
            <span className="info-value">{cpuInfo.physicalCores}</span>
          </span>
          <span className="info-item">
            <span className="info-label">逻辑处理器:</span>
            <span className="info-value">{cpuInfo.logicalCores}</span>
          </span>
          <span className="info-item">
            <span className="info-label">温度:</span>
            <span className="info-value">
              {cpuInfo.temperature === 'not_installed' ? (
                <Tooltip title={
                  '未安装 lm-sensors，请使用以下命令安装：\n' +
                  'Ubuntu/Debian: sudo apt-get install lm-sensors\n' +
                  'CentOS/RHEL: sudo yum install lm_sensors\n' +
                  '安装后需要运行: sudo sensors-detect'
                }>
                  <ExclamationCircleOutlined style={{ color: '#faad14' }} />
                </Tooltip>
              ) : (
                `${cpuInfo.temperature === undefined ? '' : cpuInfo.temperature}°C`
              )}
            </span>
          </span>
        </div>
        <div className="info-row">
          {cpuInfo.cache.l1 && (
            <span className="info-item">
              <span className="info-label">L1缓存:</span>
              <span className="info-value">{cpuInfo.cache.l1} KB</span>
            </span>
          )}
          {cpuInfo.cache.l2 && (
            <span className="info-item">
              <span className="info-label">L2缓存:</span>
              <span className="info-value">{cpuInfo.cache.l2} KB</span>
            </span>
          )}
          {cpuInfo.cache.l3 && (
            <span className="info-item">
              <span className="info-label">L3缓存:</span>
              <span className="info-value">{cpuInfo.cache.l3} KB</span>
            </span>
          )}
        </div>
      </div>

      {/* CPU使用率主图表 */}
      <div className="cpu-main-chart">
        <div className="chart-header">
          <div className="chart-title">CPU 利用率</div>
          <div className="chart-value">{Math.round(cpuInfo.usage)}%</div>
        </div>
        <div className="echarts-container">
          <ReactECharts
            option={getMainChartOption(cpuInfo)}
            style={{ height: '100%', width: '100%' }}
            notMerge={true}
          />
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

