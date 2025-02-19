import React, { useMemo, useState } from 'react';
import { Table, Card, Space, Input, Drawer, Statistic, Alert, Spin, Badge, message, Row, Col } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { SearchOutlined } from '@ant-design/icons';
import { NetworkDetailInfo, NetworkProcess } from '../../../../../types/monitor/monitor';
import { formatBytes } from '../../../../../utils/format';
import './NetworkProcesses.css';
import { getServiceManager } from '../../../../../services/monitor/serviceManager';

interface NetworkProcessesProps {
  networkInfo: NetworkDetailInfo;
  sessionId: string;
}

type ProcessTableItem = NetworkProcess & { key: string };

// 添加进程详情类型
interface ProcessDetail {
  connections: Array<{
    protocol: string;
    localAddr: string;
    remoteAddr: string;
    state: string;
    type: string;
  }>;
  cmdline: string;
}

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

export const NetworkProcesses: React.FC<NetworkProcessesProps> = React.memo(({ networkInfo, sessionId }) => {
  // 状态管理
  const [selectedProcess, setSelectedProcess] = useState<ProcessTableItem | null>(null);
  const [searchText, setSearchText] = useState<string>('');
  const [processDetail, setProcessDetail] = useState<ProcessDetail | null>(null);
  const [loading, setLoading] = useState(false);

  // 表格列定义
  const columns: ColumnsType<ProcessTableItem> = useMemo(() => [
    {
      title: '进程',
      dataIndex: 'name',
      key: 'name',
      sorter: (a: ProcessTableItem, b: ProcessTableItem) => a.name.localeCompare(b.name),
      render: (text: string, record: ProcessTableItem) => (
        <Space>
          <span>{text}</span>
          <span style={{ color: '#999' }}>({record.pid})</span>
        </Space>
      ),
    },
    {
      title: '下载速度',
      dataIndex: 'rxSpeed',
      key: 'rxSpeed',
      width: 120,
      render: (value: number) => `${formatBytes(value)}/s`,
      sorter: (a: ProcessTableItem, b: ProcessTableItem) => a.rxSpeed - b.rxSpeed,
      defaultSortOrder: 'descend',
    },
    {
      title: '上传速度',
      dataIndex: 'txSpeed',
      key: 'txSpeed',
      width: 120,
      render: (value: number) => `${formatBytes(value)}/s`,
      sorter: (a: ProcessTableItem, b: ProcessTableItem) => a.txSpeed - b.txSpeed,
    }
  ], []);

  // 表格数据处理
  const tableData = useMemo(() => {
    if (!networkInfo.processes.isToolInstalled) {
      return [];
    }
    return networkInfo.processes.list
      .filter(proc => {
        if (searchText) {
          const searchLower = searchText.toLowerCase();
          return (
            proc.name.toLowerCase().includes(searchLower) ||
            proc.command.toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
      .map((proc, index) => ({
        ...proc,
        key: `${index}`
      }));
  }, [networkInfo.processes.list, searchText, networkInfo.processes.isToolInstalled]);

  // 获取进程详情
  const fetchProcessDetail = async (pid: number) => {
    try {
      setLoading(true);
      const networkProcessService = getServiceManager().getMonitorManager().getNetworkProcessService();
      const detail = await networkProcessService.getProcessDetail(sessionId, pid);
      setProcessDetail(detail);
    } catch (error) {
      console.error('获取进程详情失败:', error);
      message.error('获取进程详情失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理进程选择
  const handleProcessSelect = (process: ProcessTableItem) => {
    setSelectedProcess(process);
    fetchProcessDetail(process.pid);
  };

  if (!networkInfo.processes.isToolInstalled) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <Alert
          message="无法获取进程网络使用信息"
          description={
            <div>
              <p>请确保系统已安装 nethogs 工具：</p>
              <p style={{ color: '#666', fontSize: '13px', marginTop: '10px' }}>
                Ubuntu/Debian: sudo apt-get install nethogs
                <br />
                CentOS/RHEL: sudo yum install nethogs
                <br />
                <br />
                注意：nethogs 需要 root 权限才能运行
              </p>
            </div>
          }
          type="warning"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="monitor-network-processes">
      {/* 进程列表 */}
      <div className="monitor-network-processes__list">
        <Card
          title="进程网络使用"
          extra={
            <Input
              placeholder="搜索进程"
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ width: 200 }}
              allowClear
            />
          }
        >
          <Table<ProcessTableItem>
            columns={columns}
            dataSource={tableData}
            size="middle"
            scroll={{ y: 'calc(100vh - 200px)' }}
            onRow={(record) => ({
              onClick: () => handleProcessSelect(record)
            })}
            rowClassName={() => 'monitor-network-processes__table-row'}
            pagination={false}
            virtual
          />
        </Card>
      </div>

      {/* 进程详情抽屉 */}
      <Drawer
        title="进程详情"
        placement="right"
        width={600}
        onClose={() => {
          setSelectedProcess(null);
          setProcessDetail(null);
        }}
        open={!!selectedProcess}
      >
        {selectedProcess && (
          <div className="monitor-network-processes__drawer-content">
            <Spin spinning={loading}>
              {/* 基本信息卡片 */}
              <Card title="基本信息" size="small" className="monitor-network-processes__info-card">
                <div className="monitor-network-processes__info-item">
                  <span className="monitor-network-processes__info-label">进程名：</span>
                  <span className="monitor-network-processes__info-value">{selectedProcess.name}</span>
                </div>
                <div className="monitor-network-processes__info-item">
                  <span className="monitor-network-processes__info-label">PID：</span>
                  <span className="monitor-network-processes__info-value">{selectedProcess.pid}</span>
                </div>
                {processDetail?.cmdline && (
                  <div className="monitor-network-processes__info-item">
                    <span className="monitor-network-processes__info-label">命令行：</span>
                    <span className="monitor-network-processes__info-value">{processDetail.cmdline}</span>
                  </div>
                )}
              </Card>

              {/* 网络使用卡片 */}
              <Card title="网络使用" size="small" className="monitor-network-processes__info-card">
                <Space size="large">
                  <Statistic
                    title="下载速度"
                    value={formatBytes(selectedProcess.rxSpeed)}
                    suffix="/s"
                  />
                  <Statistic
                    title="上传速度"
                    value={formatBytes(selectedProcess.txSpeed)}
                    suffix="/s"
                  />
                </Space>
              </Card>

              {/* 网络连接列表 */}
              {processDetail?.connections && processDetail.connections.length > 0 && (
                <Card title="活跃连接" size="small" className="monitor-network-processes__info-card">
                  <Table
                    dataSource={processDetail.connections}
                    columns={[
                      {
                        title: '协议',
                        dataIndex: 'protocol',
                        width: 80,
                      },
                      {
                        title: '本地地址',
                        dataIndex: 'localAddr',
                        ellipsis: true,
                        render: (addr: string) => formatAddress(addr),
                      },
                      {
                        title: '远程地址',
                        dataIndex: 'remoteAddr',
                        ellipsis: true,
                        render: (addr: string) => formatAddress(addr),
                      },
                      {
                        title: '状态',
                        dataIndex: 'state',
                        width: 100,
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
                      {
                        title: '类型',
                        dataIndex: 'type',
                        width: 80,
                        render: (type: string) => (
                          <Badge
                            color={type === '内网' ? 'blue' : 'green'}
                            text={type}
                          />
                        ),
                      },
                    ]}
                    size="small"
                    pagination={false}
                    scroll={{ y: 200 }}
                  />
                </Card>
              )}
            </Spin>
          </div>
        )}
      </Drawer>
    </div>
  );
}); 