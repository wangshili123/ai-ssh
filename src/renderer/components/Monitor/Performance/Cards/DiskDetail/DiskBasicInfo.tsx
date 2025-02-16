import React, { useState, useEffect } from 'react';
import { Progress } from 'antd';
import ReactECharts from 'echarts-for-react';
import { DiskDetailInfo } from '../../../../../types/monitor';
import { formatBytes } from '../../../../../utils/format';
import { getProgressColor } from '../../../../../utils/theme';
import type { ECOption } from '../../../../../types/echarts';
import './DiskDetailTab.css';

interface DiskBasicInfoProps {
  diskInfo: DiskDetailInfo;
}

const MAX_HISTORY_POINTS = 60; // 保存60个历史数据点

export const DiskBasicInfo: React.FC<DiskBasicInfoProps> = ({ diskInfo }) => {
  const [ioHistory, setIoHistory] = useState<Array<{
    timestamp: number;
    readSpeed: number;
    writeSpeed: number;
  }>>([]);

  // 更新历史数据
  useEffect(() => {
    if (diskInfo) {
      const now = Date.now();
      setIoHistory(prev => {
        // 如果是第一次加载，创建初始数据点
        if (prev.length === 0) {
          const initialPoints = Array.from({ length: MAX_HISTORY_POINTS }, (_, i) => ({
            timestamp: now - (MAX_HISTORY_POINTS - i - 1) * 1000,
            readSpeed: 0,
            writeSpeed: 0
          }));
          return [...initialPoints, {
            timestamp: now,
            readSpeed: diskInfo.readSpeed || 0,
            writeSpeed: diskInfo.writeSpeed || 0
          }];
        }

        // 添加新数据点
        const newHistory = [
          ...prev,
          {
            timestamp: now,
            readSpeed: diskInfo.readSpeed || 0,
            writeSpeed: diskInfo.writeSpeed || 0
          }
        ].slice(-MAX_HISTORY_POINTS);
        return newHistory;
      });
    }
  }, [diskInfo]);

  // 配置IO趋势图表选项
  const getIOTrendOption = (history: Array<{ timestamp: number; readSpeed: number; writeSpeed: number }>): ECOption => {
    // 确保至少有一个数据点
    if (history.length === 0) {
      const now = Date.now();
      history = Array.from({ length: MAX_HISTORY_POINTS }, (_, i) => ({
        timestamp: now - (MAX_HISTORY_POINTS - i - 1) * 1000,
        readSpeed: 0,
        writeSpeed: 0
      }));
    }

    const latestTime = history[history.length - 1].timestamp;
    const earliestTime = latestTime - (MAX_HISTORY_POINTS - 1) * 1000;
    
    return {
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
          const time = new Date(params[0].data[0]).toLocaleTimeString();
          const readSpeed = formatBytes(params[0].data[1]);
          const writeSpeed = formatBytes(params[1].data[1]);
          return `${time}<br/>读取: ${readSpeed}/s<br/>写入: ${writeSpeed}/s`;
        }
      },
      xAxis: {
        type: 'time',
        min: earliestTime,
        max: latestTime,
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
          formatter: (value: number) => {
            // 确保value是有效数字
            if (typeof value !== 'number' || isNaN(value)) {
              return '0 B/s';
            }
            return formatBytes(value) + '/s';
          },
          fontSize: 10
        },
        min: 0,  // 设置最小值为0
        minInterval: 1024,  // 设置最小间隔为1KB
        splitLine: {
          lineStyle: {
            type: 'dashed'
          }
        }
      },
      series: [
        {
          name: '读取速度',
          type: 'line',
          smooth: true,
          showSymbol: false,
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
          showSymbol: false,
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
      ],
      animation: true
    };
  };

  return (
    <div className="disk-basic-info">
      <div className="info-section">
        <div className="basic-info-row">
          <div className="capacity-container">
            <div className="section-title">系统总容量</div>
            <div className="capacity-info">
              <Progress 
                percent={Math.round(diskInfo.usagePercent)}
                strokeColor={getProgressColor(diskInfo.usagePercent)}
              />
              <div className="capacity-details">
                {formatBytes(diskInfo.used)}/{formatBytes(diskInfo.total)}
              </div>
            </div>
          </div>
          <div className="io-speed-container">
            <div className="section-title">IO速度</div>
            <div className="io-speed-info">
              <div className="speed-item">
                <span className="speed-label">读取：</span>
                <span className="speed-value" style={{ color: '#1890ff' }}>
                  {formatBytes(diskInfo.readSpeed)}/s
                </span>
              </div>
              <div className="speed-item">
                <span className="speed-label">写入：</span>
                <span className="speed-value" style={{ color: '#52c41a' }}>
                  {formatBytes(diskInfo.writeSpeed)}/s
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="info-section">
        <div className="section-title">IO趋势</div>
        <div className="io-trend">
          <ReactECharts
            option={getIOTrendOption(ioHistory)}
            style={{ width: '100%' }}
            notMerge={true}
          />
        </div>
      </div>
    </div>
  );
}; 