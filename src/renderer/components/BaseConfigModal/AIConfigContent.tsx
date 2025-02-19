import React, { useEffect, useState, forwardRef } from 'react';
import { Form, InputNumber, Select, Input, Switch, Radio, Card, Space, Button, message } from 'antd';
import type { FormInstance } from 'antd/es/form';
import type { AIConfig } from '../../types/baseconfig/BaseConfigType';
import { AIConfigManager } from '../../services/config/AIConfig';

interface AIConfigContentProps {
  form: FormInstance;
}

/**
 * AI 配置内容组件
 */
export const AIConfigContent = forwardRef<FormInstance, AIConfigContentProps>(({ form }, ref) => {
  const configManager = AIConfigManager.getInstance();
  const [testing, setTesting] = useState(false);

  // 加载配置
  useEffect(() => {
    const config = configManager.getConfig();
    form.setFieldsValue(config);
  }, [form]);

  // 测试配置
  const handleTest = async () => {
    try {
      setTesting(true);
      const values = await form.validateFields();
      
      if (!values.baseURL) {
        message.error('API URL不能为空');
        return;
      }

      const url = `${values.baseURL}/chat/completions`;
      const requestOptions: any = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${values.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: values.model,
          messages: [{ role: 'user', content: 'hi' }],
          temperature: 0.7,
          max_tokens: 10
        })
      };

      // 如果设置了代理，添加代理配置
      if (values.proxy) {
        console.log('使用代理:', values.proxy);
        // 注意：在渲染进程中，我们使用 fetch 发送请求，代理配置会通过系统代理自动处理
      }

      console.log('发送测试请求:', {
        url,
        method: requestOptions.method,
        headers: requestOptions.headers,
        proxy: values.proxy
      });

      const response = await fetch(url, requestOptions);
      console.log('HTTP状态码:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API测试失败:', errorText);
        message.error(`API测试失败: ${errorText}`);
        return;
      }

      const responseData = await response.json();
      console.log('API测试响应:', JSON.stringify(responseData, null, 2));

      // 检查响应中是否包含 choices 字段
      if (responseData && Array.isArray(responseData.choices)) {
        message.success('配置测试成功');
      } else {
        message.error('API响应格式不正确');
      }
    } catch (error) {
      console.error('测试AI配置失败:', error);
      message.error('配置测试失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={configManager.getConfig()}
    >
      {/* 基础配置 */}
      <Card type="inner" title="基础配置">
        <Form.Item
          name="apiKey"
          label="OpenAI API Key"
        //   rules={[{ required: true, message: '请输入 API Key' }]}
        >
          <Input.Password placeholder="请输入 OpenAI API Key" />
        </Form.Item>

        <Form.Item
          name="model"
          label="模型"
        //   rules={[{ required: true, message: '请选择模型' }]}
        >
                    <Input placeholder="GPT-4" />
  
        </Form.Item>

        <Form.Item
          name="temperature"
          label="随机性"
          tooltip="较高的值会使输出更加随机，较低的值会使其更加集中和确定"
        //   rules={[{ required: true, message: '请输入温度值' }]}
        >
          <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item
          name="maxTokens"
          label="最大令牌数"
          tooltip="每次交互最多使用的令牌数量，不填则不限制"
        >
          <InputNumber min={1} max={4096} style={{ width: '100%' }} />
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
          tooltip="API服务地址，例如：https://api.openai.com/v1"
        //   rules={[{ required: true, message: '请输入API基础URL' }]}
        >
          <Input placeholder="https://api.openai.com/v1" />
        </Form.Item>
      </Card>

      {/* Agent 模式配置 */}
      <Card type="inner" title="Agent 模式配置" style={{ marginTop: '16px' }}>
        <Form.Item
          name="agentAutoRun"
          label="开启自动分析"
          tooltip="开启后，Agent 模式将根据命令风险等级自动执行命令"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.agentAutoRun !== currentValues.agentAutoRun
          }
        >
          {({ getFieldValue }) => {
            const agentAutoRun = getFieldValue('agentAutoRun');
            return agentAutoRun ? (
              <Form.Item
                name="agentRiskLevel"
                label="允许自动执行的最高风险等级"
                tooltip="只有低于或等于此风险等级的命令才会自动执行"
                rules={[{ required: true, message: '请选择允许自动执行的最高风险等级' }]}
              >
                <Radio.Group>
                  <Radio.Button value="low">低风险</Radio.Button>
                  <Radio.Button value="medium">中风险</Radio.Button>
                  <Radio.Button value="high">高风险</Radio.Button>
                </Radio.Group>
              </Form.Item>
            ) : null;
          }}
        </Form.Item>
      </Card>

      <Form.Item style={{ marginTop: '16px' }}>
        <Space>
          <Button onClick={handleTest} loading={testing}>
            测试连接
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}); 