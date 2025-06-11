# 新建文件和文件夹功能设计方案

## 项目概述

为AI SSH Tool的文件浏览器添加新建文件和新建文件夹功能，提供简洁直观的用户体验。

## 功能需求

### 核心功能
1. **新建文件夹**：在当前目录创建新文件夹
2. **新建文件**：在当前目录创建新文件，用户可自定义文件名和扩展名

### 用户交互设计
- **触发方式**：右键菜单中添加"新建文件夹"和"新建文件"选项
- **输入方式**：弹出对话框让用户输入名称
- **反馈机制**：创建成功后自动刷新文件列表并高亮新项目

## 技术实现方案

### 1. 组件架构

```
FileListContextMenu (扩展)
├── CreateDialog (新增)
│   ├── CreateFolderDialog
│   └── CreateFileDialog
└── CreateAction (新增)
    ├── createFolder()
    └── createFile()
```

### 2. 核心组件设计

#### 2.1 CreateAction类
```typescript
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
  // 创建文件夹
  async createFolder(options: CreateOptions): Promise<CreateResult>
  
  // 创建文件
  async createFile(options: CreateOptions): Promise<CreateResult>
  
  // 验证名称合法性
  private validateName(name: string, type: 'file' | 'folder'): boolean
  
  // 检查是否重名
  private async checkNameExists(path: string, name: string): Promise<boolean>
  
  // 执行SSH命令
  private async executeCreateCommand(command: string, sessionInfo: SessionInfo): Promise<string>
}
```

#### 2.2 CreateDialog组件
```typescript
interface CreateDialogProps {
  visible: boolean;
  type: 'file' | 'folder';
  currentPath: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

// 统一的创建对话框组件
const CreateDialog: React.FC<CreateDialogProps>
```

### 3. SSH命令设计

#### 3.1 创建文件夹命令
```bash
# 创建文件夹
mkdir -p "/current/path/folder_name"

# 验证创建结果
ls -la "/current/path/folder_name"
```

#### 3.2 创建文件命令
```bash
# 创建空文件
touch "/current/path/file_name.ext"

# 验证创建结果
ls -la "/current/path/file_name.ext"
```

### 4. 实现步骤

#### 步骤1：创建核心操作类
- 文件：`src/renderer/components/FileBrowser/FileList/components/ContextMenu/actions/createAction.ts`
- 实现文件夹和文件创建逻辑
- 添加名称验证和重名检查

#### 步骤2：创建对话框组件
- 文件：`src/renderer/components/FileBrowser/FileList/components/ContextMenu/CreateDialog.tsx`
- 实现输入对话框UI
- 添加表单验证和用户反馈

#### 步骤3：扩展右键菜单
- 修改：`FileListContextMenu.tsx`
- 添加"新建文件夹"和"新建文件"菜单项
- 集成创建对话框

#### 步骤4：集成到文件列表
- 修改：`FileList.tsx`
- 添加创建完成后的刷新逻辑
- 实现新项目高亮显示

#### 步骤5：错误处理和用户反馈
- 添加创建失败的错误提示
- 实现重名冲突处理
- 添加创建成功的消息提示

### 5. 用户体验设计

#### 5.1 菜单结构
```
右键菜单
├── 新建文件夹
├── 新建文件
├── ─────────
├── 下载
├── 上传
├── ─────────
├── 删除
└── ...
```

#### 5.2 对话框设计
- **新建文件夹**：
  - 标题："新建文件夹"
  - 输入框：文件夹名称
  - 默认值："新建文件夹"
  - 验证：不能为空，不能包含特殊字符

- **新建文件**：
  - 标题："新建文件"
  - 输入框：文件名（包含扩展名）
  - 默认值："新建文件.txt"
  - 验证：不能为空，不能包含特殊字符

#### 5.3 反馈机制
- 创建成功：显示成功消息，自动刷新列表，高亮新项目
- 创建失败：显示错误消息，保持对话框打开
- 重名冲突：提示用户修改名称或自动添加序号

### 6. 错误处理

#### 6.1 常见错误场景
- 权限不足：无法在当前目录创建
- 重名冲突：文件/文件夹已存在
- 非法字符：名称包含系统不支持的字符
- 网络问题：SSH连接中断

#### 6.2 错误处理策略
- 权限错误：提示用户检查目录权限
- 重名冲突：建议修改名称或自动添加序号
- 非法字符：实时验证并提示合法字符范围
- 网络错误：提示重试或检查连接状态

### 7. 测试计划

#### 7.1 功能测试
- 创建文件夹：各种名称格式测试
- 创建文件：各种文件类型测试
- 重名处理：重复名称冲突测试
- 权限测试：不同权限目录测试

#### 7.2 用户体验测试
- 操作流程：右键菜单到创建完成的完整流程
- 响应速度：创建操作的响应时间
- 错误反馈：各种错误场景的用户提示

## 开发时间估算

- **设计阶段**：0.5天（已完成）
- **核心功能开发**：1天
- **UI组件开发**：0.5天
- **集成测试**：0.5天
- **总计**：2.5天

## 风险评估

### 技术风险
- **低风险**：基于现有的SSH命令执行和文件操作框架
- **依赖稳定**：复用已验证的SFTP连接管理和状态更新机制

### 用户体验风险
- **中等风险**：需要确保创建操作的响应速度
- **缓解措施**：添加加载状态和进度反馈

## 后续扩展

### 可能的功能增强
1. **模板支持**：预定义文件模板（如脚本模板、配置文件模板）
2. **批量创建**：支持一次创建多个文件/文件夹
3. **智能命名**：基于当前目录内容智能建议名称
4. **快捷键支持**：添加键盘快捷键（如Ctrl+Shift+N）

### 性能优化
1. **缓存优化**：缓存目录内容，减少重复查询
2. **异步处理**：优化创建操作的异步处理流程
3. **状态管理**：改进文件列表状态更新机制
