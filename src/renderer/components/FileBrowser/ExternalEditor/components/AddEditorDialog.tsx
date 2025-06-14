import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Space,
  Switch,
  message,
  Alert,
  Typography
} from 'antd';
import { FolderOpenOutlined, PlusOutlined, EditOutlined } from '@ant-design/icons';
import { unifiedEditorConfig } from '../config/UnifiedEditorConfig';
import type {
  AddEditorDialogProps,
  EditorConfig,
  EditorValidationResult
} from '../types/ExternalEditorTypes';

const { Text: AntText } = Typography;

export const AddEditorDialog: React.FC<AddEditorDialogProps> = ({
  visible,
  editingEditor,
  onConfirm,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [validation, setValidation] = useState<EditorValidationResult | null>(null);

  const isEditing = !!editingEditor;

  // 初始化表单数据
  useEffect(() => {
    if (visible) {
      if (editingEditor) {
        form.setFieldsValue({
          name: editingEditor.name,
          executablePath: editingEditor.executablePath,
          arguments: editingEditor.arguments || '',
          isDefault: editingEditor.isDefault || false
        });
      } else {
        form.resetFields();
      }
      setValidation(null);
    }
  }, [visible, editingEditor, form]);

  // 选择可执行文件
  const handleSelectExecutable = async () => {
    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('dialog:show-open-dialog', {
        properties: ['openFile'],
        title: '选择编辑器可执行文件',
        filters: [
          { name: '可执行文件', extensions: ['exe'] },
          { name: '所有文件', extensions: ['*'] }
        ]
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const selectedPath = result.filePaths[0];
        form.setFieldValue('executablePath', selectedPath);

        // 如果名称为空，尝试从文件名推断编辑器名称
        const currentName = form.getFieldValue('name');
        if (!currentName) {
          const fileName = selectedPath.split('\\').pop()?.replace('.exe', '') || '';
          const editorName = formatEditorName(fileName);
          form.setFieldValue('name', editorName);
        }
      }
    } catch (error) {
      console.error('选择文件失败:', error);
      message.error('选择文件失败');
    }
  };

  // 格式化编辑器名称
  const formatEditorName = (fileName: string): string => {
    // 常见编辑器名称映射
    const nameMap: { [key: string]: string } = {
      'code': 'Visual Studio Code',
      'notepad++': 'Notepad++',
      'notepad': '记事本',
      'sublime_text': 'Sublime Text',
      'atom': 'Atom',
      'vim': 'Vim',
      'gvim': 'GVim',
      'emacs': 'Emacs',
      'nano': 'Nano'
    };
    
    const lowerName = fileName.toLowerCase();
    return nameMap[lowerName] || fileName;
  };

  // 验证表单
  const validateForm = async (values: any): Promise<EditorValidationResult> => {
    const editorData = {
      ...values,
      id: editingEditor?.id
    };
    
    return await unifiedEditorConfig.validateEditor(editorData);
  };

  // 处理表单提交
  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      const values = await form.validateFields();
      
      // 验证编辑器配置
      const validationResult = await validateForm(values);
      setValidation(validationResult);
      
      if (!validationResult.valid) {
        return;
      }
      
      // 构建编辑器配置
      const editorConfig: Omit<EditorConfig, 'id' | 'addedTime'> = {
        name: values.name.trim(),
        executablePath: values.executablePath.trim(),
        arguments: values.arguments?.trim() || undefined,
        isDefault: values.isDefault || false
      };
      
      onConfirm(editorConfig);
      
    } catch (error) {
      console.error('表单验证失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 快速配置编辑器
  const handleQuickConfig = (editorType: string) => {
    const configs = {
      notepad: {
        name: '记事本',
        executablePath: 'C:\\Windows\\System32\\notepad.exe',
        arguments: ''
      },
      vscode: {
        name: 'Visual Studio Code',
        executablePath: 'C:\\Program Files\\Microsoft VS Code\\Code.exe',
        arguments: '-n'
      },
      notepadpp: {
        name: 'Notepad++',
        executablePath: 'C:\\Program Files\\Notepad++\\notepad++.exe',
        arguments: ''
      },
      sublime: {
        name: 'Sublime Text',
        executablePath: 'C:\\Program Files\\Sublime Text\\sublime_text.exe',
        arguments: ''
      }
    };

    const config = configs[editorType as keyof typeof configs];
    if (config) {
      console.log('[AddEditorDialog] 快速配置:', config);
      form.setFieldsValue(config);

      // 验证设置是否成功
      setTimeout(() => {
        const currentValues = form.getFieldsValue();
        console.log('[AddEditorDialog] 当前表单值:', currentValues);
      }, 100);

      // 为VS Code提供额外的路径提示
      if (editorType === 'vscode') {
        message.info({
          content: (
            <div>
              <p>已配置 VS Code，常见安装路径：</p>
              <p>• C:\\Program Files\\Microsoft VS Code\\Code.exe</p>
              <p>• C:\\Users\\[用户名]\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe</p>
              <p>请根据实际安装路径调整</p>
            </div>
          ),
          duration: 8
        });
      } else {
        message.success(`已配置 ${config.name}，请根据实际安装路径调整可执行文件路径`);
      }
    }
  };

  // 处理取消
  const handleCancel = () => {
    form.resetFields();
    setValidation(null);
    onCancel();
  };

  return (
    <Modal
      title={
        <Space>
          {isEditing ? <EditOutlined /> : <PlusOutlined />}
          <span>{isEditing ? '编辑编辑器' : '添加编辑器'}</span>
        </Space>
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText={isEditing ? '保存' : '添加'}
      cancelText="取消"
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
      >
        {/* 验证结果显示 */}
        {validation && !validation.valid && (
          <Alert
            message="配置验证失败"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validation.errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            }
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        
        {validation && validation.warnings.length > 0 && (
          <Alert
            message="注意事项"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {validation.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {/* 编辑器名称 */}
        <Form.Item
          label="编辑器名称"
          name="name"
          rules={[
            { required: true, message: '请输入编辑器名称' },
            { max: 50, message: '名称不能超过50个字符' }
          ]}
        >
          <Input 
            placeholder="例如: Visual Studio Code"
            autoComplete="off"
          />
        </Form.Item>

        {/* 可执行文件路径 */}
        <Form.Item
          label="可执行文件路径"
          name="executablePath"
          rules={[
            { required: true, message: '请选择可执行文件' }
          ]}
        >
          <Input
            placeholder="选择编辑器的可执行文件"
            addonAfter={
              <Button
                type="text"
                icon={<FolderOpenOutlined />}
                onClick={handleSelectExecutable}
                style={{ border: 'none', padding: '0 8px' }}
                title="浏览选择文件"
              >
                浏览
              </Button>
            }
          />
        </Form.Item>

        {/* 启动参数 */}
        <Form.Item
          label="启动参数 (可选)"
          name="arguments"
        >
          <Input 
            placeholder="例如: -n (新窗口打开)"
            autoComplete="off"
          />
          <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
            常用参数: -n (新窗口), --wait (等待关闭), -g (跳转到行号)
          </div>
        </Form.Item>

        {/* 设为默认 */}
        <Form.Item
          name="isDefault"
          valuePropName="checked"
        >
          <Space>
            <Switch />
            <span>设为默认编辑器</span>
          </Space>
        </Form.Item>

        {/* 快速配置按钮 */}
        <div style={{ marginBottom: 16 }}>
          <AntText strong>快速配置常用编辑器：</AntText>
          <div style={{ marginTop: 4, marginBottom: 8 }}>
            <AntText type="secondary" style={{ fontSize: '12px' }}>
              点击下方按钮自动填写配置，然后根据实际安装路径调整
            </AntText>
          </div>
          <div>
            <Space wrap>
              <Button size="small" onClick={() => handleQuickConfig('notepad')}>
                记事本
              </Button>
              <Button size="small" onClick={() => handleQuickConfig('vscode')}>
                VS Code
              </Button>
              <Button size="small" onClick={() => handleQuickConfig('notepadpp')}>
                Notepad++
              </Button>
              <Button size="small" onClick={() => handleQuickConfig('sublime')}>
                Sublime Text
              </Button>
            </Space>
          </div>
        </div>

        {/* 使用说明 */}
        <Alert
          message="使用说明"
          description={
            <div style={{ fontSize: '12px' }}>
              <p><strong>配置步骤：</strong></p>
              <p>1. 点击上方快速配置按钮，或手动输入编辑器信息</p>
              <p>2. 确认可执行文件路径正确（必须是完整路径）</p>
              <p>3. 可选择设置启动参数和默认编辑器</p>
              <p>4. 点击"测试"按钮验证配置是否正确</p>
              <p><strong>注意：</strong>文件将自动下载到本地临时目录，编辑保存后会自动上传到服务器</p>
            </div>
          }
          type="info"
          showIcon
        />
      </Form>
    </Modal>
  );
};
