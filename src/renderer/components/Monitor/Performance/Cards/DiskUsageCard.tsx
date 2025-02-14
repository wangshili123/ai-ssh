import React, { useEffect, useState } from 'react';
import { Progress } from 'antd';
import ReactECharts from 'echarts-for-react';
import { DiskBasicInfo, DiskDetailInfo, MonitorData } from '../../../../types/monitor';
import type { ECOption } from '../../../../types/echarts';
import { formatBytes } from '../../../../utils/format';
import { DiskDetail } from './DiskDetail/DiskDetailTab';
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
    const diskData = monitorData?.performance?.detail?.disk;
    if (diskData) {
      console.log('收到新的磁盘数据:', {
        readSpeed: diskData.readSpeed,
        writeSpeed: diskData.writeSpeed,
        health: diskData.health ? '有健康数据' : '无健康数据',
        ioAnalysis: diskData.ioAnalysis ? '有IO分析数据' : '无IO分析数据',
        timestamp: new Date().toISOString()
      });

      setIoHistory(prev => {
        const newHistory = [
          ...prev,
          {
            timestamp: Date.now(),
            readSpeed: diskData.readSpeed,
            writeSpeed: diskData.writeSpeed
          }
        ].slice(-MAX_HISTORY_POINTS);
        return newHistory;
      });
    } else {
      console.log('未收到磁盘数据', {
        monitorData: monitorData ? '有监控数据' : '无监控数据',
        timestamp: new Date().toISOString()
      });
    }
  }, [monitorData]);

  const diskBasic = monitorData?.performance?.basic?.disk || {
    total: 0,
    used: 0,
    free: 0,
    usagePercent: 0
  };

  const diskDetail = monitorData?.performance?.detail?.disk || {
    ...diskBasic,
    readSpeed: 0,
    writeSpeed: 0,
    partitions: [],
    ioHistory: [],
    deviceStats: {},
    health: undefined,
    spaceAnalysis: undefined,
    ioAnalysis: undefined
  };

  // 详细视图时打印完整的磁盘信息
  useEffect(() => {
    if (detailed) {
      console.log('详细视图磁盘信息:', {
        total: formatBytes(diskDetail.total),
        used: formatBytes(diskDetail.used),
        partitionsCount: diskDetail.partitions.length,
        hasHealth: !!diskDetail.health,
        healthLastCheck: diskDetail.health?.lastCheck ? new Date(diskDetail.health.lastCheck).toISOString() : '无',
        hasIoAnalysis: !!diskDetail.ioAnalysis,
        ioTimestamp: diskDetail.ioAnalysis?.timestamp ? new Date(diskDetail.ioAnalysis.timestamp).toISOString() : '无',
        timestamp: new Date().toISOString()
      });
    }
  }, [detailed, diskDetail]);

  // 获取进度条颜色
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return '#ff4d4f';
    if (percent >= 70) return '#faad14';
    return '#52c41a';
  };

  // 简单视图用于左侧资源列表
  if (simple) {
    return (
      <div className="resource-summary disk-usage-card">
        <div className="resource-title">磁盘</div>
        <div className="resource-value">
          <span className="usage-value">{Math.round(diskBasic.usagePercent)}%</span>
          <span className="disk-details">
            {formatBytes(diskBasic.used)}/{formatBytes(diskBasic.total)}
          </span>
        </div>
        <Progress 
          percent={Math.round(diskBasic.usagePercent)} 
          showInfo={false} 
          size="small"
          strokeColor={getProgressColor(diskBasic.usagePercent)}
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
              percent={Math.round(diskDetail.usagePercent)}
              strokeColor={getProgressColor(diskDetail.usagePercent)}
            />
            <div className="details">
              {formatBytes(diskDetail.used)}/{formatBytes(diskDetail.total)}
            </div>
          </div>
          <div className="disk-io-trend">
            <div className="title">IO趋势</div>
            <ReactECharts
              option={getIOTrendOption(ioHistory)}
              style={{ height: '100px', minWidth: '300px' }}
              notMerge={true}
            />
          </div>
        </div>

        {/* 详细信息区域 */}
        <DiskDetail diskInfo={diskDetail} />
      </div>
    );
  }

  return null;
};

// IO趋势图配置
const getIOTrendOption = (history: Array<{ timestamp: number; readSpeed: number; writeSpeed: number }>): ECOption => ({
  grid: {
    top: 10,
    right: 10,
    bottom: 20,
    left: 45,
    containLabel: true
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
  xAxis: {
    type: 'time',
    axisLabel: {
      formatter: (value: number) => {
        return new Date(value).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      },
      fontSize: 10
    }
  },
  yAxis: {
    type: 'value',
    name: '速率',
    axisLabel: {
      formatter: (value: number) => formatBytes(value).replace('iB', 'B'),
      fontSize: 10
    }
  },
  series: [
    {
      name: '读取速度',
      type: 'line',
      smooth: true,
      data: history.map(item => [item.timestamp, item.readSpeed]),
      lineStyle: { width: 1 },
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
      data: history.map(item => [item.timestamp, item.writeSpeed]),
      lineStyle: { 
        width: 1,
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