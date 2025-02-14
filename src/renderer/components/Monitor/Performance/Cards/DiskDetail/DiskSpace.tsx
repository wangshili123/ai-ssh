import React from 'react';
import { Table, Card, Tooltip } from 'antd';
import { DiskSpaceAnalysis } from '../../../../../types/monitor';
import { formatBytes } from '../../../../../utils/format';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DiskSpaceProps {
  spaceAnalysis?: DiskSpaceAnalysis;
}

export const DiskSpace: React.FC<DiskSpaceProps> = ({ spaceAnalysis }) => {
  if (!spaceAnalysis) {
    return <div>暂无空间分析数据</div>;
  }

  const directoryColumns = [
    {
      title: '目录',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (path: string) => (
        <Tooltip title={path}>
          <span>{path}</span>
        </Tooltip>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) => formatBytes(size),
    },
    {
      title: '最后修改',
      dataIndex: 'lastModified',
      key: 'lastModified',
      width: 150,
      render: (time?: number) => time ? 
        formatDistanceToNow(time, { addSuffix: true, locale: zhCN }) : 
        '未知',
    },
  ];

  const fileColumns = [
    {
      title: '文件',
      dataIndex: 'path',
      key: 'path',
      ellipsis: true,
      render: (path: string) => (
        <Tooltip title={path}>
          <span>{path}</span>
        </Tooltip>
      ),
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) => formatBytes(size),
    },
    {
      title: '最后修改',
      dataIndex: 'lastModified',
      key: 'lastModified',
      width: 150,
      render: (time?: number) => time ? 
        formatDistanceToNow(time, { addSuffix: true, locale: zhCN }) : 
        '未知',
    },
  ];

  const typeColumns = [
    {
      title: '类型',
      dataIndex: 'extension',
      key: 'extension',
      render: (ext: string) => ext || '无扩展名',
    },
    {
      title: '数量',
      dataIndex: 'count',
      key: 'count',
      width: 100,
    },
    {
      title: '总大小',
      dataIndex: 'totalSize',
      key: 'totalSize',
      width: 120,
      render: (size: number) => formatBytes(size),
    },
  ];

  return (
    <div className="disk-space">
      <div className="last-scan">
        上次扫描: {formatDistanceToNow(spaceAnalysis.lastScan, { addSuffix: true, locale: zhCN })}
      </div>
      <div className="analysis-content">
        <Card title="大目录 TOP 20" size="small" className="analysis-card" >
          <Table 
            dataSource={spaceAnalysis.largeDirectories}
            columns={directoryColumns}
            rowKey="path"
            size="small"
            pagination={false}
            scroll={{ y: 300 }}
          />
        </Card>
        <Card title="大文件 TOP 20" size="small" className="analysis-card" >
          <Table 
            dataSource={spaceAnalysis.largeFiles}
            columns={fileColumns}
            rowKey="path"
            size="small"
            pagination={false}
            scroll={{ y: 300 }}
          />
        </Card>
        <Card title="文件类型分布" size="small" className="analysis-card">
          <Table 
            dataSource={spaceAnalysis.fileTypes}
            columns={typeColumns}
            rowKey="extension"
            size="small"
            pagination={false}
            scroll={{ y: 300 }}
          />
        </Card>
      </div>
    </div>
  );
}; 