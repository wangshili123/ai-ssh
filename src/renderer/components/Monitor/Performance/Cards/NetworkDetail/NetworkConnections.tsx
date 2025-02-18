import React, { useMemo, useState } from 'react';
import { Table, Card, Space, Select, Input, Badge, Drawer, Statistic } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import { NetworkDetailInfo, NetworkConnection } from '../../../../../types/monitor';
import { formatBytes } from '../../../../../utils/format';
import './NetworkConnections.css';  // 添加外部CSS文件引用

interface NetworkConnectionsProps {
  networkInfo: NetworkDetailInfo;
}

// 修改表格项接口以匹配NetworkConnection
type ConnectionTableItem = NetworkConnection & { key: string };

// 添加地址格式化函数
const formatAddress = (address: string) => {
  // 处理 IPv4-mapped IPv6 地址
  const ipv4Mapped = address.match(/\[::ffff:(\d+\.\d+\.\d+\.\d+)\]/);
  if (ipv4Mapped) {
    return ipv4Mapped[1];
  }
  // 处理其他 IPv6 地址
  if (address.startsWith('[') && address.endsWith(']')) {
    const ipv6 = address.slice(1, -1);
    // 如果是本地回环地址 [::1]
    if (ipv6 === '::1') {
      return 'localhost';
    }
    return ipv6;
  }
  return address;
};

export const NetworkConnections: React.FC<NetworkConnectionsProps> = React.memo(({ networkInfo }) => {
  // 状态管理
  const [selectedConnection, setSelectedConnection] = useState<ConnectionTableItem | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterProtocol, setFilterProtocol] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [searchText, setSearchText] = useState<string>('');

  // 统计数据
  const stats = useMemo(() => ({
    total: networkInfo.connections.total,
    tcp: networkInfo.connections.tcp,
    udp: networkInfo.connections.udp,
    listening: networkInfo.connections.listening
  }), [networkInfo.connections]);

  // 表格列定义
  const columns: ColumnsType<ConnectionTableItem> = useMemo(() => [
    {
      title: '进程',
      dataIndex: 'process',
      key: 'process',
      sorter: (a, b) => (a.process || '').localeCompare(b.process || ''),
      render: (text: string | undefined, record) => (
        <Space>
          <span>{text || '系统进程'}</span>
          {record.pid && <span style={{ color: '#999' }}>({record.pid})</span>}
        </Space>
      ),
    },
    {
      title: '本地地址',
      dataIndex: 'localAddress',
      key: 'localAddress',
      sorter: (a, b) => {
        const addrA = `${a.localAddress}:${a.localPort}`;
        const addrB = `${b.localAddress}:${b.localPort}`;
        return addrA.localeCompare(addrB);
      },
      render: (text: string, record) => {
        const addr = formatAddress(text);
        return addr === '*' ? '所有地址' : `${addr}:${record.localPort}`;
      },
      ellipsis: true,
    },
    {
      title: '远程地址',
      dataIndex: 'remoteAddress',
      key: 'remoteAddress',
      sorter: (a, b) => {
        const addrA = `${a.remoteAddress}:${a.remotePort}`;
        const addrB = `${b.remoteAddress}:${b.remotePort}`;
        return addrA.localeCompare(addrB);
      },
      render: (text: string, record) => {
        const addr = formatAddress(text);
        return addr === '*' ? '所有地址' : `${addr}:${record.remotePort}`;
      },
      ellipsis: true,
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 80,
      sorter: (a, b) => a.protocol.localeCompare(b.protocol),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      sorter: (a, b) => a.type.localeCompare(b.type),
      render: (type: string) => {
        const color = type === '内网' ? 'blue' : type === '外网' ? 'green' : 'gray';
        return <Badge color={color} text={type} />;
      },
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 120,
      sorter: (a, b) => a.state.localeCompare(b.state),
      render: (state: string) => {
        const stateMap: { [key: string]: string } = {
          'ESTAB': 'ESTABLISHED (已建立)',
          'LISTEN': 'LISTENING (监听中)',
          'TIME-WAIT': 'TIME WAIT (等待关闭)',
          'SYN-SENT': 'SYN SENT (请求连接)',
          'SYN-RECV': 'SYN RECEIVED (等待确认)',
          'CLOSE-WAIT': 'CLOSE WAIT (等待关闭)',
          'CLOSED': 'CLOSED (已关闭)',
          'FIN-WAIT-1': 'FIN WAIT 1 (等待关闭)',
          'FIN-WAIT-2': 'FIN WAIT 2 (等待关闭)',
          'LAST-ACK': 'LAST ACK (等待确认)',
        };
        return stateMap[state] || state;
      },
    },
  ], []);

  // 表格数据处理
  const tableData = useMemo(() => {
    return networkInfo.connections.list
      .filter(conn => {
        if (filterType !== 'all' && conn.type !== filterType) return false;
        if (filterProtocol !== 'all' && conn.protocol !== filterProtocol) return false;
        if (filterState !== 'all' && conn.state !== filterState) return false;
        if (searchText) {
          const searchLower = searchText.toLowerCase();
          return (
            (conn.process?.toLowerCase().includes(searchLower) || false) ||
            conn.localAddress.includes(searchLower) ||
            conn.remoteAddress.includes(searchLower)
          );
        }
        return true;
      })
      .map((conn, index) => ({
        ...conn,
        key: `${index}`
      }));
  }, [networkInfo.connections.list, filterType, filterProtocol, filterState, searchText]);

  return (
    <div className="monitor-network-connections">
      {/* 统计卡片区 */}
      <div className="monitor-network-connections__stats">
        <Space size="large">
          <Card size="small" className="monitor-network-connections__stats-card">
            <Statistic title="总连接数" value={stats.total} />
          </Card>
          <Card size="small" className="monitor-network-connections__stats-card">
            <Statistic title="TCP 连接" value={stats.tcp} />
          </Card>
          <Card size="small" className="monitor-network-connections__stats-card">
            <Statistic title="UDP 连接" value={stats.udp} />
          </Card>
          <Card size="small" className="monitor-network-connections__stats-card">
            <Statistic title="监听端口" value={stats.listening} />
          </Card>
        </Space>
      </div>

      {/* 过滤器区域 */}
      <div className="monitor-network-connections__filters">
        <Space size="middle">
          <Select
            value={filterType}
            onChange={setFilterType}
            style={{ width: 120 }}
            options={[
              { label: '全部类型', value: 'all' },
              { label: '内网', value: '内网' },
              { label: '外网', value: '外网' },
              { label: '监听', value: '监听' },
            ]}
          />
          <Select
            value={filterProtocol}
            onChange={setFilterProtocol}
            style={{ width: 120 }}
            options={[
              { label: '全部协议', value: 'all' },
              { label: 'TCP', value: 'TCP' },
              { label: 'UDP', value: 'UDP' },
            ]}
          />
          <Select
            value={filterState}
            onChange={setFilterState}
            style={{ width: 120 }}
            options={[
              { label: '全部状态', value: 'all' },
              { label: 'ESTABLISHED', value: 'ESTABLISHED' },
              { label: 'LISTEN', value: 'LISTEN' },
              { label: 'TIME_WAIT', value: 'TIME_WAIT' },
            ]}
          />
          <Input
            placeholder="搜索进程/地址"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
        </Space>
      </div>

      {/* 连接列表 */}
      <div className="monitor-network-connections__table-container">
        <Table<ConnectionTableItem>
          columns={columns}
          dataSource={tableData}
          size="middle"
          scroll={{ 
            x: '100%',
            y: 400
          }}
          pagination={false}
          rowClassName={() => 'monitor-network-connections__table-row'}
          onRow={(record) => ({
            onClick: () => setSelectedConnection(record)
          })}
          virtual
        />
      </div>

      {/* 连接详情抽屉 */}
      <Drawer
        title="连接详情"
        placement="right"
        width={400}
        onClose={() => setSelectedConnection(null)}
        open={!!selectedConnection}
      >
        {selectedConnection && (
          <div className="monitor-network-connections__drawer-content">
            <Card title="基本信息" size="small" className="monitor-network-connections__info-card">
              <div className="monitor-network-connections__info-item">
                <span className="monitor-network-connections__info-label">进程：</span>
                <span className="monitor-network-connections__info-value">{selectedConnection.process || '未知'}</span>
              </div>
              {selectedConnection.pid && (
                <div className="monitor-network-connections__info-item">
                  <span className="monitor-network-connections__info-label">PID：</span>
                  <span className="monitor-network-connections__info-value">{selectedConnection.pid}</span>
                </div>
              )}
              <div className="monitor-network-connections__info-item">
                <span className="monitor-network-connections__info-label">协议：</span>
                <span className="monitor-network-connections__info-value">{selectedConnection.protocol}</span>
              </div>
              <div className="monitor-network-connections__info-item">
                <span className="monitor-network-connections__info-label">状态：</span>
                <span className="monitor-network-connections__info-value">{selectedConnection.state}</span>
              </div>
              <div className="monitor-network-connections__info-item">
                <span className="monitor-network-connections__info-label">类型：</span>
                <span className="monitor-network-connections__info-value">{selectedConnection.type}</span>
              </div>
            </Card>
            <Card title="地址信息" size="small" className="monitor-network-connections__info-card">
              <div className="monitor-network-connections__info-item">
                <span className="monitor-network-connections__info-label">本地地址：</span>
                <span className="monitor-network-connections__info-value">
                  {`${selectedConnection.localAddress}:${selectedConnection.localPort}`}
                </span>
              </div>
              <div className="monitor-network-connections__info-item">
                <span className="monitor-network-connections__info-label">远程地址：</span>
                <span className="monitor-network-connections__info-value">
                  {`${selectedConnection.remoteAddress}:${selectedConnection.remotePort}`}
                </span>
              </div>
            </Card>
          </div>
        )}
      </Drawer>
    </div>
  );
}); 