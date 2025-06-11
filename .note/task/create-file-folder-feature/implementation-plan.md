# 新建文件和文件夹功能实现计划

## 实现概述

基于现有的文件浏览器架构，添加新建文件和文件夹功能。采用模块化设计，复用现有的SSH命令执行、状态管理和UI组件框架。

## 详细实现步骤

### 步骤1：创建核心操作类 (createAction.ts)

#### 文件位置
```
src/renderer/components/FileBrowser/FileList/components/ContextMenu/actions/createAction.ts
```

#### 核心代码结构
```typescript
import { message } from 'antd';
import { sshService } from '../../../../../services/ssh';
import type { SessionInfo } from '../../../../../types';
import type { FileEntry } from '../../../../../../main/types/file';

interface CreateOptions {
  name: string;
  currentPath: string;
  sessionInfo: SessionInfo;
  type: 'file' | 'folder';
}

interface CreateResult {
  success: boolean;
  message: string;
  createdItem?: FileEntry;
}

class CreateAction {
  /**
   * 创建文件夹
   */
  async createFolder(options: CreateOptions): Promise<CreateResult> {
    const { name, currentPath, sessionInfo } = options;
    
    try {
      // 验证名称
      if (!this.validateName(name, 'folder')) {
        return { success: false, message: '文件夹名称不合法' };
      }

      // 构建完整路径
      const fullPath = this.buildFullPath(currentPath, name);
      
      // 检查是否已存在
      const exists = await this.checkNameExists(fullPath, sessionInfo);
      if (exists) {
        return { success: false, message: '文件夹已存在' };
      }

      // 执行创建命令
      const command = `mkdir -p "${fullPath}"`;
      await this.executeCreateCommand(command, sessionInfo);
      
      // 验证创建结果
      const verifyCommand = `ls -la "${fullPath}"`;
      await this.executeCreateCommand(verifyCommand, sessionInfo);

      message.success(`文件夹 "${name}" 创建成功`);
      return { success: true, message: '文件夹创建成功' };
      
    } catch (error) {
      console.error('[CreateAction] 创建文件夹失败:', error);
      const errorMsg = `创建文件夹失败: ${(error as Error).message}`;
      message.error(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * 创建文件
   */
  async createFile(options: CreateOptions): Promise<CreateResult> {
    const { name, currentPath, sessionInfo } = options;
    
    try {
      // 验证名称
      if (!this.validateName(name, 'file')) {
        return { success: false, message: '文件名不合法' };
      }

      // 构建完整路径
      const fullPath = this.buildFullPath(currentPath, name);
      
      // 检查是否已存在
      const exists = await this.checkNameExists(fullPath, sessionInfo);
      if (exists) {
        return { success: false, message: '文件已存在' };
      }

      // 执行创建命令
      const command = `touch "${fullPath}"`;
      await this.executeCreateCommand(command, sessionInfo);
      
      // 验证创建结果
      const verifyCommand = `ls -la "${fullPath}"`;
      await this.executeCreateCommand(verifyCommand, sessionInfo);

      message.success(`文件 "${name}" 创建成功`);
      return { success: true, message: '文件创建成功' };
      
    } catch (error) {
      console.error('[CreateAction] 创建文件失败:', error);
      const errorMsg = `创建文件失败: ${(error as Error).message}`;
      message.error(errorMsg);
      return { success: false, message: errorMsg };
    }
  }

  /**
   * 验证名称合法性
   */
  private validateName(name: string, type: 'file' | 'folder'): boolean {
    if (!name || name.trim() === '') {
      return false;
    }

    // 检查非法字符 (Linux/Unix 文件系统)
    const invalidChars = /[\/\0]/;
    if (invalidChars.test(name)) {
      return false;
    }

    // 检查特殊名称
    if (name === '.' || name === '..') {
      return false;
    }

    return true;
  }

  /**
   * 检查名称是否已存在
   */
  private async checkNameExists(fullPath: string, sessionInfo: SessionInfo): Promise<boolean> {
    try {
      const command = `test -e "${fullPath}" && echo "exists" || echo "not_exists"`;
      const result = await this.executeCreateCommand(command, sessionInfo);
      return result.trim().includes('exists');
    } catch (error) {
      // 如果命令执行失败，假设不存在
      return false;
    }
  }

  /**
   * 构建完整路径
   */
  private buildFullPath(currentPath: string, name: string): string {
    const normalizedPath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
    return `${normalizedPath}${name}`.replace(/\/+/g, '/');
  }

  /**
   * 执行SSH创建命令
   */
  private async executeCreateCommand(command: string, sessionInfo: SessionInfo): Promise<string> {
    try {
      console.log(`[CreateAction] 执行创建命令: ${command}`);
      const result = await sshService.executeCommandDirect(sessionInfo.id, command);
      console.log(`[CreateAction] 命令执行结果:`, result);
      return result;
    } catch (error) {
      console.error(`[CreateAction] 命令执行失败:`, error);
      throw error;
    }
  }
}

// 导出单例实例
export const createAction = new CreateAction();
```

### 步骤2：创建对话框组件 (CreateDialog.tsx)

#### 文件位置
```
src/renderer/components/FileBrowser/FileList/components/ContextMenu/CreateDialog.tsx
```

#### 核心代码结构
```typescript
import React, { useState, useEffect } from 'react';
import { Modal, Input, Form, message } from 'antd';
import type { FormInstance } from 'antd/es/form';

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

      setLoading(true);
      await onConfirm(name);
      form.resetFields();
    } catch (error) {
      console.error('创建失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  const validateName = (_: any, value: string) => {
    if (!value || value.trim() === '') {
      return Promise.reject(new Error('名称不能为空'));
    }

    // 检查非法字符
    const invalidChars = /[\/\0]/;
    if (invalidChars.test(value)) {
      return Promise.reject(new Error('名称不能包含 / 或空字符'));
    }

    // 检查特殊名称
    if (value === '.' || value === '..') {
      return Promise.reject(new Error('不能使用 . 或 .. 作为名称'));
    }

    return Promise.resolve();
  };

  const title = type === 'folder' ? '新建文件夹' : '新建文件';
  const placeholder = type === 'folder' ? '请输入文件夹名称' : '请输入文件名（包含扩展名）';

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
    >
      <div style={{ marginBottom: 16 }}>
        <span style={{ color: '#666' }}>当前路径：{currentPath}</span>
      </div>
      
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={type === 'folder' ? '文件夹名称' : '文件名'}
          rules={[{ validator: validateName }]}
        >
          <Input
            className="create-dialog-input"
            placeholder={placeholder}
            autoFocus
            onPressEnter={handleConfirm}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
```

### 步骤3：扩展右键菜单

#### 修改文件
```
src/renderer/components/FileBrowser/FileList/components/ContextMenu/FileListContextMenu.tsx
```

#### 主要修改点
1. 导入CreateDialog和createAction
2. 添加对话框状态管理
3. 在menuItems中添加新建选项
4. 添加创建操作的处理函数

### 步骤4：集成到文件列表

#### 修改文件
```
src/renderer/components/FileBrowser/FileList/FileList.tsx
```

#### 主要修改点
1. 添加创建完成后的回调处理
2. 实现文件列表刷新逻辑
3. 添加新项目高亮显示

### 步骤5：样式和用户体验优化

#### 创建样式文件
```
src/renderer/components/FileBrowser/FileList/components/ContextMenu/CreateDialog.css
```

#### 样式内容
```css
.create-dialog-input .ant-input {
  font-size: 14px;
}

.create-dialog-input .ant-input:focus {
  border-color: #1890ff;
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}
```

## 测试计划

### 功能测试用例
1. **创建文件夹测试**
   - 正常创建：输入合法名称，验证创建成功
   - 重名测试：创建已存在的文件夹名称
   - 非法字符测试：输入包含 / 等非法字符
   - 空名称测试：输入空字符串或只有空格

2. **创建文件测试**
   - 正常创建：输入合法文件名，验证创建成功
   - 不同扩展名：测试 .txt, .sh, .json 等不同类型
   - 无扩展名：测试创建无扩展名的文件
   - 重名测试：创建已存在的文件名

3. **权限测试**
   - 只读目录：在只读目录尝试创建
   - 权限不足：在需要特殊权限的目录创建

### 用户体验测试
1. **操作流程**：右键 → 选择新建 → 输入名称 → 确认创建
2. **响应速度**：创建操作的响应时间应在2秒内
3. **错误反馈**：各种错误场景的用户提示清晰明确
4. **界面反馈**：创建成功后文件列表自动刷新并高亮新项目

## 部署和发布

### 代码审查要点
1. 错误处理是否完善
2. 用户输入验证是否充分
3. SSH命令是否安全（防止命令注入）
4. 状态管理是否正确

### 发布准备
1. 更新README.md，添加新功能说明
2. 更新版本号
3. 准备发布说明文档
