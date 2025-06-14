import React, { useState, useEffect } from 'react';
import {
  Modal,
  List,
  Button,
  Space,
  Typography,
  Radio,
  Switch,
  InputNumber,
  Input,
  message,
  Popconfirm,
  Tag,
  Divider
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined, 
  StarOutlined, 
  StarFilled,
  FolderOpenOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { unifiedEditorConfig } from '../config/UnifiedEditorConfig';
import { externalEditorManager } from '../core/ExternalEditorManager';
import { AddEditorDialog } from './AddEditorDialog';
import type { 
  EditorConfigDialogProps, 
  EditorConfig, 
  ExternalEditorSettings,
  OpenMode
} from '../types/ExternalEditorTypes';
import './EditorConfigDialog.css';

const { Text: AntText, Title } = Typography;

export const EditorConfigDialog: React.FC<EditorConfigDialogProps> = ({
  visible,
  onClose
}) => {
  const [editors, setEditors] = useState<EditorConfig[]>([]);
  const [settings, setSettings] = useState<ExternalEditorSettings>();
  const [addDialogVisible, setAddDialogVisible] = useState(false);
  const [editingEditor, setEditingEditor] = useState<EditorConfig | undefined>();
  const [loading, setLoading] = useState(false);

  // 加载配置数据
  useEffect(() => {
    if (visible) {
      loadConfig();
    }
  }, [visible]);

  const loadConfig = async () => {
    try {
      const editors = await unifiedEditorConfig.getEditors();
      const settings = await unifiedEditorConfig.getSettings();
      setEditors(editors);
      setSettings(settings);
    } catch (error) {
      console.error('[EditorConfigDialog] 加载配置失败:', error);
    }
  };

  // 添加编辑器
  const handleAddEditor = () => {
    setEditingEditor(undefined);
    setAddDialogVisible(true);
  };

  // 编辑编辑器
  const handleEditEditor = (editor: EditorConfig) => {
    setEditingEditor(editor);
    setAddDialogVisible(true);
  };

  // 删除编辑器
  const handleDeleteEditor = async (editorId: string) => {
    try {
      await unifiedEditorConfig.removeEditor(editorId);
      await loadConfig();
      message.success('编辑器已删除');
    } catch (error) {
      message.error('删除编辑器失败');
    }
  };

  // 设为默认编辑器
  const handleSetDefault = async (editorId: string) => {
    try {
      await unifiedEditorConfig.setDefaultEditor(editorId);
      await loadConfig();
      message.success('已设为默认编辑器');
    } catch (error) {
      message.error('设置默认编辑器失败');
    }
  };

  // 确认添加/编辑编辑器
  const handleEditorConfirm = async (editorData: Omit<EditorConfig, 'id' | 'addedTime'>) => {
    try {
      if (editingEditor) {
        // 编辑现有编辑器
        await unifiedEditorConfig.updateEditor(editingEditor.id, editorData);
        message.success('编辑器已更新');
      } else {
        // 添加新编辑器
        await unifiedEditorConfig.addEditor(
          editorData.name,
          editorData.executablePath,
          editorData.arguments,
          editorData.isDefault
        );
        message.success('编辑器已添加');
      }

      setAddDialogVisible(false);
      setEditingEditor(undefined);
      await loadConfig();
    } catch (error) {
      message.error('保存编辑器失败');
    }
  };

  // 取消添加/编辑编辑器
  const handleEditorCancel = () => {
    setAddDialogVisible(false);
    setEditingEditor(undefined);
  };

  // 更新设置
  const handleSettingChange = async (key: keyof ExternalEditorSettings, value: any) => {
    if (!settings) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    // 立即保存设置
    try {
      await unifiedEditorConfig.updateSettings({ [key]: value });
    } catch (error) {
      message.error('保存设置失败');
    }
  };

  // 选择临时目录
  const handleSelectTempDirectory = async () => {
    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('dialog:show-open-dialog', {
        properties: ['openDirectory'],
        title: '选择临时文件目录',
        defaultPath: settings?.tempDirectory
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        handleSettingChange('tempDirectory', selectedPath);
      }
    } catch (error) {
      console.error('选择目录失败:', error);
      message.error('选择目录失败');
    }
  };

  // 测试编辑器
  const handleTestEditor = async (editor: EditorConfig) => {
    try {
      setLoading(true);
      message.loading('正在测试编辑器启动...', 0);

      const success = await externalEditorManager.testEditorLaunch(editor);

      message.destroy();

      if (success) {
        message.success(`编辑器 ${editor.name} 启动测试成功`);
      } else {
        message.error(`编辑器 ${editor.name} 启动测试失败，请检查可执行文件路径`);
      }
    } catch (error) {
      message.destroy();
      message.error('测试编辑器失败');
    } finally {
      setLoading(false);
    }
  };

  // 渲染编辑器列表项
  const renderEditorItem = (editor: EditorConfig) => (
    <List.Item
      key={editor.id}
      actions={[
        <Button
          type="text"
          icon={editor.isDefault ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
          onClick={() => handleSetDefault(editor.id)}
          title={editor.isDefault ? '默认编辑器' : '设为默认'}
        />,
        <Button
          type="text"
          onClick={() => handleTestEditor(editor)}
          title="测试启动"
          loading={loading}
        >
          测试
        </Button>,
        <Button
          type="text"
          icon={<EditOutlined />}
          onClick={() => handleEditEditor(editor)}
          title="编辑"
        />,
        <Popconfirm
          title="确定要删除这个编辑器吗？"
          onConfirm={() => handleDeleteEditor(editor.id)}
          okText="删除"
          cancelText="取消"
        >
          <Button
            type="text"
            icon={<DeleteOutlined />}
            danger
            title="删除"
          />
        </Popconfirm>
      ]}
    >
      <List.Item.Meta
        title={
          <Space>
            <AntText strong>{editor.name}</AntText>
            {editor.isDefault && <Tag color="gold">默认</Tag>}
          </Space>
        }
        description={
          <div>
            <AntText type="secondary">{editor.executablePath}</AntText>
            {editor.arguments && (
              <div>
                <AntText type="secondary">参数: {editor.arguments}</AntText>
              </div>
            )}
          </div>
        }
      />
    </List.Item>
  );

  return (
    <>
      <Modal
        title={
          <Space>
            <SettingOutlined />
            <span>外部编辑器设置</span>
          </Space>
        }
        open={visible}
        onCancel={onClose}
        footer={[
          <Button key="close" onClick={onClose}>
            关闭
          </Button>
        ]}
        width={800}
        className="editor-config-dialog"
      >
        <div className="editor-config-content">
          {/* 编辑器列表 */}
          <div className="editor-list-section">
            <div className="section-header">
              <Title level={5}>已配置的编辑器</Title>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddEditor}
              >
                添加编辑器
              </Button>
            </div>
            
            <List
              dataSource={editors}
              renderItem={renderEditorItem}
              locale={{ emptyText: '暂无配置的编辑器' }}
              className="editor-list"
            />
          </div>

          <Divider />

          {/* 打开模式设置 */}
          <div className="settings-section">
            <Title level={5}>打开模式</Title>
            <Radio.Group
              value={settings?.openMode}
              onChange={(e) => handleSettingChange('openMode', e.target.value)}
            >
              <Space direction="vertical">
                <Radio value="ask">每次询问使用哪个编辑器</Radio>
                <Radio value="default">使用默认编辑器</Radio>
                <Radio value="remember">根据文件类型记住选择</Radio>
              </Space>
            </Radio.Group>
          </div>

          <Divider />

          {/* 文件监控设置 */}
          <div className="settings-section">
            <Title level={5}>文件监控设置</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div className="setting-item">
                <Space>
                  <Switch
                    checked={settings?.autoUpload}
                    onChange={(checked) => handleSettingChange('autoUpload', checked)}
                  />
                  <AntText>自动上传文件修改</AntText>
                </Space>
              </div>

              <div className="setting-item">
                <Space>
                  <AntText>上传延迟:</AntText>
                  <InputNumber
                    value={settings?.uploadDelay}
                    onChange={(value) => handleSettingChange('uploadDelay', value || 2000)}
                    min={500}
                    max={10000}
                    step={500}
                    addonAfter="毫秒"
                    style={{ width: 150 }}
                  />
                </Space>
                <div style={{ marginTop: 4 }}>
                  <AntText type="secondary" style={{ fontSize: '12px' }}>
                    文件保存后延迟多长时间自动上传，避免频繁上传
                  </AntText>
                </div>
              </div>

              <div className="setting-item">
                <Space>
                  <Switch
                    checked={settings?.rememberChoices}
                    onChange={(checked) => handleSettingChange('rememberChoices', checked)}
                  />
                  <AntText>记住文件类型的编辑器选择</AntText>
                </Space>
              </div>
            </Space>
          </div>

          <Divider />

          {/* 临时文件目录设置 */}
          <div className="settings-section">
            <Title level={5}>临时文件目录</Title>
            <Space style={{ width: '100%' }}>
              <Input
                value={settings?.tempDirectory}
                onChange={(e) => handleSettingChange('tempDirectory', e.target.value)}
                placeholder="临时文件存储目录"
                style={{ flex: 1 }}
              />
              <Button
                icon={<FolderOpenOutlined />}
                onClick={handleSelectTempDirectory}
              >
                浏览
              </Button>
            </Space>
            <div style={{ marginTop: 8 }}>
              <AntText type="secondary" style={{ fontSize: '12px' }}>
                远程文件将下载到此目录进行编辑
              </AntText>
            </div>
          </div>
        </div>
      </Modal>

      {/* 添加/编辑编辑器对话框 */}
      <AddEditorDialog
        visible={addDialogVisible}
        editingEditor={editingEditor}
        onConfirm={handleEditorConfirm}
        onCancel={handleEditorCancel}
      />
    </>
  );
};
