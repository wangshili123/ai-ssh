# 权限设置功能实现计划

## 实现概述

基于现有的文件浏览器架构，添加权限设置功能。采用模块化设计，复用现有的SSH命令执行、状态管理和UI组件框架。

## 详细实现步骤

### 步骤1：创建权限操作服务 (permissionAction.ts)

#### 文件位置
```
src/renderer/components/FileBrowser/FileList/components/ContextMenu/actions/permissionAction.ts
```

#### 核心代码结构
```typescript
import { message } from 'antd';
import { sshService } from '../../../../../services/ssh';
import type { SessionInfo } from '../../../../../types';
import type { FileEntry } from '../../../../../../main/types/file';

interface PermissionOptions {
  files: FileEntry[];
  permissions: string;
  recursive?: boolean;
  sessionInfo: SessionInfo;
  currentPath: string;
  mode: 'octal' | 'symbolic';
}

interface PermissionResult {
  success: boolean;
  message: string;
  failedFiles?: string[];
}

export const permissionAction = {
  async setPermissions(options: PermissionOptions): Promise<PermissionResult> {
    // 实现chmod命令执行逻辑
  },
  
  validatePermissions(permissions: string, mode: 'octal' | 'symbolic'): boolean {
    // 验证权限格式
  },
  
  buildChmodCommand(files: FileEntry[], permissions: string, recursive: boolean): string {
    // 构建chmod命令
  }
};
```

#### 实现要点
- 使用sshService.executeCommandDirect执行chmod命令
- 支持八进制和符号两种权限格式
- 处理批量文件和递归操作
- 完善的错误处理和用户反馈

### 步骤2：创建权限设置对话框组件

#### 2.1 主对话框 (PermissionDialog.tsx)
```
src/renderer/components/FileBrowser/FileList/components/Permission/PermissionDialog.tsx
```

核心功能：
- 显示选中文件信息
- 权限编辑模式切换
- 高级选项设置
- 确认和取消操作

#### 2.2 八进制权限编辑器 (OctalPermissionEditor.tsx)
```
src/renderer/components/FileBrowser/FileList/components/Permission/OctalPermissionEditor.tsx
```

功能特性：
- 可视化权限复选框
- 实时计算八进制值
- 权限字符串预览

#### 2.3 符号权限编辑器 (SymbolicPermissionEditor.tsx)
```
src/renderer/components/FileBrowser/FileList/components/Permission/SymbolicPermissionEditor.tsx
```

功能特性：
- 符号权限输入框
- 权限语法验证
- 实时预览效果

#### 2.4 高级选项组件 (AdvancedOptions.tsx)
```
src/renderer/components/FileBrowser/FileList/components/Permission/AdvancedOptions.tsx
```

选项包括：
- 递归应用到子目录
- 仅应用到文件
- 仅应用到目录

### 步骤3：集成到FileList组件

#### 3.1 添加状态管理
在FileList.tsx中添加权限设置相关状态：
```typescript
// 权限设置对话框状态
const [permissionDialogVisible, setPermissionDialogVisible] = useState(false);
const [permissionFiles, setPermissionFiles] = useState<FileEntry[]>([]);
```

#### 3.2 添加回调处理函数
```typescript
// 权限设置请求处理
const handlePermissionRequest = useCallback((files: FileEntry[]) => {
  console.log('FileList: 收到权限设置请求', files.map(f => f.name));
  setPermissionFiles(files);
  setPermissionDialogVisible(true);
}, []);

// 权限设置确认处理
const handlePermissionConfirm = async (options: PermissionOptions) => {
  // 执行权限修改逻辑
};

// 权限设置取消处理
const handlePermissionCancel = () => {
  setPermissionDialogVisible(false);
};
```

#### 3.3 添加对话框组件
在FileList组件的render部分添加PermissionDialog组件。

### 步骤4：修改右键菜单

#### 4.1 更新FileListContextMenu.tsx
添加权限设置菜单项：
```typescript
// 在菜单项中添加权限设置选项
{
  key: 'permissions',
  label: selectedFiles.length > 1 ? `批量设置权限 (${selectedFiles.length}个文件)` : '设置权限',
  icon: <LockOutlined />,
  onClick: () => {
    onPermissionRequest?.(selectedFiles);
    onClose();
  }
}
```

#### 4.2 添加权限设置回调属性
在FileListContextMenu的Props中添加onPermissionRequest回调。

### 步骤5：样式设计

#### 5.1 创建样式文件
```
src/renderer/components/FileBrowser/FileList/components/Permission/PermissionDialog.css
```

#### 5.2 样式要点
- 权限表格的清晰布局
- 模式切换按钮的视觉反馈
- 高级选项的合理间距
- 响应式设计支持

### 步骤6：权限工具函数扩展

#### 6.1 扩展fileUtils.ts
添加权限相关的工具函数：
```typescript
// 八进制转权限对象
export function octalToPermissions(octal: string): PermissionSet

// 权限对象转八进制
export function permissionsToOctal(permissions: PermissionSet): string

// 权限对象转符号字符串
export function permissionsToSymbolic(permissions: PermissionSet): string

// 符号字符串转权限对象
export function symbolicToPermissions(symbolic: string): PermissionSet
```

## 实现顺序

### 第一阶段：核心功能 (1-2天)
1. 创建permissionAction服务
2. 实现基础PermissionDialog组件
3. 在FileList中添加基础回调处理
4. 在右键菜单中添加权限设置选项

### 第二阶段：界面完善 (1-2天)
1. 实现OctalPermissionEditor组件
2. 实现SymbolicPermissionEditor组件
3. 添加AdvancedOptions组件
4. 完善CSS样式设计

### 第三阶段：功能优化 (1天)
1. 添加权限验证逻辑
2. 完善错误处理机制
3. 添加操作确认对话框
4. 优化用户体验细节

## 技术要点

### SSH命令执行
- 使用sshService.executeCommandDirect执行chmod命令
- 处理命令执行的异步操作和错误
- 支持批量文件的命令组合

### 权限格式处理
- 八进制权限：755, 644等
- 符号权限：u+x, g-w, o=r等
- 权限验证和格式转换

### 状态管理
- 权限设置对话框的显示状态
- 选中文件的权限信息
- 编辑模式和选项的状态

### 错误处理
- SSH命令执行失败
- 权限格式验证失败
- 部分文件权限设置失败

## 测试策略

### 单元测试
- permissionAction服务的各个方法
- 权限格式验证函数
- 权限转换工具函数

### 集成测试
- 权限设置的完整流程
- 批量操作的正确性
- 错误情况的处理

### 用户测试
- 界面交互的直观性
- 权限设置的准确性
- 错误提示的清晰性

## 风险评估

### 技术风险
- SSH命令执行的稳定性
- 权限格式的兼容性
- 批量操作的性能

### 用户体验风险
- 权限概念的理解难度
- 操作流程的复杂性
- 错误恢复的困难

### 安全风险
- 权限设置的安全性
- 危险操作的防护
- 用户权限的验证

## 后续优化

### 功能扩展
- 权限模板功能
- 操作历史记录
- 权限继承设置

### 性能优化
- 批量操作的并发处理
- 权限信息的缓存
- 界面渲染的优化

### 用户体验
- 权限设置向导
- 常用权限快捷设置
- 权限变更的可视化反馈
