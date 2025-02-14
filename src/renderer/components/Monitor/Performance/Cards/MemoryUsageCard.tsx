import React from 'react';
import { Progress, Table } from 'antd';
import ReactECharts from 'echarts-for-react';
import { MemoryBasicInfo, MemoryDetailInfo, MonitorData } from '../../../../types/monitor';
import type { ECOption } from '../../../../types/echarts';
import { formatBytes } from '../../../../utils/format';
import './MemoryUsageCard.css';

interface MemoryUsageCardProps {
  sessionId: string;
  monitorData?: MonitorData;
  simple?: boolean;
  detailed?: boolean;
}

export const MemoryUsageCard: React.FC<MemoryUsageCardProps> = ({ 
  sessionId, 
  monitorData,
  simple, 
  detailed 
}) => {
  const memoryBasic = monitorData?.performance?.basic?.memory || {
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0
  };

  const memoryDetail = monitorData?.performance?.detail?.memory || {
    ...memoryBasic,
    cached: 0,
    buffers: 0,
    swap: {
      total: 0,
      used: 0,
      free: 0,
      usagePercent: 0
    },
    topProcesses: []
  };

  // 获取警告级别
  const getWarningLevel = (usagePercent: number) => {
    if (usagePercent >= 90) return 'critical';
    if (usagePercent >= 80) return 'warning';
    return '';
  };

  // 生成内存使用环形图配置
  const getMemoryChartOption = (): ECOption => {
    const usagePercent = memoryDetail.usagePercent;
    const getProgressColor = (percent: number) => {
      if (percent >= 80) return '#ff4d4f';
      if (percent >= 30) return '#faad14';
      return '#52c41a';
    };

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          if (params.seriesName === 'usage') {
            return `内存使用率: ${Math.round(usagePercent)}%`;
          }
          return '';
        }
      },
      series: [
        {
          name: 'track',
          type: 'pie',
          radius: ['55%', '70%'],
          center: ['50%', '50%'],
          silent: true,
          label: {
            show: false
          },
          data: [
            {
              value: 100,
              itemStyle: {
                color: '#f0f0f0'
              }
            }
          ]
        },
        {
          name: 'usage',
          type: 'pie',
          radius: ['55%', '70%'],
          center: ['50%', '50%'],
          startAngle: 90,
          label: {
            show: true,
            position: 'center',
            formatter: () => {
              return [
                `{value|${Math.round(usagePercent)}%}`,
                '{label|内存使用率}'
              ].join('\n');
            },
            rich: {
              value: {
                fontSize: 24,
                fontWeight: 500,
                color: getProgressColor(usagePercent),
                padding: [0, 0, 5, 0]
              },
              label: {
                fontSize: 12,
                color: '#666'
              }
            }
          },
          data: [
            {
              value: usagePercent,
              itemStyle: {
                color: getProgressColor(usagePercent)
              }
            },
            {
              value: 100 - usagePercent,
              itemStyle: {
                color: 'transparent'
              }
            }
          ]
        }
      ]
    };
  };

  // 进程列表列定义
  const columns = [
    {
      title: '进程名',
      dataIndex: 'name',
      key: 'name',
      width: '15%'
    },
    {
      title: 'PID',
      dataIndex: 'pid',
      key: 'pid',
      width: '10%'
    },
    {
      title: '命令行',
      dataIndex: 'command',
      key: 'command',
      width: '40%',
      ellipsis: true,  // 文本过长时显示省略号
    },
    {
      title: '内存占用',
      dataIndex: 'memoryUsed',
      key: 'memoryUsed',
      width: '20%',
      render: (value: number) => formatBytes(value)
    },
    {
      title: '占比',
      dataIndex: 'memoryPercent',
      key: 'memoryPercent',
      width: '15%',
      render: (value: number) => `${value.toFixed(1)}%`
    }
  ];

  // 简单视图用于左侧资源列表
  if (simple) {
    const warningLevel = getWarningLevel(memoryBasic.usagePercent);
    return (
      <div className={`resource-summary memory-usage-card ${warningLevel}`}>
        <div className="resource-title">内存</div>
        <div className="resource-value">
          <span className="usage-value">{Math.round(memoryBasic.usagePercent)}%</span>
          <span className="memory-details">
            {formatBytes(memoryBasic.used)}/{formatBytes(memoryBasic.total)}
          </span>
        </div>
        <Progress 
          percent={Math.round(memoryBasic.usagePercent)} 
          showInfo={false} 
          size="small"
          status={warningLevel === 'critical' ? 'exception' : 'normal'}
          strokeColor={warningLevel === 'warning' ? '#faad14' : undefined}
        />
      </div>
    );
  }

  // 详细视图
  if (detailed) {
    return (
      <div className="memory-details-view">
        {/* 内存使用概览 */}
        <div className="memory-overview">
          <div className="memory-chart">
            <ReactECharts 
              option={getMemoryChartOption()} 
              style={{ height: '100%', minHeight: '160px' }}
              notMerge={true}
            />
          </div>
          <div className="memory-info">
            <div className="info-item">
              <span className="info-label">总内存：</span>
              <span className="info-value">{formatBytes(memoryDetail.total)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">已用内存：</span>
              <span className="info-value">{formatBytes(memoryDetail.used)} ({Math.round(memoryDetail.usagePercent)}%)</span>
            </div>
            <div className="info-item">
              <span className="info-label">可用内存：</span>
              <span className="info-value">{formatBytes(memoryDetail.free)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">缓存：</span>
              <span className="info-value">{formatBytes(memoryDetail.cached)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">缓冲区：</span>
              <span className="info-value">{formatBytes(memoryDetail.buffers)}</span>
            </div>
            {memoryDetail.swap.total > 0 && (
              <>
                <div className="info-item section-divider">
                  <span className="info-label">交换空间：</span>
                  <span className="info-value">{formatBytes(memoryDetail.swap.total)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">已用交换：</span>
                  <span className="info-value">
                    {formatBytes(memoryDetail.swap.used)} ({Math.round(memoryDetail.swap.usagePercent)}%)
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">可用交换：</span>
                  <span className="info-value">{formatBytes(memoryDetail.swap.free)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 进程列表 */}
        <div className="memory-processes">
          <h3>内存占用TOP10进程</h3>
          <Table 
            dataSource={memoryDetail.topProcesses.map(p => ({ ...p, key: p.pid }))}
            columns={columns}
            pagination={false}
            size="small"
          />
        </div>
      </div>
    );
  }

  return null;
}; 