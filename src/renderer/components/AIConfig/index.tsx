import React, { useEffect, useState } from 'react';
import { Form, Input, Select, InputNumber, Button, message, Card, Space, Switch, Radio, Tooltip } from 'antd';
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
    console.log('开始测试配置...');
    try {
      setTesting(true);
      const values = await form.validateFields();
      console.log('表单验证通过，配置值:', values);
      const isValid = await aiConfigService.testConfig(values);
      console.log('测试结果:', isValid);
      if (isValid) {
        message.success('配置测试成功');
      } else {
        message.error('配置测试失败');
      }
    } catch (error) {
      console.error('配置测试失败:', error);
      message.error('配置测试失败');
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
          temperature: 0.7,
          agentAutoRun: false,
          agentRiskLevel: 'low'
        }}
      >
        {/* 基础配置 */}
        <Card type="inner" title="基础配置">
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
            tooltip="API服务地址，例如：https://api.openai.com/v1"
            rules={[{ required: true, message: '请输入API基础URL' }]}
          >
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
        </Card>

        {/* Agent 模式配置 */}
        <Card type="inner" title="Agent 模式配置" className="agent-config-card">
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
            dependencies={['agentAutoRun']}
          >
            {({ getFieldValue }) => (
              <Form.Item
                name="agentRiskLevel"
                label="允许自动执行的最高风险等级"
                tooltip="只有低于或等于此风险等级的命令才会自动执行"
                rules={[
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!getFieldValue('agentAutoRun')) {
                        return Promise.resolve();
                      }
                      if (!value) {
                        return Promise.reject(new Error('请选择允许自动执行的最高风险等级'));
                      }
                      return Promise.resolve();
                    },
                  }),
                ]}
              >
                <Radio.Group disabled={!getFieldValue('agentAutoRun')}>
                  <Tooltip 
                    title={
                      <div>
                        查询类命令，如：
                        <ul>
                          <li>ls - 列出目录内容</li>
                          <li>ps - 查看进程</li>
                          <li>df - 查看磁盘空间</li>
                          <li>cat - 查看文件内容</li>
                          <li>pwd - 显示当前目录</li>
                        </ul>
                      </div>
                    }
                    placement="bottom"
                  >
                    <Radio.Button value="low">低风险 (?)</Radio.Button>
                  </Tooltip>
                  <Tooltip 
                    title={
                      <div>
                        修改类命令，如：
                        <ul>
                          <li>mkdir - 创建目录</li>
                          <li>touch - 创建文件</li>
                          <li>cp - 复制文件</li>
                          <li>mv - 移动文件</li>
                          <li>npm install - 安装依赖</li>
                        </ul>
                      </div>
                    }
                    placement="bottom"
                  >
                    <Radio.Button value="medium">中风险 (?)</Radio.Button>
                  </Tooltip>
                  <Tooltip 
                    title={
                      <div>
                        危险命令，如：
                        <ul>
                          <li>rm - 删除文件</li>
                          <li>chmod - 修改权限</li>
                          <li>chown - 修改所有者</li>
                          <li>sudo - 提权操作</li>
                          <li>reboot - 重启系统</li>
                        </ul>
                      </div>
                    }
                    placement="bottom"
                  >
                    <Radio.Button value="high">高风险 (?)</Radio.Button>
                  </Tooltip>
                </Radio.Group>
              </Form.Item>
            )}
          </Form.Item>
        </Card>

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