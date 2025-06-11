/**
 * 新建文件和文件夹对话框组件
 */

import React, { useState, useEffect } from 'react';
import { Modal, Input, Form, message } from 'antd';
import './CreateDialog.css';

interface CreateDialogProps {
  visible: boolean;
  type: 'file' | 'folder';
  currentPath: string;
  onConfirm: (name: string) => Promise<void>;
  onCancel: () => void;
}

export const CreateDialog: React.FC<CreateDialogProps> = ({
  visible,
  type,
  currentPath,
  onConfirm,
  onCancel
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  // 重置表单当对话框显示时
  useEffect(() => {
    if (visible) {
      const defaultName = type === 'folder' ? '新建文件夹' : '新建文件.txt';
      form.setFieldsValue({ name: defaultName });
      
      // 延迟选中文本，确保输入框已渲染
      setTimeout(() => {
        const input = document.querySelector('.create-dialog-input input') as HTMLInputElement;
        if (input) {
          input.select();
          input.focus();
        }
      }, 100);
    }
  }, [visible, type, form]);

  const handleConfirm = async () => {
    try {
      const values = await form.validateFields();
      const name = values.name.trim();
      
      if (!name) {
        message.error('名称不能为空');
        return;
      }

      console.log('[CreateDialog] 确认创建:', { type, name, currentPath });
      setLoading(true);
      
      await onConfirm(name);
      
      // 创建成功后关闭对话框
      form.resetFields();
      setLoading(false);
      
    } catch (error) {
      console.error('[CreateDialog] 创建失败:', error);
      setLoading(false);
      // 不关闭对话框，让用户可以修改后重试
    }
  };

  const handleCancel = () => {
    console.log('[CreateDialog] 取消创建');
    form.resetFields();
    setLoading(false);
    onCancel();
  };

  const validateName = (_: any, value: string) => {
    if (!value || value.trim() === '') {
      return Promise.reject(new Error('名称不能为空'));
    }

    const trimmedValue = value.trim();

    // 检查非法字符
    const invalidChars = /[\/\0]/;
    if (invalidChars.test(trimmedValue)) {
      return Promise.reject(new Error('名称不能包含 / 或空字符'));
    }

    // 检查特殊名称
    if (trimmedValue === '.' || trimmedValue === '..') {
      return Promise.reject(new Error('不能使用 . 或 .. 作为名称'));
    }

    // 检查名称长度
    if (trimmedValue.length > 255) {
      return Promise.reject(new Error('名称长度不能超过255个字符'));
    }

    // 检查是否以点开头（隐藏文件）
    if (trimmedValue.startsWith('.') && trimmedValue.length > 1) {
      // 允许隐藏文件，但给出提示
      console.log('[CreateDialog] 创建隐藏文件/文件夹:', trimmedValue);
    }

    return Promise.resolve();
  };

  const title = type === 'folder' ? '新建文件夹' : '新建文件';
  const placeholder = type === 'folder' 
    ? '请输入文件夹名称' 
    : '请输入文件名（包含扩展名，如：document.txt）';
  const label = type === 'folder' ? '文件夹名称' : '文件名';

  return (
    <Modal
      title={title}
      open={visible}
      onOk={handleConfirm}
      onCancel={handleCancel}
      confirmLoading={loading}
      okText="创建"
      cancelText="取消"
      destroyOnClose
      width={480}
      className="create-dialog"
    >
      <div className="create-dialog-path">
        <span className="create-dialog-path-label">当前路径：</span>
        <span className="create-dialog-path-value">{currentPath}</span>
      </div>
      
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={label}
          rules={[{ validator: validateName }]}
        >
          <Input
            className="create-dialog-input"
            placeholder={placeholder}
            autoFocus
            onPressEnter={handleConfirm}
            disabled={loading}
          />
        </Form.Item>
      </Form>

      {type === 'file' && (
        <div className="create-dialog-tips">
          <div className="create-dialog-tips-title">提示：</div>
          <ul className="create-dialog-tips-list">
            <li>请包含文件扩展名，如：document.txt、script.sh、config.json</li>
            <li>不包含扩展名将创建无类型文件</li>
            <li>以点(.)开头将创建隐藏文件</li>
          </ul>
        </div>
      )}

      {type === 'folder' && (
        <div className="create-dialog-tips">
          <div className="create-dialog-tips-title">提示：</div>
          <ul className="create-dialog-tips-list">
            <li>文件夹名称不能包含特殊字符：/ 等</li>
            <li>以点(.)开头将创建隐藏文件夹</li>
          </ul>
        </div>
      )}
    </Modal>
  );
};
