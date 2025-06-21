/**
 * 连接监控配置内容组件
 */

import React, { useState, useEffect } from 'react';
import { Card, Select, Space, Typography, Divider } from 'antd';
import { ConnectionMonitor } from '../Debug/ConnectionMonitor';
import { storageService } from '../../services/storage';
import type { SessionInfo } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface ConnectionMonitorContentProps {
  // 这里不需要form，因为连接监控是实时显示的
}

export const ConnectionMonitorContent: React.FC<ConnectionMonitorContentProps> = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');

  // 获取会话列表
  useEffect(() => {
    const loadSessions = async () => {
      try {
        const allSessions = await storageService.loadSessions();
        // 检查每个会话的连接状态
        const sessionsWithStatus = await Promise.all(
          allSessions.map(async (session) => {
            try {
              const { ipcRenderer } = window.require('electron');
              const result = await ipcRenderer.invoke('ssh:is-connected', session.id);
              return {
                ...session,
                status: result.success && result.data ? 'connected' : 'disconnected'
              } as SessionInfo;
            } catch (error) {
              return {
                ...session,
                status: 'disconnected'
              } as SessionInfo;
            }
          })
        );

        // 只显示已连接的会话
        const connectedSessions = sessionsWithStatus.filter(session =>
          session.status === 'connected'
        );
        setSessions(connectedSessions);

        // 如果当前选择的会话不在列表中，清空选择
        if (selectedSessionId && !connectedSessions.find(s => s.id === selectedSessionId)) {
          setSelectedSessionId('');
        }

        // 如果没有选择会话且有可用会话，自动选择第一个
        if (!selectedSessionId && connectedSessions.length > 0) {
          setSelectedSessionId(connectedSessions[0].id);
        }
      } catch (error) {
        console.error('加载会话列表失败:', error);
        setSessions([]);
      }
    };

    loadSessions();

    // 定期刷新会话列表
    const interval = setInterval(loadSessions, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [selectedSessionId]);

  return (
    <div style={{ padding: '16px' }}>
      <Title level={4}>SSH连接监控</Title>
      <Text type="secondary">
        实时监控SSH连接状态，包括专用连接和连接池使用情况
      </Text>

      <Divider />

      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 会话选择器 */}
        <Card size="small" title="选择要监控的会话">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>当前已连接的会话：</Text>
            <Select
              style={{ width: '100%' }}
              placeholder="请选择要监控的会话"
              value={selectedSessionId}
              onChange={setSelectedSessionId}
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {sessions.map(session => (
                <Option key={session.id} value={session.id}>
                  {session.name || session.host} ({session.host}:{session.port})
                </Option>
              ))}
            </Select>
            
            {sessions.length === 0 && (
              <Text type="secondary">
                暂无已连接的会话。请先连接到服务器后再查看连接监控。
              </Text>
            )}
          </Space>
        </Card>

        {/* 连接监控组件 */}
        {selectedSessionId && (
          <ConnectionMonitor 
            sessionId={selectedSessionId} 
            visible={true}
          />
        )}
      </Space>

      <Divider />

      {/* 使用说明 */}
      <Card size="small" title="使用说明">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>连接类型说明：</Text>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li><Text strong>专用连接：</Text>用于终端Shell会话，每个终端独占一个连接</li>
            <li><Text strong>共享连接池：</Text>用于监控、补全等短期命令执行，多个服务共享</li>
            <li><Text strong>传输连接池：</Text>用于文件传输和SFTP操作，支持并发传输</li>
          </ul>

          <Text strong>状态指标说明：</Text>
          <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
            <li><Text strong>总连接数：</Text>连接池中的总连接数量</li>
            <li><Text strong>可用连接：</Text>当前可以立即使用的连接数量</li>
            <li><Text strong>已借用：</Text>当前正在使用的连接数量</li>
            <li><Text strong>等待中：</Text>正在等待获取连接的请求数量（如果大于0可能有性能问题）</li>
          </ul>

          <Text type="warning">
            <Text strong>注意：</Text>如果"等待中"数量持续大于0，说明连接池可能不够用，可能会影响性能。
          </Text>
        </Space>
      </Card>
    </div>
  );
};
