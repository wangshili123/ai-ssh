import React, { useMemo } from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { NetworkDetailInfo } from '../../../../../types/monitor';

interface NetworkConnectionsProps {
  networkInfo: NetworkDetailInfo;
}

interface ConnectionTableItem {
  key: string;
  protocol: string;
  localAddress: string;
  remoteAddress: string;
  state: string;
  process: string;
}

export const NetworkConnections: React.FC<NetworkConnectionsProps> = React.memo(({ networkInfo }) => {
  const columns: ColumnsType<ConnectionTableItem> = useMemo(() => [
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 80,
    },
    {
      title: '本地地址',
      dataIndex: 'localAddress',
      key: 'localAddress',
      ellipsis: true,
    },
    {
      title: '远程地址',
      dataIndex: 'remoteAddress',
      key: 'remoteAddress',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 120,
    },
    {
      title: '进程',
      dataIndex: 'process',
      key: 'process',
      ellipsis: true,
    },
  ], []);

  const data: ConnectionTableItem[] = useMemo(() => 
    networkInfo.connections.list.map((conn, index) => ({
      key: `${index}`,
      protocol: conn.protocol,
      localAddress: `${conn.localAddress}:${conn.localPort}`,
      remoteAddress: `${conn.remoteAddress}:${conn.remotePort}`,
      state: conn.state,
      process: conn.process || '未知'
    })),
    [networkInfo.connections.list]
  );

  return (
    <div className="network-connections">
      <div className="connection-stats">
        <div className="stat-card">
          <div className="stat-value">{networkInfo.connections.total}</div>
          <div className="stat-label">总连接数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{networkInfo.connections.tcp}</div>
          <div className="stat-label">TCP 连接</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{networkInfo.connections.udp}</div>
          <div className="stat-label">UDP 连接</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{networkInfo.connections.listening}</div>
          <div className="stat-label">监听端口</div>
        </div>
      </div>

      <div className="connection-table">
        <Table<ConnectionTableItem>
          columns={columns}
          dataSource={data}
          pagination={false}
          scroll={{ y: 'calc(100vh - 400px)', scrollToFirstRowOnChange: true }}
          size="middle"
          virtual
        />
      </div>
    </div>
  );
}); 