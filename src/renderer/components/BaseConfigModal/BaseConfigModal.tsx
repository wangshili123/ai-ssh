import React, { useState, useRef } from 'react';
import { Modal, Menu, Layout, Space, Button, message, Form } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { MonitorConfigContent } from './MonitorConfigContent';
import { AIConfigContent } from './AIConfigContent';
import { MonitorConfigManager } from '../../services/config/MonitorConfig';
import { AIConfigManager } from '../../services/config/AIConfig';
import './BaseConfigModal.css';
import { BaseConfig } from '@/renderer/services/config/BaseConfig';

const { Sider, Content } = Layout;

interface BaseConfigModalProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 基础配置弹框组件
 * 左侧是配置项菜单，右侧是具体配置内容
 */
export const BaseConfigModal: React.FC<BaseConfigModalProps> = ({
  visible,
  onClose,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>('monitor');
  const [monitorForm] = Form.useForm();
  const [aiForm] = Form.useForm();

  // 统一保存按钮的处理
  const handleSave = async () => {
    try {
      // 获取所有表单数据
      const monitorValues = await monitorForm.validateFields();
      const aiValues = await aiForm.validateFields();

      console.log('monitorValues', monitorValues);
      console.log('aiValues', aiValues);
      
      // 通过各自的 Manager 更新配置
      MonitorConfigManager.getInstance().saveConfig(monitorValues);
      AIConfigManager.getInstance().saveConfig(aiValues);

      // 统一保存
      BaseConfig.save();
      message.success('保存成功');
      onClose();
    } catch (error) {
      console.error('保存失败:', error);
      message.error('保存失败：表单验证未通过');
    }
  };

  return (
    <Modal
      title="基础配置"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            保存
          </Button>
        </Space>
      }
    >
      <Layout className="base-config-layout">
        <Sider width={200} theme="light">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            onSelect={({ key }) => setSelectedKey(key)}
            items={[
              {
                key: 'monitor',
                label: '监控配置'
              },
              {
                key: 'ai',
                label: 'AI配置'
              }
            ]}
          />
        </Sider>
        <Content className="base-config-content">
          <div style={{ display: selectedKey === 'monitor' ? 'block' : 'none' }}>
            <MonitorConfigContent form={monitorForm} />
          </div>
          <div style={{ display: selectedKey === 'ai' ? 'block' : 'none' }}>
            <AIConfigContent form={aiForm} />
          </div>
        </Content>
      </Layout>
    </Modal>
  );
}; 