import React from 'react';
import ReactECharts from 'echarts-for-react';
import { NetworkDetailInfo } from '../../../../../types/monitor';
import { formatBytes } from '../../../../../utils/format';
import './NetworkDetailTab.css';

interface NetworkBasicInfoProps {
  networkInfo: NetworkDetailInfo;
}

// 获取迷你图表配置
const getMiniChartOption = (data: { timestamp: number; rxSpeed: number; txSpeed: number }[]) => {
  return {
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
      show: false
    },
    series: [
      {
        type: 'line',
        data: data.map(item => [item.timestamp, item.rxSpeed]),
        symbol: 'none',
        lineStyle: { width: 1, color: '#52c41a' },
        areaStyle: { color: '#f6ffed', opacity: 0.3 }
      },
      {
        type: 'line',
        data: data.map(item => [item.timestamp, item.txSpeed]),
        symbol: 'none',
        lineStyle: { width: 1, color: '#1890ff' },
        areaStyle: { color: '#e6f7ff', opacity: 0.3 }
      }
    ]
  };
};

// 获取带宽趋势图配置
const getBandwidthTrendOption = (data: { timestamp: number; rxSpeed: number; txSpeed: number }[]) => {
  return {
    grid: {
      top: 60,
      right: 20,
      bottom: 40,
      left: 50
    },
    title: {
      text: '实时带宽监控',
      left: 'center'
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const time = new Date(params[0].value[0]).toLocaleTimeString();
        return `${time}<br/>
          ${params[0].marker} 下载: ${formatBytes(params[0].value[1])}/s<br/>
          ${params[1].marker} 上传: ${formatBytes(params[1].value[1])}/s`;
      }
    },
    legend: {
      data: ['下载速度', '上传速度'],
      top: 30,
      right: 20
    },
    xAxis: {
      type: 'time',
      splitLine: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      splitLine: {
        lineStyle: {
          type: 'dashed'
        }
      },
      axisLabel: {
        formatter: (value: number) => formatBytes(value) + '/s'
      }
    },
    series: [
      {
        name: '下载速度',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 2,
          color: '#52c41a'
        },
        areaStyle: {
          color: '#f6ffed',
          opacity: 0.3
        },
        data: data.map(item => [item.timestamp, item.rxSpeed])
      },
      {
        name: '上传速度',
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 2,
          color: '#1890ff'
        },
        areaStyle: {
          color: '#e6f7ff',
          opacity: 0.3
        },
        data: data.map(item => [item.timestamp, item.txSpeed])
      }
    ]
  };
};

export const NetworkBasicInfo: React.FC<NetworkBasicInfoProps> = ({ networkInfo }) => {
  return (
    <div className="network-basic-info">
      <div className="basic-info-row">
        {/* 网络接口信息 */}
        <div className="interfaces-container">
          <div className="section-title">网络接口信息</div>
          <div className="interface-info">
            {networkInfo.interfaces.map((iface) => (
              <div key={iface.name} className="interface-item">
                <div className="interface-header">
                  <span className="interface-name">{iface.name}</span>
                  <span className={`interface-status ${iface.status.toLowerCase()}`}>
                    {iface.status === 'UP' ? '已连接' : '已断开'}
                  </span>
                </div>
                <div className="interface-details">
                  <div className="detail-row">
                    <span className="detail-label">IP:</span>
                    <span className="detail-value">{iface.ipv4.join(', ') || '无'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">MAC:</span>
                    <span className="detail-value">{iface.mac || '无'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">速度:</span>
                    <span className="detail-value">
                      ↑ {formatBytes(iface.txSpeed)}/s   
                      ↓ {formatBytes(iface.rxSpeed)}/s
                    </span>
                  </div>
                </div>
                <div className="interface-chart">
                  <ReactECharts 
                    option={getMiniChartOption(networkInfo.history)}
                    style={{ height: '40px', width: '100%' }}
                    notMerge={true}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 网络统计 */}
        <div className="stats-container">
          <div className="section-title">网络统计</div>
          <div className="stats-info">
            <div className="stat-item">
              <span className="stat-label">总计接收</span>
              <span className="stat-value">{formatBytes(networkInfo.totalRx)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">总计发送</span>
              <span className="stat-value">{formatBytes(networkInfo.totalTx)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 带宽趋势 */}
      <div className="info-section">
        <div className="section-title">带宽趋势</div>
        <div className="bandwidth-trend">
          <ReactECharts 
            option={getBandwidthTrendOption(networkInfo.history)}
            style={{ height: '100%' }}
            notMerge={true}
          />
        </div>
      </div>
    </div>
  );
}; 