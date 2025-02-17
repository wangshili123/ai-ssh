import React, { useEffect, useRef } from 'react';
import { Card } from 'antd';
import * as echarts from 'echarts';
import { NetworkDetailInfo } from '../../../../../types/monitor';
import { formatBytes } from '../../../../../utils/format';

interface NetworkBasicInfoProps {
  networkInfo: NetworkDetailInfo;
}

export const NetworkBasicInfo: React.FC<NetworkBasicInfoProps> = ({ networkInfo }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts>();

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const option = {
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
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: {
        type: 'time',
        boundaryGap: false
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => formatBytes(value) + '/s'
        }
      },
      series: [
        {
          name: '下载速度',
          type: 'line',
          smooth: true,
          symbol: 'none',
          areaStyle: {
            opacity: 0.1
          },
          data: networkInfo.history.map(item => [item.timestamp, item.rxSpeed])
        },
        {
          name: '上传速度',
          type: 'line',
          smooth: true,
          symbol: 'none',
          areaStyle: {
            opacity: 0.1
          },
          data: networkInfo.history.map(item => [item.timestamp, item.txSpeed])
        }
      ]
    };

    chartInstance.current.setOption(option);

    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = undefined;
    };
  }, [networkInfo.history]);

  useEffect(() => {
    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="network-basic-info">
      <div className="interface-list">
        {networkInfo.interfaces.map((iface) => (
          <div key={iface.name} className="interface-card">
            <div className="interface-header">
              <span className="interface-name">{iface.name}</span>
              <span className={`interface-status ${iface.status.toLowerCase()}`}>
                {iface.status === 'UP' ? '已连接' : '已断开'}
              </span>
            </div>
            <div className="interface-info">
              <div className="info-item">
                <span className="info-label">IPv4 地址</span>
                <span className="info-value">{iface.ipv4.join(', ') || '无'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">IPv6 地址</span>
                <span className="info-value">{iface.ipv6.join(', ') || '无'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">MAC 地址</span>
                <span className="info-value">{iface.mac || '无'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">MTU</span>
                <span className="info-value">{iface.mtu}</span>
              </div>
              <div className="info-item">
                <span className="info-label">下载速度</span>
                <span className="info-value">{formatBytes(iface.rxSpeed)}/s</span>
              </div>
              <div className="info-item">
                <span className="info-label">上传速度</span>
                <span className="info-value">{formatBytes(iface.txSpeed)}/s</span>
              </div>
              <div className="info-item">
                <span className="info-label">总接收</span>
                <span className="info-value">{formatBytes(iface.rx)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">总发送</span>
                <span className="info-value">{formatBytes(iface.tx)}</span>
              </div>
              <div className="info-item">
                <span className="info-label">接收错误</span>
                <span className="info-value">{iface.errors.rx}</span>
              </div>
              <div className="info-item">
                <span className="info-label">发送错误</span>
                <span className="info-value">{iface.errors.tx}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Card title="带宽监控" className="bandwidth-chart">
        <div ref={chartRef} style={{ width: '100%', height: '100%' }} />
      </Card>
    </div>
  );
}; 