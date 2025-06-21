import React, { useState, useRef } from 'react';
import { Modal, Menu, Layout, Space, Button, message, Form } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { MonitorConfigContent } from './MonitorConfigContent';
import { AIConfigContent } from './AIConfigContent';
import { TerminalShortcutConfigContent } from './TerminalShortcutConfigContent';
import { ConnectionMonitorContent } from './ConnectionMonitorContent';
import { MonitorConfigManager } from '../../services/config/MonitorConfig';
import { AIConfigManager } from '../../services/config/AIConfig';
import { TerminalShortcutConfigManager } from '../../services/config/TerminalShortcutConfig';
import { uiSettingsManager } from '../../services/UISettingsManager';
import './BaseConfigModal.css';

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
  const [terminalShortcutForm] = Form.useForm();

  // 统一保存按钮的处理
  const handleSave = async () => {
    // 连接监控页面不需要保存
    if (selectedKey === 'connectionMonitor') {
      onClose();
      return;
    }

    try {
      // 获取所有表单数据
      const monitorValues = await monitorForm.validateFields();
      const aiValues = await aiForm.validateFields();
      const terminalShortcutValues = await terminalShortcutForm.validateFields();

      console.log('monitorValues', monitorValues);
      console.log('aiValues', aiValues);
      console.log('terminalShortcutValues', terminalShortcutValues);

      // 通过各自的 Manager 更新配置（现在都是异步的）
      await MonitorConfigManager.getInstance().saveConfig(monitorValues);
      await AIConfigManager.getInstance().saveConfig(aiValues);
      await TerminalShortcutConfigManager.getInstance().saveConfig(terminalShortcutValues);

      // 使用 uiSettingsManager 保存基础配置
      // 只更新 baseConfig 部分，不影响其他设置
      await uiSettingsManager.updateSettings({
        baseConfig: {
          monitor: monitorValues,
          ai: aiValues,
          terminalShortcuts: terminalShortcutValues
        }
      });

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
      height={600}
      styles={{
        body: {
          height: '500px',
          padding: 0
        }
      }}
      footer={
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            {selectedKey === 'connectionMonitor' ? '关闭' : '保存'}
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
              },
              {
                key: 'terminalShortcuts',
                label: '终端快捷键'
              },
              {
                key: 'connectionMonitor',
                label: '连接监控'
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
          <div style={{ display: selectedKey === 'terminalShortcuts' ? 'block' : 'none' }}>
            <TerminalShortcutConfigContent form={terminalShortcutForm} />
          </div>
          <div style={{ display: selectedKey === 'connectionMonitor' ? 'block' : 'none' }}>
            <ConnectionMonitorContent />
          </div>
        </Content>
      </Layout>
    </Modal>
  );
}; 