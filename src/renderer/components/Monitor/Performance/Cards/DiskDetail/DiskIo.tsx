import React from 'react';
import { Table, Card, Tooltip } from 'antd';
import { DiskIoAnalysis } from '../../../../../types/monitor';
import { formatBytes } from '../../../../../utils/format';

interface DiskIoProps {
  ioAnalysis?: DiskIoAnalysis;
}

export const DiskIo: React.FC<DiskIoProps> = ({ ioAnalysis }) => {
  if (!ioAnalysis) {
    return <div>暂无IO分析数据</div>;
  }

  const processColumns = [
    {
      title: 'PID',
      dataIndex: 'pid',
      key: 'pid',
      width: 80,
    },
    {
      title: '进程',
      dataIndex: 'name',
      key: 'name',
      width: 150,
      ellipsis: true,
      render: (name: string, record: any) => (
        <Tooltip title={record.command}>
          <span>{name}</span>
        </Tooltip>
      ),
    },
    {
      title: '读取速度',
      dataIndex: 'readSpeed',
      key: 'readSpeed',
      width: 120,
      render: (speed: number) => `${formatBytes(speed)}/s`,
    },
    {
      title: '写入速度',
      dataIndex: 'writeSpeed',
      key: 'writeSpeed',
      width: 120,
      render: (speed: number) => `${formatBytes(speed)}/s`,
    },
    {
      title: '总读取',
      dataIndex: 'readBytes',
      key: 'readBytes',
      width: 120,
      render: (bytes: number) => formatBytes(bytes),
    },
    {
      title: '总写入',
      dataIndex: 'writeBytes',
      key: 'writeBytes',
      width: 120,
      render: (bytes: number) => formatBytes(bytes),
    },
  ];

  const deviceColumns = [
    {
      title: '设备',
      dataIndex: 'device',
      key: 'device',
      width: 100,
    },
    {
      title: 'TPS',
      dataIndex: 'tps',
      key: 'tps',
      width: 100,
      render: (tps: number) => tps.toFixed(2),
    },
    {
      title: '读取速度',
      dataIndex: 'readSpeed',
      key: 'readSpeed',
      width: 120,
      render: (speed: number) => `${formatBytes(speed)}/s`,
    },
    {
      title: '写入速度',
      dataIndex: 'writeSpeed',
      key: 'writeSpeed',
      width: 120,
      render: (speed: number) => `${formatBytes(speed)}/s`,
    },
    {
      title: '平均等待时间',
      dataIndex: 'await',
      key: 'await',
      width: 120,
      render: (await: number) => `${await.toFixed(2)}ms`,
    },
    {
      title: '平均服务时间',
      dataIndex: 'svctm',
      key: 'svctm',
      width: 120,
      render: (svctm: number) => `${svctm.toFixed(2)}ms`,
    },
    {
      title: '使用率',
      dataIndex: 'util',
      key: 'util',
      width: 100,
      render: (util: number) => `${util.toFixed(2)}%`,
    },
  ];

  return (
    <div className="disk-io">
      <div className="io-content">
        <Card title="IO进程 TOP 10" size="small" className="io-card">
          <Table 
            dataSource={ioAnalysis.topProcesses}
            columns={processColumns}
            rowKey="pid"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </Card>
        <Card title="设备IO统计" size="small" className="io-card">
          <Table 
            dataSource={ioAnalysis.deviceStats}
            columns={deviceColumns}
            rowKey="device"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </div>
    </div>
  );
}; 