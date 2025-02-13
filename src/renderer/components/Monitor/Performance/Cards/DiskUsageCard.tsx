import React, { useEffect, useState } from 'react';
import { Progress } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { MonitorData } from '../../../../types/monitor';
import type { ECOption } from '../../../../types/echarts';
import { formatBytes } from '../../../../utils/format';
import './DiskUsageCard.css';

interface DiskUsageCardProps {
  sessionId: string;
  monitorData?: MonitorData;
  simple?: boolean;
  detailed?: boolean;
}

const MAX_HISTORY_POINTS = 60; // 保存60个历史数据点

export const DiskUsageCard: React.FC<DiskUsageCardProps> = ({ 
  sessionId, 
  monitorData,
  simple, 
  detailed 
}) => {
  const [ioHistory, setIoHistory] = useState<Array<{
    timestamp: number;
    readSpeed: number;
    writeSpeed: number;
  }>>([]);

  // 更新历史数据
  useEffect(() => {
    if (monitorData?.disk) {
      setIoHistory(prev => {
        const newHistory = [
          ...prev,
          {
            timestamp: Date.now(),
            readSpeed: monitorData.disk.readSpeed,
            writeSpeed: monitorData.disk.writeSpeed
          }
        ].slice(-MAX_HISTORY_POINTS);
        return newHistory;
      });
    }
  }, [monitorData]);

  const diskInfo = monitorData?.disk || {
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0,
    readSpeed: 0,
    writeSpeed: 0,
    partitions: [],
    ioHistory: []
  };

  // 获取进度条颜色
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return '#ff4d4f';
    if (percent >= 70) return '#faad14';
    return '#52c41a';
  };

  // 生成IO趋势图配置
  const getIOTrendOption = (): ECOption => ({
    grid: {
      top: 40,
      right: 20,
      bottom: 40,
      left: 50
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const readSpeed = params[0].data[1];
        const writeSpeed = params[1].data[1];
        return `${new Date(params[0].data[0]).toLocaleTimeString()}<br/>
                读取: ${formatBytes(readSpeed)}/s<br/>
                写入: ${formatBytes(writeSpeed)}/s`;
      }
    },
    legend: {
      data: ['读取速度', '写入速度'],
      top: 0
    },
    xAxis: {
      type: 'time',
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
      name: '速率',
      axisLabel: {
        formatter: (value: number) => formatBytes(value).replace('iB', 'B')
      }
    },
    series: [
      {
        name: '读取速度',
        type: 'line',
        smooth: true,
        data: ioHistory.map(item => [item.timestamp, item.readSpeed]),
        lineStyle: { width: 2 },
        itemStyle: { color: '#1890ff' },
        emphasis: {
          focus: 'series'
        },
        areaStyle: {
          opacity: 0.1
        }
      },
      {
        name: '写入速度',
        type: 'line',
        smooth: true,
        data: ioHistory.map(item => [item.timestamp, item.writeSpeed]),
        lineStyle: { 
          width: 2,
          type: 'dashed'
        },
        itemStyle: { color: '#52c41a' },
        emphasis: {
          focus: 'series'
        },
        areaStyle: {
          opacity: 0.1
        }
      }
    ]
  });

  // 简单视图用于左侧资源列表
  if (simple) {
    return (
      <div className="resource-summary disk-usage-card">
        <div className="resource-title">磁盘</div>
        <div className="resource-value">
          <span className="usage-value">{Math.round(diskInfo.usagePercent)}%</span>
          <span className="disk-details">
            {formatBytes(diskInfo.used)}/{formatBytes(diskInfo.total)}
          </span>
        </div>
        <Progress 
          percent={Math.round(diskInfo.usagePercent)} 
          showInfo={false} 
          size="small"
          strokeColor={getProgressColor(diskInfo.usagePercent)}
        />
      </div>
    );
  }

  // 详细视图
  if (detailed) {
    return (
      <div className="disk-details-view">
        {/* 顶部概览 */}
        <div className="disk-overview">
          <div className="disk-usage">
            <div className="title">系统总容量</div>
            <Progress 
              percent={Math.round(diskInfo.usagePercent)}
              strokeColor={getProgressColor(diskInfo.usagePercent)}
            />
            <div className="details">
              {formatBytes(diskInfo.used)}/{formatBytes(diskInfo.total)}
            </div>
          </div>
          <div className="disk-io">
            <div className="title">磁盘 I/O</div>
            <div className="io-stats">
              <div className="read">↑ {formatBytes(diskInfo.readSpeed)}/s</div>
              <div className="write">↓ {formatBytes(diskInfo.writeSpeed)}/s</div>
            </div>
          </div>
        </div>

        {/* 内容区域：IO趋势图和分区列表并排 */}
        <div className="disk-content">
          {/* IO趋势图 */}
          <div className="io-trend">
            <ReactECharts 
              option={getIOTrendOption()} 
              style={{ height: '100%', minHeight: '300px' }}
              notMerge={true}
            />
          </div>

          {/* 分区列表 */}
          <div className="partitions-list">
            {diskInfo.partitions.map((partition, index) => (
              <div key={index} className="partition-item">
                <div className="partition-header">
                  <div className="partition-info">
                    <span className="mountpoint">
                      {partition.mountpoint.length > 30 ? 
                        `${partition.mountpoint.slice(0, 30)}...` : 
                        partition.mountpoint
                      }
                    </span>
                    <span className="fstype">{partition.fstype}</span>
                    <span className="disk-type">{partition.diskType}</span>
                  </div>
                  <span className="io-speed">
                    ↑ {formatBytes(partition.readSpeed)}/s ↓ {formatBytes(partition.writeSpeed)}/s
                  </span>
                </div>
                <div className="usage-row">
                  <div className="usage-details">
                    <span>{formatBytes(partition.used)}/{formatBytes(partition.total)}</span>
                    <span>{Math.round(partition.usagePercent)}%</span>
                  </div>
                  <div className="usage-progress">
                    <Progress 
                      percent={Math.round(partition.usagePercent)}
                      strokeColor={getProgressColor(partition.usagePercent)}
                      showInfo={false}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}; 