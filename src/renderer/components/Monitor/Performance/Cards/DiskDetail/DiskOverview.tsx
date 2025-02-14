import React from 'react';
import { Progress } from 'antd';
import { DiskDetailInfo } from '../../../../../types/monitor';
import { formatBytes } from '../../../../../utils/format';

interface DiskOverviewProps {
  diskInfo: DiskDetailInfo;
}

export const DiskOverview: React.FC<DiskOverviewProps> = ({ diskInfo }) => {
  // 获取进度条颜色
  const getProgressColor = (percent: number) => {
    if (percent >= 90) return '#ff4d4f';
    if (percent >= 70) return '#faad14';
    return '#52c41a';
  };

  return (
    <div className="disk-content">
      {/* 分区列表 */}
      <div className="partitions-list">
        {diskInfo.partitions.map((partition, index) => (
          <div key={index} className={`partition-item ${partition.diskType === '虚拟分区' ? 'virtual' : ''}`}>
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
                {partition.diskType !== '虚拟分区' ? 
                  `↑ ${formatBytes(partition.readSpeed)}/s ↓ ${formatBytes(partition.writeSpeed)}/s` :
                  '虚拟文件系统'
                }
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
  );
}; 