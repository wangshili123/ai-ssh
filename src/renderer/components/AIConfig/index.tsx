import React, { useEffect, useState } from 'react';
import { Form, Input, Select, InputNumber, Button, message, Card, Space } from 'antd';
import { aiConfigService } from '../../services/ai-config';
import type { AIConfig } from '../../../main/services/ai-config';
import './index.css';

interface AIConfigComponentProps {
  onSaveSuccess?: () => void;
  onSaveError?: (error: Error) => void;
}

const AIConfigComponent: React.FC<AIConfigComponentProps> = ({
  onSaveSuccess,
  onSaveError
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  // 加载配置
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const config = await aiConfigService.loadConfig();
      form.setFieldsValue(config);
    } catch (error) {
      message.error('加载配置失败');
      console.error('加载配置失败:', error);
    }
  };

  // 保存配置
  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      await aiConfigService.saveConfig(values);
      message.success('配置已保存');
      onSaveSuccess?.();
    } catch (error) {
      const err = error as Error;
      message.error('保存配置失败');
      console.error('保存配置失败:', error);
      onSaveError?.(err);
    } finally {
      setLoading(false);
    }
  };

  // 测试配置
  const handleTest = async () => {
    try {
      setTesting(true);
      const values = await form.validateFields();
      const isValid = await aiConfigService.testConfig(values);
      if (isValid) {
        message.success('配置测试成功');
      } else {
        message.error('配置测试失败');
      }
    } catch (error) {
      message.error('配置测试失败');
      console.error('配置测试失败:', error);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card title="AI 配置" className="ai-config-card">
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          model: 'gpt-3.5-turbo',
          temperature: 0.7
        }}
      >
        <Form.Item
          name="apiKey"
          label="OpenAI API Key"
          rules={[{ required: true, message: '请输入 API Key' }]}
        >
          <Input.Password placeholder="请输入 OpenAI API Key" />
        </Form.Item>

        <Form.Item
          name="model"
          label="模型"
          rules={[{ required: true, message: '请输入模型名称' }]}
        >
          <Input placeholder="例如：gpt-3.5-turbo" />
        </Form.Item>

        <Form.Item
          name="temperature"
          label="精确值"
          tooltip="较高的值会使输出更加随机，较低的值会使其更加集中和确定"
          rules={[{ required: true, message: '请输入精确值' }]}
        >
          <InputNumber
            min={0}
            max={2}
            step={0.1}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          name="maxTokens"
          label="最大令牌数"
          tooltip="每次交互最多使用的令牌数量，不填则不限制"
        >
          <InputNumber
            min={1}
            style={{ width: '100%' }}
            placeholder="不填则不限制"
          />
        </Form.Item>

        <Form.Item
          name="proxy"
          label="代理设置"
          tooltip="如果需要代理才能访问 OpenAI API，请填写代理地址"
        >
          <Input placeholder="http://127.0.0.1:7890" />
        </Form.Item>

        <Form.Item
          name="baseURL"
          label="API 基础URL"
          tooltip="如果需要使用自定义的 API 地址，请填写"
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button
              type="primary"
              onClick={handleSave}
              loading={loading}
            >
              保存配置
            </Button>
            <Button
              onClick={handleTest}
              loading={testing}
            >
              测试连接
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default AIConfigComponent; 