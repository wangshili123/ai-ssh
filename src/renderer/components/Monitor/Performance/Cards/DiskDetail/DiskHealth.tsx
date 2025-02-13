import React from 'react';
import { Card, Table, Tag, Tooltip } from 'antd';
import { DiskHealth as DiskHealthType } from '../../../../../types/monitor';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface DiskHealthProps {
  health?: DiskHealthType;
}

export const DiskHealth: React.FC<DiskHealthProps> = ({ health }) => {
  if (!health) {
    return <div>暂无磁盘健康信息</div>;
  }

  if (health.devices.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <p>未能获取磁盘健康信息</p>
        <p style={{ color: '#666', fontSize: '13px' }}>
          请确保系统已安装 smartmontools 工具包：
          <br />
          Ubuntu/Debian: sudo apt-get install smartmontools
          <br />
          CentOS/RHEL: sudo yum install smartmontools
        </p>
      </div>
    );
  }

  const getStatusTag = (status: string) => {
    const statusMap = {
      'PASSED': { color: '#52c41a', text: '正常' },
      'FAILED': { color: '#ff4d4f', text: '异常' },
      'UNKNOWN': { color: '#faad14', text: '未知' }
    };
    const { color, text } = statusMap[status as keyof typeof statusMap] || statusMap.UNKNOWN;
    return <Tag color={color}>{text}</Tag>;
  };

  const columns = [
    {
      title: '设备',
      dataIndex: 'device',
      key: 'device',
      width: 100,
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '温度',
      dataIndex: 'temperature',
      key: 'temperature',
      width: 100,
      render: (temp: number) => (
        <Tooltip title="磁盘温度">
          <span className={temp > 50 ? 'text-warning' : temp > 40 ? 'text-caution' : ''}>
            {temp}°C
          </span>
        </Tooltip>
      ),
    },
    {
      title: '已使用时间',
      dataIndex: 'powerOnHours',
      key: 'powerOnHours',
      width: 120,
      render: (hours: number) => `${Math.round(hours / 24)} 天`,
    },
    {
      title: '剩余寿命',
      dataIndex: 'remainingLife',
      key: 'remainingLife',
      width: 100,
      render: (life?: number) => life ? `${life}%` : '未知',
    },
    {
      title: '坏道数',
      key: 'badSectors',
      width: 200,
      render: (record: any) => (
        <Tooltip title="重分配扇区/待处理扇区/不可修复扇区">
          <span className={record.reallocatedSectors > 0 ? 'text-warning' : ''}>
            {record.reallocatedSectors}/{record.pendingSectors}/{record.uncorrectableSectors}
          </span>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="disk-health">
      <div className="last-check">
        上次检查: {formatDistanceToNow(health.lastCheck, { addSuffix: true, locale: zhCN })}
      </div>
      <Table 
        dataSource={health.devices}
        columns={columns}
        rowKey="device"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}; 