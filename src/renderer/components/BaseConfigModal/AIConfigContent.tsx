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
  const [analyzing, setAnalyzing] = useState(false);

  // 加载配置
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await configManager.getConfig();
        form.setFieldsValue(config);
      } catch (error) {
        console.error('加载AI配置失败:', error);
      }
    };
    loadConfig();
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

  // 手动触发分析
  const handleManualAnalysis = async () => {
    try {
      setAnalyzing(true);

      // 动态导入AnalysisScheduler（因为它在services目录下）
      const { AnalysisScheduler } = await import('../../../services/completion/learning/analyzer/AnalysisScheduler');
      const scheduler = AnalysisScheduler.getInstance();

      const result = await scheduler.triggerAnalysis();

      if (result.success) {
        message.success(result.message);
        // 重新加载配置以更新使用次数显示
        const config = await configManager.getConfig();
        form.setFieldsValue(config);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      console.error('手动触发分析失败:', error);
      message.error('触发分析失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
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

      {/* 自动分析配置 */}
      <Card type="inner" title="自动分析配置" style={{ marginTop: '16px' }}>
        <Form.Item
          name="autoAnalysisEnabled"
          label="启用自动分析"
          tooltip="开启后系统会自动分析命令使用模式，提升补全准确性，但会消耗AI额度"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.autoAnalysisEnabled !== currentValues.autoAnalysisEnabled
          }
        >
          {({ getFieldValue }) => {
            const autoAnalysisEnabled = getFieldValue('autoAnalysisEnabled');
            return autoAnalysisEnabled ? (
              <>
                <Form.Item
                  name="autoAnalysisFrequency"
                  label="分析频率"
                  tooltip="控制自动分析的执行频率，降低AI额度消耗"
                  rules={[{ required: true, message: '请选择分析频率' }]}
                >
                  <Radio.Group>
                    <Radio.Button value="daily">每日一次</Radio.Button>
                    <Radio.Button value="weekly">每周一次</Radio.Button>
                    <Radio.Button value="manual">仅手动</Radio.Button>
                  </Radio.Group>
                </Form.Item>

                <Form.Item
                  name="autoAnalysisQuotaLimit"
                  label="月度调用限制"
                  tooltip="限制每月AI分析调用次数，防止额度过度消耗"
                >
                  <InputNumber
                    min={1}
                    max={1000}
                    placeholder="50"
                    addonAfter="次/月"
                    style={{ width: '100%' }}
                  />
                </Form.Item>

                <Form.Item
                  label="本月使用情况"
                  tooltip="显示当前月份已使用的AI分析次数"
                >
                  <div style={{ color: '#666' }}>
                    已使用: {getFieldValue('autoAnalysisCurrentUsage') || 0} / {getFieldValue('autoAnalysisQuotaLimit') || 50} 次
                  </div>
                </Form.Item>

                {/* 手动触发分析按钮 */}
                <Form.Item
                  label="手动分析"
                  tooltip="立即触发一次AI分析，无论当前频率设置如何"
                >
                  <Button
                    onClick={handleManualAnalysis}
                    loading={analyzing}
                    type="default"
                    disabled={!getFieldValue('autoAnalysisEnabled')}
                  >
                    {analyzing ? '分析中...' : '立即分析'}
                  </Button>
                  <div style={{ color: '#999', fontSize: '12px', marginTop: '4px' }}>
                    {getFieldValue('autoAnalysisFrequency') === 'manual'
                      ? '仅手动模式：只能通过此按钮触发分析'
                      : '可随时手动触发分析，不受频率限制'}
                  </div>
                </Form.Item>
              </>
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