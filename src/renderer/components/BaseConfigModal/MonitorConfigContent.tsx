import React, { useEffect, forwardRef } from 'react';
import { Form, InputNumber, Select, Checkbox } from 'antd';
import type { FormInstance } from 'antd/es/form';
import type { MonitorConfig } from '../../types/baseconfig/BaseConfigType';
import { MonitorConfigManager } from '../../services/config/MonitorConfig';

interface MonitorConfigContentProps {
  form: FormInstance;
}

/**
 * 监控配置内容组件
 */
export const MonitorConfigContent = forwardRef<FormInstance, MonitorConfigContentProps>(({ form }, ref) => {
  const configManager = MonitorConfigManager.getInstance();

  // 加载配置
  useEffect(() => {
    const config = configManager.getConfig();
    form.setFieldsValue(config);
  }, [form]);

  // 处理表单提交
  const handleValuesChange = (_: any, values: MonitorConfig) => {
    configManager.saveConfig(values);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleValuesChange}
      initialValues={{
        refreshInterval: 5,
        autoRefresh: true,
        defaultPage: 'performance',
        collectServiceInfo: false,
        recordHistory: false,
        enableCache: true,
        cacheExpiration: 30
      }}
    >
      <Form.Item
        name="defaultPage"
        label="默认页面"
      >
        <Select>
          <Select.Option value="process">进程</Select.Option>
          <Select.Option value="performance">性能</Select.Option>
          <Select.Option value="history">应用历史记录</Select.Option>
          <Select.Option value="startup">启动</Select.Option>
          <Select.Option value="user">用户</Select.Option>
          <Select.Option value="detail">详细信息</Select.Option>
          <Select.Option value="service">服务</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="refreshInterval"
        label="刷新间隔(秒)"
        rules={[
          { required: true, message: '请输入刷新间隔' },
          { type: 'number', message: '请输入有效的数字' }
        ]}
      >
        <InputNumber
          min={3}
          max={3600}
          defaultValue={5}
          style={{ width: '100%' }}
          controls={false}
          type="number"
          precision={0}
        />
      </Form.Item>


      <Form.Item
        name="enableCache"
        valuePropName="checked"
      >
        <Checkbox>启用缓存</Checkbox>
      </Form.Item>

      <Form.Item
        name="cacheExpiration"
        label="缓存过期时间(秒)"
        rules={[{ required: true, message: '请输入缓存过期时间' }]}
      >
        <InputNumber min={5} max={3600} style={{ width: '100%' }}  controls={false}
          type="number"/>
      </Form.Item>
    </Form>
  );
}); 