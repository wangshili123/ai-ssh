import React from 'react';
import { Progress, Table } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { MonitorData } from '../../../../types/monitor';
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
  const memoryInfo = monitorData?.memory || {
    total: 0,
    used: 0,
    free: 0,
    cached: 0,
    buffers: 0,
    usagePercent: 0,
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
  const getMemoryChartOption = (): ECOption => ({
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => {
        const value = params.value as number;
        const name = params.name as string;
        return `${name}: ${formatBytes(value)} (${params.percent}%)`;
      }
    },
    legend: {
      orient: 'vertical',
      right: 0,
      top: 'center',
      itemWidth: 12,
      itemHeight: 12,
      icon: 'circle',
      formatter: (name: string) => {
        const value = {
          '已用内存': memoryInfo.used - memoryInfo.cached - memoryInfo.buffers,
          '缓存': memoryInfo.cached,
          '缓冲区': memoryInfo.buffers,
          '可用内存': memoryInfo.free
        }[name];
        return `${name}: ${formatBytes(value || 0)}`;
      }
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: false
        },
        data: [
          {
            name: '已用内存',
            value: memoryInfo.used - memoryInfo.cached - memoryInfo.buffers,
            itemStyle: { color: '#1890ff' }
          },
          {
            name: '缓存',
            value: memoryInfo.cached,
            itemStyle: { color: '#52c41a' }
          },
          {
            name: '缓冲区',
            value: memoryInfo.buffers,
            itemStyle: { color: '#722ed1' }
          },
          {
            name: '可用内存',
            value: memoryInfo.free,
            itemStyle: { color: '#f0f0f0' }
          }
        ]
      }
    ]
  });

  // 进程列表列定义
  const columns = [
    {
      title: '进程名',
      dataIndex: 'name',
      key: 'name',
      width: '30%'
    },
    {
      title: 'PID',
      dataIndex: 'pid',
      key: 'pid',
      width: '20%'
    },
    {
      title: '内存占用',
      dataIndex: 'memoryUsed',
      key: 'memoryUsed',
      width: '25%',
      render: (value: number) => formatBytes(value)
    },
    {
      title: '占比',
      dataIndex: 'memoryPercent',
      key: 'memoryPercent',
      width: '25%',
      render: (value: number) => `${value.toFixed(1)}%`
    }
  ];

  // 简单视图用于左侧资源列表
  if (simple) {
    const warningLevel = getWarningLevel(memoryInfo.usagePercent);
    return (
      <div className={`resource-summary memory-usage-card ${warningLevel}`}>
        <div className="resource-title">内存</div>
        <div className="resource-value">
          <span className="usage-value">{Math.round(memoryInfo.usagePercent)}%</span>
          <span className="memory-details">
            {formatBytes(memoryInfo.used)}/{formatBytes(memoryInfo.total)}
          </span>
        </div>
        <Progress 
          percent={Math.round(memoryInfo.usagePercent)} 
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
              style={{ height: '100%', minHeight: '200px' }}
              notMerge={true}
            />
          </div>
          <div className="memory-info">
            <div className="info-item">
              <span className="info-label">总内存：</span>
              <span className="info-value">{formatBytes(memoryInfo.total)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">已用内存：</span>
              <span className="info-value">{formatBytes(memoryInfo.used)} ({Math.round(memoryInfo.usagePercent)}%)</span>
            </div>
            <div className="info-item">
              <span className="info-label">可用内存：</span>
              <span className="info-value">{formatBytes(memoryInfo.free)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">缓存：</span>
              <span className="info-value">{formatBytes(memoryInfo.cached)}</span>
            </div>
            <div className="info-item">
              <span className="info-label">缓冲区：</span>
              <span className="info-value">{formatBytes(memoryInfo.buffers)}</span>
            </div>
            {memoryInfo.swap.total > 0 && (
              <>
                <div className="info-item section-divider">
                  <span className="info-label">交换空间：</span>
                  <span className="info-value">{formatBytes(memoryInfo.swap.total)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">已用交换：</span>
                  <span className="info-value">
                    {formatBytes(memoryInfo.swap.used)} ({Math.round(memoryInfo.swap.usagePercent)}%)
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">可用交换：</span>
                  <span className="info-value">{formatBytes(memoryInfo.swap.free)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 进程列表 */}
        <div className="memory-processes">
          <h3>内存占用TOP进程</h3>
          <Table 
            dataSource={memoryInfo.topProcesses.map(p => ({ ...p, key: p.pid }))}
            columns={columns}
            size="small"
            pagination={false}
            scroll={{ y: 300 }}
          />
        </div>
      </div>
    );
  }

  return null;
}; 