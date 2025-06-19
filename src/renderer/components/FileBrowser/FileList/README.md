# FileList 组件重构说明

## 重构概述

FileList 组件已经从原来的 1300+ 行重构为 710 行，减少了约 45% 的代码量。通过将功能拆分到不同的模块中，提高了代码的可维护性和可读性。

## 文件结构

```
FileList/
├── FileList.tsx                 # 主组件文件 (710行)
├── FileList.css                 # 样式文件
├── README.md                    # 说明文档
├── components/                  # 子组件
│   ├── index.ts                # 组件导出
│   ├── ResizableTitle.tsx      # 可调整大小的表头组件
│   ├── ContextMenu/            # 右键菜单相关组件
│   └── Permission/             # 权限设置相关组件
├── hooks/                      # 自定义 Hooks
│   ├── index.ts               # Hooks 导出
│   ├── useFileListColumns.tsx # 表格列定义 Hook
│   ├── useDialogStates.ts     # 对话框状态管理 Hook
│   └── useFileOperations.ts   # 文件操作 Hook
├── utils/                     # 工具函数
│   ├── index.ts              # 工具函数导出
│   └── fileFormatters.ts     # 文件格式化工具
└── core/                     # 核心功能
    ├── FileListEvents.ts     # 事件处理
    └── FileOpenManager.ts    # 文件打开管理
```

## 重构内容

### 1. 工具函数提取 (`utils/fileFormatters.ts`)
- `formatPermissions()` - 权限格式化
- `formatFileSize()` - 文件大小格式化  
- `getFileIcon()` - 文件图标获取

### 2. 表格列定义 (`hooks/useFileListColumns.tsx`)
- 将复杂的表格列定义逻辑提取到独立的 Hook
- 包含列渲染、排序、调整大小等功能
- 支持文件图标、加载状态、高亮显示等

### 3. 对话框状态管理 (`hooks/useDialogStates.ts`)
- 统一管理所有对话框的状态
- 包括下载、上传、创建、权限、编辑器等对话框
- 简化主组件的状态管理

### 4. 文件操作 (`hooks/useFileOperations.ts`)
- `updateFileListWithNewFile()` - 更新文件列表
- `insertFileInSortedOrder()` - 按排序规则插入文件
- `highlightFile()` - 高亮显示文件
- `scrollToFile()` - 滚动到指定文件

### 5. 可调整大小表头 (`components/ResizableTitle.tsx`)
- 独立的表头组件，支持列宽调整
- 原生实现，无第三方依赖
- 提供视觉反馈和拖拽功能

## 优势

1. **代码可维护性提升** - 功能模块化，职责清晰
2. **复用性增强** - 工具函数和 Hooks 可在其他地方复用
3. **测试友好** - 独立的模块更容易进行单元测试
4. **性能优化** - 通过 Hook 的依赖管理避免不必要的重渲染
5. **开发体验改善** - 代码结构清晰，便于理解和修改

## 使用方式

主组件的使用方式保持不变，所有的重构都是内部实现的优化：

```tsx
<FileList
  sessionInfo={sessionInfo}
  tabId={tabId}
  currentPath={currentPath}
  fileList={fileList}
  loading={loading}
  onFileListChange={onFileListChange}
  onDirectorySelect={onDirectorySelect}
  onRefresh={onRefresh}
/>
```

## 注意事项

- 所有原有功能保持不变
- API 接口完全兼容
- 性能和用户体验无影响
- 支持所有现有的文件操作和编辑器功能
