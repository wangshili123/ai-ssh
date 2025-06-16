import React, { useEffect } from 'react';
import { Form, Card, Button, Space, Row, Col, Divider } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { TerminalShortcutConfigManager } from '../../services/config/TerminalShortcutConfig';
import { ShortcutInput } from './ShortcutInput';
import type { TerminalShortcutConfig } from '../../types/baseconfig/BaseConfigType';

interface TerminalShortcutConfigContentProps {
  form: FormInstance;
}

/**
 * 终端快捷键配置内容组件
 */
export const TerminalShortcutConfigContent: React.FC<TerminalShortcutConfigContentProps> = ({
  form,
}) => {
  const configManager = TerminalShortcutConfigManager.getInstance();

  useEffect(() => {
    // 初始化表单数据
    const loadConfig = async () => {
      try {
        const config = await configManager.getConfig();
        form.setFieldsValue(config);
      } catch (error) {
        console.error('加载终端快捷键配置失败:', error);
        // 如果加载失败，设置默认值
        const defaultConfig = {
          acceptCompletion: 'Ctrl+Tab',
          acceptCompletionAlt: 'Alt+/',
          clearCompletion: 'Escape',
          navigateUp: 'Alt+ArrowUp',
          navigateDown: 'Alt+ArrowDown',
          copy: 'Ctrl+Shift+C',
          paste: 'Ctrl+Shift+V',
          clear: 'Ctrl+Shift+L',
          search: 'Ctrl+Shift+F'
        };
        form.setFieldsValue(defaultConfig);
      }
    };
    loadConfig();
  }, [form, configManager]);

  // 重置为默认配置
  const handleResetToDefault = async () => {
    try {
      configManager.resetToDefault();
      const defaultConfig = await configManager.getConfig();
      form.setFieldsValue(defaultConfig);
    } catch (error) {
      console.error('重置默认配置失败:', error);
    }
  };

  // 快捷键输入框的验证规则
  const shortcutValidator = (_: any, value: string) => {
    if (!value) {
      return Promise.reject(new Error('请输入快捷键'));
    }
    return Promise.resolve();
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        acceptCompletion: 'Ctrl+Tab',
        acceptCompletionAlt: 'Alt+/',
        clearCompletion: 'Escape',
        navigateUp: 'Alt+ArrowUp',
        navigateDown: 'Alt+ArrowDown',
        copy: 'Ctrl+Shift+C',
        paste: 'Ctrl+Shift+V',
        clear: 'Ctrl+Shift+L',
        search: 'Ctrl+Shift+F'
      }}
      size="small"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* 智能补全快捷键区域 */}
        <Card
          type="inner"
          title="智能补全"
          size="small"
          extra={
            <Button size="small" onClick={handleResetToDefault}>
              重置默认
            </Button>
          }
        >
          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Form.Item
                name="acceptCompletion"
                label="接受补全"
                rules={[{ validator: shortcutValidator }]}
                style={{ marginBottom: 8 }}
              >
                <ShortcutInput placeholder="Ctrl+Tab" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="acceptCompletionAlt"
                label="备用接受"
                rules={[{ validator: shortcutValidator }]}
                style={{ marginBottom: 8 }}
              >
                <ShortcutInput placeholder="Alt+/" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="clearCompletion"
                label="清除补全"
                rules={[{ validator: shortcutValidator }]}
                style={{ marginBottom: 8 }}
              >
                <ShortcutInput placeholder="Escape" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="navigateUp"
                label="向上导航"
                rules={[{ validator: shortcutValidator }]}
                style={{ marginBottom: 8 }}
              >
                <ShortcutInput placeholder="Alt+ArrowUp" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="navigateDown"
                label="向下导航"
                rules={[{ validator: shortcutValidator }]}
                style={{ marginBottom: 0 }}
              >
                <ShortcutInput placeholder="Alt+ArrowDown" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* 终端操作快捷键区域 */}
        <Card
          type="inner"
          title="终端操作"
          size="small"
        >
          <Row gutter={[16, 8]}>
            <Col span={12}>
              <Form.Item
                name="copy"
                label="复制"
                rules={[{ validator: shortcutValidator }]}
                style={{ marginBottom: 8 }}
              >
                <ShortcutInput placeholder="Ctrl+Shift+C" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="paste"
                label="粘贴"
                rules={[{ validator: shortcutValidator }]}
                style={{ marginBottom: 8 }}
              >
                <ShortcutInput placeholder="Ctrl+Shift+V" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="clear"
                label="清空终端"
                rules={[{ validator: shortcutValidator }]}
                style={{ marginBottom: 8 }}
              >
                <ShortcutInput placeholder="Ctrl+Shift+L" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="search"
                label="搜索"
                rules={[{ validator: shortcutValidator }]}
                style={{ marginBottom: 0 }}
              >
                <ShortcutInput placeholder="Ctrl+Shift+F" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Space>
    </Form>
  );
};
