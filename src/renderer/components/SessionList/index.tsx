import React, { useState, useEffect, useMemo } from 'react';
import { List, Button, Modal, Form, Input, InputNumber, Card, Typography, Radio, Upload, Dropdown, Badge, message } from 'antd';
import { PlusOutlined, UploadOutlined, MoreOutlined, EditOutlined, DeleteOutlined, CopyOutlined, SearchOutlined } from '@ant-design/icons';
import { storageService } from '../../services/storage';
import type { SessionInfo } from '../../../main/services/storage';
import './index.css';

const { Title } = Typography;
const { Password, Search } = Input;

// 组件属性接口
interface SessionListProps {
  activeSession?: string;
  onSessionSelect?: (sessionId: string) => void;
}

const SessionList: React.FC<SessionListProps> = ({ activeSession, onSessionSelect }) => {
  // 状态管理
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionInfo | null>(null);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();

  // 加载会话数据
  useEffect(() => {
    loadSessions();
  }, []);

  // 过滤会话列表
  const filteredSessions = useMemo(() => {
    if (!searchText) return sessions;
    
    const searchLower = searchText.toLowerCase();
    return sessions.filter(session => 
      session.name.toLowerCase().includes(searchLower) ||
      session.host.toLowerCase().includes(searchLower) ||
      session.username.toLowerCase().includes(searchLower) ||
      (session.group && session.group.toLowerCase().includes(searchLower))
    );
  }, [sessions, searchText]);

  // 加载会话列表
  const loadSessions = async () => {
    try {
      const loadedSessions = await storageService.loadSessions();
      setSessions(loadedSessions);
    } catch (error) {
      message.error('加载会话列表失败');
      console.error('加载会话列表失败:', error);
    }
  };

  // 处理搜索
  const handleSearch = (value: string) => {
    setSearchText(value);
  };

  // 处理新建会话
  const handleAddSession = () => {
    setEditingSession(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  // 处理编辑会话
  const handleEditSession = (session: SessionInfo) => {
    setEditingSession(session);
    form.setFieldsValue(session);
    setIsModalVisible(true);
  };

  // 处理复制会话
  const handleCopySession = async (session: SessionInfo) => {
    try {
      const newSession: SessionInfo = {
        ...session,
        id: Date.now().toString(),
        name: `${session.name} (复制)`,
        status: 'disconnected'
      };
      const newSessions = [...sessions, newSession];
      await storageService.saveSessions(newSessions);
      setSessions(newSessions);
      message.success('会话已复制');
    } catch (error) {
      message.error('复制会话失败');
      console.error('复制会话失败:', error);
    }
  };

  // 处理删除会话
  const handleDeleteSession = (session: SessionInfo) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除会话 "${session.name}" 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          const newSessions = sessions.filter(s => s.id !== session.id);
          await storageService.saveSessions(newSessions);
          setSessions(newSessions);
          message.success('会话已删除');
        } catch (error) {
          message.error('删除会话失败');
          console.error('删除会话失败:', error);
        }
      }
    });
  };

  // 处理表单提交
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      let newSessions: SessionInfo[];
      
      if (editingSession) {
        // 编辑现有会话
        newSessions = sessions.map(s => 
          s.id === editingSession.id 
            ? { ...s, ...values, status: 'disconnected' }
            : s
        );
        message.success('会话已更新');
      } else {
        // 创建新会话
        const newSession: SessionInfo = {
          id: Date.now().toString(),
          ...values,
          status: 'disconnected'
        };
        newSessions = [...sessions, newSession];
        message.success('会话已创建');
      }

      await storageService.saveSessions(newSessions);
      setSessions(newSessions);
      setIsModalVisible(false);
      form.resetFields();
      setEditingSession(null);
    } catch (error) {
      if (error instanceof Error) {
        message.error('保存会话失败');
        console.error('保存会话失败:', error);
      }
    }
  };

  // 处理取消
  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
    setEditingSession(null);
  };

  // 处理认证方式变更
  const handleAuthTypeChange = () => {
    form.setFieldsValue({
      password: undefined,
      privateKey: undefined
    });
  };

  // 获取会话状态的徽标状态
  const getSessionBadgeStatus = (status: SessionInfo['status']) => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'processing';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  // 获取会话状态的文本
  const getSessionStatusText = (status: SessionInfo['status']) => {
    switch (status) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中';
      case 'error':
        return '连接错误';
      default:
        return '未连接';
    }
  };

  // 渲染会话操作菜单
  const getSessionMenu = (session: SessionInfo) => [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: '编辑',
      onClick: () => handleEditSession(session)
    },
    {
      key: 'copy',
      icon: <CopyOutlined />,
      label: '复制',
      onClick: () => handleCopySession(session)
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: '删除',
      onClick: () => handleDeleteSession(session)
    }
  ];

  return (
    <div className="session-list">
      <Card>
        <Title level={4}>会话列表</Title>
        <div className="session-list-header">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAddSession}
          >
            新建会话
          </Button>
          <Search
            placeholder="搜索会话..."
            allowClear
            onChange={e => handleSearch(e.target.value)}
            style={{ width: 200 }}
          />
        </div>

        <List
          dataSource={filteredSessions}
          renderItem={item => (
            <List.Item
              className={`session-item ${item.id === activeSession ? 'active' : ''}`}
              onClick={() => onSessionSelect?.(item.id)}
              actions={[
                <Dropdown
                  key="more"
                  menu={{ items: getSessionMenu(item) }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Button 
                    type="text" 
                    icon={<MoreOutlined />}
                    onClick={e => e.stopPropagation()}
                  />
                </Dropdown>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Badge 
                    status={getSessionBadgeStatus(item.status)} 
                    text={getSessionStatusText(item.status)}
                  />
                }
                title={item.name}
                description={
                  <>
                    <div>{`${item.username}@${item.host}:${item.port}`}</div>
                    {item.group && <div className="session-group">分组: {item.group}</div>}
                  </>
                }
              />
            </List.Item>
          )}
        />

        <Modal
          title={editingSession ? "编辑 SSH 会话" : "新建 SSH 会话"}
          open={isModalVisible}
          onOk={handleModalOk}
          onCancel={handleModalCancel}
          width={500}
        >
          <Form
            form={form}
            layout="vertical"
            initialValues={{ port: 22, authType: 'password' }}
          >
            <Form.Item
              name="name"
              label="会话名称"
              rules={[{ required: true, message: '请输入会话名称' }]}
            >
              <Input placeholder="请输入会话名称" />
            </Form.Item>

            <Form.Item
              name="host"
              label="主机地址"
              rules={[{ required: true, message: '请输入主机地址' }]}
            >
              <Input placeholder="请输入主机地址" />
            </Form.Item>

            <Form.Item
              name="port"
              label="端口"
              rules={[{ required: true, message: '请输入端口号' }]}
            >
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item
              name="username"
              label="用户名"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder="请输入用户名" />
            </Form.Item>

            <Form.Item
              name="authType"
              label="认证方式"
              rules={[{ required: true, message: '请选择认证方式' }]}
            >
              <Radio.Group onChange={handleAuthTypeChange}>
                <Radio value="password">密码认证</Radio>
                <Radio value="privateKey">密钥认证</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) => prevValues.authType !== currentValues.authType}
            >
              {({ getFieldValue }) =>
                getFieldValue('authType') === 'password' ? (
                  <Form.Item
                    name="password"
                    label="密码"
                    rules={[{ required: true, message: '请输入密码' }]}
                  >
                    <Password placeholder="请输入密码" />
                  </Form.Item>
                ) : (
                  <Form.Item
                    name="privateKey"
                    label="私钥文件"
                    rules={[{ required: true, message: '请选择私钥文件' }]}
                  >
                    <Upload
                      beforeUpload={file => {
                        const reader = new FileReader();
                        reader.readAsText(file);
                        reader.onload = () => {
                          form.setFieldsValue({ privateKey: reader.result });
                        };
                        return false;
                      }}
                    >
                      <Button icon={<UploadOutlined />}>选择私钥文件</Button>
                    </Upload>
                  </Form.Item>
                )
              }
            </Form.Item>

            <Form.Item
              name="group"
              label="分组"
            >
              <Input placeholder="请输入分组名称（可选）" />
            </Form.Item>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default SessionList; 