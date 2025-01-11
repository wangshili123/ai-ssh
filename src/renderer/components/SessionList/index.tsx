import React, { useState } from 'react';
import { List, Button, Modal, Form, Input, InputNumber, Card, Typography, Radio, Upload } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import './index.css';

const { Title } = Typography;
const { Password } = Input;

// 认证方式类型
type AuthType = 'password' | 'privateKey';

// 会话信息接口
interface SessionInfo {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string;
  privateKey?: string;
  group?: string;
}

// 组件属性接口
interface SessionListProps {
  activeSession?: string;
  onSessionSelect?: (sessionId: string) => void;
}

const SessionList: React.FC<SessionListProps> = ({ activeSession, onSessionSelect }) => {
  // 状态管理
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();

  // 处理新建会话
  const handleAddSession = () => {
    setIsModalVisible(true);
  };

  // 处理表单提交
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      const newSession: SessionInfo = {
        id: Date.now().toString(),
        ...values
      };
      setSessions([...sessions, newSession]);
      setIsModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  // 处理取消新建
  const handleModalCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  // 处理认证方式变更
  const handleAuthTypeChange = (e: any) => {
    form.setFieldsValue({
      password: undefined,
      privateKey: undefined
    });
  };

  return (
    <div className="session-list">
      <Card>
        <Title level={4}>会话列表</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddSession}
          style={{ marginBottom: 16 }}
        >
          新建会话
        </Button>

        <List
          dataSource={sessions}
          renderItem={item => (
            <List.Item
              className={`session-item ${item.id === activeSession ? 'active' : ''}`}
              onClick={() => onSessionSelect?.(item.id)}
            >
              <List.Item.Meta
                title={item.name}
                description={`${item.username}@${item.host}:${item.port}`}
              />
            </List.Item>
          )}
        />

        <Modal
          title="新建 SSH 会话"
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