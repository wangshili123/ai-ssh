/**
 * SSH连接监控组件
 * 用于调试和监控SSH连接状态
 */

import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Tag, Space, Typography, Divider } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { ipcRenderer } = window.require('electron');

interface ConnectionStats {
  dedicated: boolean;
  sharedPool?: {
    size: number;
    available: number;
    borrowed: number;
    pending: number;
  };
  transferPool?: {
    size: number;
    available: number;
    borrowed: number;
    pending: number;
  };
}

interface ConnectionMonitorProps {
  sessionId: string;
  visible?: boolean;
}

export const ConnectionMonitor: React.FC<ConnectionMonitorProps> = ({ 
  sessionId, 
  visible = false 
}) => {
  const [stats, setStats] = useState<ConnectionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // 获取连接状态
  const fetchConnectionStats = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('ssh:get-connection-stats', sessionId);
      if (result.success) {
        setStats(result.data);
        setLastUpdate(new Date());
      } else {
        console.error('获取连接状态失败:', result.error);
      }
    } catch (error) {
      console.error('获取连接状态异常:', error);
    } finally {
      setLoading(false);
    }
  };

  // 执行健康检查
  const performHealthCheck = async () => {
    setLoading(true);
    try {
      const result = await ipcRenderer.invoke('ssh:health-check');
      if (result.success) {
        console.log('健康检查完成');
        await fetchConnectionStats(); // 重新获取状态
      } else {
        console.error('健康检查失败:', result.error);
      }
    } catch (error) {
      console.error('健康检查异常:', error);
    } finally {
      setLoading(false);
    }
  };

  // 自动刷新
  useEffect(() => {
    if (!visible || !sessionId) return;

    fetchConnectionStats();
    const interval = setInterval(fetchConnectionStats, 5000); // 每5秒刷新

    return () => clearInterval(interval);
  }, [sessionId, visible]);

  if (!visible) return null;

  // 连接池状态表格数据
  const poolData = [];
  
  if (stats?.sharedPool) {
    poolData.push({
      key: 'shared',
      type: '共享连接池',
      size: stats.sharedPool.size,
      available: stats.sharedPool.available,
      borrowed: stats.sharedPool.borrowed,
      pending: stats.sharedPool.pending,
      status: stats.sharedPool.available > 0 ? 'healthy' : 'warning'
    });
  }

  if (stats?.transferPool) {
    poolData.push({
      key: 'transfer',
      type: '传输连接池',
      size: stats.transferPool.size,
      available: stats.transferPool.available,
      borrowed: stats.transferPool.borrowed,
      pending: stats.transferPool.pending,
      status: stats.transferPool.available > 0 ? 'healthy' : 'warning'
    });
  }

  const columns = [
    {
      title: '连接池类型',
      dataIndex: 'type',
      key: 'type',
    },
    {
      title: '总连接数',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: '可用连接',
      dataIndex: 'available',
      key: 'available',
      render: (value: number, record: any) => (
        <Tag color={record.status === 'healthy' ? 'green' : 'orange'}>
          {value}
        </Tag>
      ),
    },
    {
      title: '已借用',
      dataIndex: 'borrowed',
      key: 'borrowed',
    },
    {
      title: '等待中',
      dataIndex: 'pending',
      key: 'pending',
      render: (value: number) => (
        <Tag color={value > 0 ? 'red' : 'default'}>
          {value}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag 
          icon={status === 'healthy' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
          color={status === 'healthy' ? 'success' : 'warning'}
        >
          {status === 'healthy' ? '正常' : '警告'}
        </Tag>
      ),
    },
  ];

  return (
    <Card 
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            SSH连接监控 - {sessionId}
          </Title>
          {lastUpdate && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              最后更新: {lastUpdate.toLocaleTimeString()}
            </Text>
          )}
        </Space>
      }
      extra={
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={fetchConnectionStats}
            loading={loading}
            size="small"
          >
            刷新
          </Button>
          <Button 
            onClick={performHealthCheck}
            loading={loading}
            size="small"
            type="primary"
          >
            健康检查
          </Button>
        </Space>
      }
      size="small"
    >
      {/* 专用连接状态 */}
      <div style={{ marginBottom: 16 }}>
        <Text strong>专用连接状态: </Text>
        <Tag 
          icon={stats?.dedicated ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
          color={stats?.dedicated ? 'success' : 'error'}
        >
          {stats?.dedicated ? '已连接' : '未连接'}
        </Tag>
      </div>

      <Divider orientation="left" style={{ margin: '16px 0' }}>连接池状态</Divider>

      {/* 连接池状态表格 */}
      {poolData.length > 0 ? (
        <Table 
          dataSource={poolData}
          columns={columns}
          pagination={false}
          size="small"
          bordered
        />
      ) : (
        <Text type="secondary">暂无连接池数据</Text>
      )}

      {/* 使用说明 */}
      <Divider orientation="left" style={{ margin: '16px 0 8px 0' }}>说明</Divider>
      <div style={{ fontSize: '12px', color: '#666' }}>
        <div>• 专用连接：用于终端Shell会话，长期保持</div>
        <div>• 共享连接池：用于监控、补全等短期命令执行</div>
        <div>• 传输连接池：用于文件传输和SFTP操作</div>
        <div>• 等待中 &gt; 0 表示有请求在等待可用连接，可能出现性能问题</div>
      </div>
    </Card>
  );
};

export default ConnectionMonitor;
