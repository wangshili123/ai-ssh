# 权限设置功能设计方案

## 项目概述

为AI SSH Tool的文件浏览器添加权限设置功能，提供直观的图形界面来修改文件和文件夹的权限。

## 功能需求

### 核心功能
1. **单文件权限设置**：修改单个文件或文件夹的权限
2. **批量权限设置**：同时修改多个选中文件的权限
3. **递归权限设置**：对文件夹及其子内容递归应用权限
4. **双模式编辑**：支持八进制(755)和符号(rwxr-xr-x)两种编辑方式

### 用户交互设计
- **触发方式**：右键菜单中添加"权限设置"选项
- **编辑界面**：弹出权限设置对话框，支持可视化编辑
- **实时预览**：修改时实时显示权限字符串和八进制值
- **批量操作**：显示选中文件数量，统一设置权限

## 架构设计

### 组件结构
```
FileList (主组件)
├── 权限设置回调处理 (handlePermissionRequest)
├── PermissionDialog (权限设置对话框)
│   ├── OctalPermissionEditor (八进制权限编辑器)
│   ├── SymbolicPermissionEditor (符号权限编辑器)
│   └── AdvancedOptions (高级选项：递归等)
└── permissionAction (权限操作服务)
```

### 数据流设计
1. **触发**: 右键菜单 → FileListContextMenu → 触发权限设置事件
2. **处理**: FileList组件接收事件 → 显示权限设置对话框
3. **执行**: 用户确认 → permissionAction执行chmod命令 → 刷新文件列表
4. **反馈**: 显示操作结果 → 更新文件权限显示

### 关键设计原则
- **回调集中处理**：所有权限设置回调都在FileList组件中处理，避免在菜单组件中处理业务逻辑
- **复用现有基础设施**：基于现有的SSH命令执行服务和文件刷新机制
- **模块化设计**：权限编辑器、操作服务等都是独立模块，便于维护和测试

## 技术实现细节

### 权限操作服务 (permissionAction.ts)
```typescript
interface PermissionOptions {
  files: FileEntry[];
  permissions: string; // 八进制权限如 "755" 或符号权限如 "u+x"
  recursive?: boolean; // 是否递归应用到子目录
  sessionInfo: SessionInfo;
  currentPath: string;
  mode: 'octal' | 'symbolic'; // 权限模式
}

interface PermissionResult {
  success: boolean;
  message: string;
  failedFiles?: string[];
  updatedFiles?: FileEntry[];
}

class PermissionAction {
  // 设置文件权限
  static async setPermissions(options: PermissionOptions): Promise<PermissionResult>
  
  // 验证权限格式
  static validatePermissions(permissions: string, mode: 'octal' | 'symbolic'): boolean
  
  // 构建chmod命令
  static buildChmodCommand(files: FileEntry[], permissions: string, recursive: boolean): string
}
```

### 权限设置对话框 (PermissionDialog.tsx)
```typescript
interface PermissionDialogProps {
  visible: boolean;
  files: FileEntry[];
  onConfirm: (options: PermissionOptions) => void;
  onCancel: () => void;
}

// 对话框状态
interface PermissionDialogState {
  mode: 'octal' | 'symbolic';
  permissions: {
    owner: { read: boolean; write: boolean; execute: boolean };
    group: { read: boolean; write: boolean; execute: boolean };
    others: { read: boolean; write: boolean; execute: boolean };
  };
  octalValue: string;
  symbolicValue: string;
  recursive: boolean;
  applyToFiles: boolean;
  applyToDirectories: boolean;
}
```

### FileList组件集成
```typescript
// 在FileList组件中添加权限设置相关状态和处理函数
const [permissionDialogVisible, setPermissionDialogVisible] = useState(false);
const [permissionFiles, setPermissionFiles] = useState<FileEntry[]>([]);

// 权限设置请求处理（从右键菜单触发）
const handlePermissionRequest = useCallback((files: FileEntry[]) => {
  console.log('FileList: 收到权限设置请求', files.map(f => f.name));
  setPermissionFiles(files);
  setPermissionDialogVisible(true);
}, []);

// 权限设置确认处理
const handlePermissionConfirm = async (options: PermissionOptions) => {
  try {
    const result = await permissionAction.setPermissions(options);
    if (result.success) {
      message.success(result.message);
      setPermissionDialogVisible(false);
      // 刷新文件列表
      onRefresh?.();
    } else {
      message.error(result.message);
    }
  } catch (error) {
    console.error('权限设置失败:', error);
    message.error('权限设置失败');
  }
};

// 权限设置取消处理
const handlePermissionCancel = () => {
  setPermissionDialogVisible(false);
};
```

## 用户界面设计

### 权限设置对话框布局
```
┌─────────────────────────────────────┐
│ 设置文件权限                          │
├─────────────────────────────────────┤
│ 文件: filename.txt (共2个文件)        │
│                                     │
│ ○ 八进制模式  ○ 符号模式              │
│                                     │
│ 权限设置:                            │
│ ┌─────┬─────┬─────┬─────┐            │
│ │     │ 读  │ 写  │ 执行 │            │
│ ├─────┼─────┼─────┼─────┤            │
│ │所有者│ ☑  │ ☑  │ ☑  │            │
│ │ 组  │ ☑  │ ☐  │ ☑  │            │
│ │其他 │ ☑  │ ☐  │ ☑  │            │
│ └─────┴─────┴─────┴─────┘            │
│                                     │
│ 权限字符串: rwxr-xr-x (755)          │
│                                     │
│ □ 递归应用到子目录                    │
│ □ 仅应用到文件                       │
│ □ 仅应用到目录                       │
│                                     │
│           [取消]  [确定]             │
└─────────────────────────────────────┘
```

### 右键菜单集成
在FileListContextMenu中添加权限设置选项：
- 单个文件: "设置权限"
- 多个文件: "批量设置权限 (N个文件)"
- 显示当前权限信息作为提示

## 文件结构

```
src/renderer/components/FileBrowser/FileList/
├── components/
│   ├── ContextMenu/
│   │   ├── FileListContextMenu.tsx (添加权限设置菜单项)
│   │   └── actions/
│   │       └── permissionAction.ts (新增)
│   └── Permission/ (新增目录)
│       ├── PermissionDialog.tsx
│       ├── PermissionDialog.css
│       ├── OctalPermissionEditor.tsx
│       ├── SymbolicPermissionEditor.tsx
│       └── AdvancedOptions.tsx
└── FileList.tsx (添加权限设置回调处理)
```

## 实现计划

### 第一阶段：基础功能
1. 创建permissionAction权限操作服务
2. 实现基础的PermissionDialog组件
3. 在FileList中添加权限设置回调处理
4. 在右键菜单中添加权限设置选项

### 第二阶段：界面优化
1. 实现双模式编辑器（八进制/符号）
2. 添加实时权限预览
3. 完善批量操作界面
4. 添加权限设置的CSS样式

### 第三阶段：高级功能
1. 递归权限设置
2. 仅文件/仅目录选项
3. 权限模板功能
4. 操作历史记录

## 安全考虑

### 权限验证
- 检查用户是否有修改目标文件权限的权限
- 验证权限格式的合法性
- 防止设置危险权限组合

### 操作安全
- 对于可能影响系统安全的权限修改给出警告
- 重要权限修改需要二次确认
- 提供操作预览，让用户了解修改的影响

### 错误处理
- 完善的错误提示和用户反馈
- 部分失败时的详细报告
- 操作失败时的回滚机制

## 测试计划

### 功能测试
- 单文件权限设置
- 批量文件权限设置
- 递归权限设置
- 权限格式验证

### 界面测试
- 权限编辑器交互
- 实时预览功能
- 错误提示显示
- 响应式布局

### 安全测试
- 权限验证机制
- 危险操作警告
- 错误处理机制
- 边界条件测试
