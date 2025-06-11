# 上传功能组件设计详细说明

## 🎨 组件架构设计

### 1. 组件层次结构

```
Upload Feature Components
├── Transfer (共用组件)
│   ├── TransferHistory        # 统一传输历史
│   ├── TransferManager        # 统一任务管理
│   ├── TransferProgress       # 统一进度显示
│   └── TransferNotification   # 统一通知组件
├── Upload (上传专用)
│   ├── UploadDialog          # 上传配置对话框
│   └── UploadDropZone        # 拖拽上传区域
└── Download (下载专用)
    └── DownloadDialog        # 下载配置对话框
```

## 📋 详细组件设计

### 1. TransferHistory 组件

**功能描述**：统一显示上传和下载历史记录

**重构要点**：
- 基于现有DownloadHistory组件
- 添加传输类型列显示（上传/下载）
- 支持按类型筛选
- 统一的操作按钮（重试、打开文件夹等）

**新增功能**：
```typescript
interface TransferHistoryProps {
  visible: boolean;
  onClose: () => void;
  filterType?: 'all' | 'download' | 'upload'; // 新增筛选
}
```

**UI改进**：
- 添加传输类型图标（📥下载 📤上传）
- 添加类型筛选标签页
- 统一的状态标签和进度显示

### 2. TransferManager 组件

**功能描述**：统一管理所有传输任务

**重构要点**：
- 基于现有DownloadManager组件
- 支持上传和下载任务混合显示
- 统一的批量操作（全部暂停/恢复/取消）

**新增功能**：
```typescript
interface TransferManagerProps {
  visible: boolean;
  onClose: () => void;
  defaultTab?: 'all' | 'download' | 'upload'; // 默认显示标签
}
```

**UI布局**：
```
┌─────────────────────────────────────┐
│ 📊 传输管理                          │
├─────────────────────────────────────┤
│ [全部] [下载] [上传]                 │ <- 标签页
├─────────────────────────────────────┤
│ 统计信息: 总计3 下载1 上传2          │
├─────────────────────────────────────┤
│ 📥 downloading file1.txt             │
│ ████████░░ 80% 1.2MB/s              │
│                                     │
│ 📤 uploading file2.jpg              │
│ ██████░░░░ 60% 800KB/s              │
├─────────────────────────────────────┤
│ [清除已完成] [全部暂停] [全部恢复]    │
└─────────────────────────────────────┘
```

### 3. TransferProgress 组件

**功能描述**：统一的传输进度显示组件

**重构要点**：
- 基于现有DownloadProgress组件
- 根据传输类型显示不同图标和文案
- 保持相同的交互逻辑

**适配逻辑**：
```typescript
interface TransferProgressProps {
  task: TransferTask; // 统一的任务接口
  onPause?: (taskId: string) => void;
  onResume?: (taskId: string) => void;
  onCancel?: (taskId: string) => void;
}

// 根据任务类型显示不同内容
const getTransferIcon = (type: 'download' | 'upload') => {
  return type === 'download' ? <DownloadOutlined /> : <UploadOutlined />;
};

const getTransferText = (type: 'download' | 'upload', status: string) => {
  const prefix = type === 'download' ? '下载' : '上传';
  return `${prefix}${getStatusText(status)}`;
};
```

### 4. UploadDialog 组件

**功能描述**：上传文件配置对话框

**设计要点**：
- 复用DownloadDialog的UI框架和样式
- 文件选择 + 拖拽支持
- 远程路径配置
- 批量上传支持

**组件接口**：
```typescript
interface UploadDialogProps {
  visible: boolean;
  selectedFiles?: File[];
  defaultRemotePath?: string;
  sessionInfo: SessionInfo;
  onConfirm: (config: UploadConfig) => void;
  onCancel: () => void;
}

interface UploadConfig {
  remotePath: string;
  overwrite: boolean;
  preservePermissions: boolean;
  sessionId: string;
  // 优化选项
  useCompression?: boolean;
  compressionMethod?: 'auto' | 'gzip' | 'bzip2' | 'xz' | 'none';
  useParallelUpload?: boolean;
  maxParallelChunks?: number;
}
```

**UI布局设计**：
```
┌─────────────────────────────────────┐
│ 📤 上传文件                          │
├─────────────────────────────────────┤
│ 文件选择区域                         │
│ ┌─────────────────────────────────┐ │
│ │ 📁 拖拽文件到此处或点击选择        │ │
│ │                                 │ │
│ │ 已选择文件：                     │ │
│ │ ✓ document.pdf (2.3MB)          │ │
│ │ ✓ image.jpg (1.8MB)             │ │
│ │ [+ 添加更多文件]                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 远程保存路径                         │
│ [/home/user/uploads/] [📁浏览]       │
│                                     │
│ 上传选项                            │
│ ☑ 覆盖同名文件                      │
│ ☑ 保持文件权限                      │
│                                     │
│ 🔧 上传优化选项 (展开/收起)          │
│ ├─ ☑ 智能压缩传输                   │
│ └─ ☑ 并行分块上传                   │
├─────────────────────────────────────┤
│              [取消] [开始上传]        │
└─────────────────────────────────────┘
```

### 5. UploadDropZone 组件

**功能描述**：拖拽上传区域组件

**设计要点**：
- 支持文件和文件夹拖拽
- 文件类型过滤
- 拖拽状态视觉反馈
- 可嵌入到其他组件中

**组件接口**：
```typescript
interface UploadDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;              // 接受的文件类型
  maxFiles?: number;            // 最大文件数量
  maxSize?: number;             // 单文件最大大小
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;   // 自定义内容
}
```

**状态设计**：
```typescript
interface DropZoneState {
  isDragOver: boolean;          // 拖拽悬停状态
  isDragActive: boolean;        // 拖拽激活状态
  selectedFiles: File[];        // 已选择文件
  errors: string[];             // 验证错误
}
```

**UI状态变化**：
```css
/* 默认状态 */
.upload-drop-zone {
  border: 2px dashed #d9d9d9;
  background: #fafafa;
}

/* 拖拽悬停状态 */
.upload-drop-zone.drag-over {
  border-color: #1890ff;
  background: #e6f7ff;
}

/* 拖拽激活状态 */
.upload-drop-zone.drag-active {
  border-color: #52c41a;
  background: #f6ffed;
}
```

## 🔄 组件重构策略

### 1. 渐进式重构

**第一步：创建Transfer基础组件**
- 复制现有Download组件
- 重命名为Transfer组件
- 添加type参数支持

**第二步：适配双模式显示**
- 根据type显示不同图标和文案
- 保持原有交互逻辑不变
- 添加类型筛选功能

**第三步：创建Upload专用组件**
- 基于Transfer组件框架
- 实现上传特有功能
- 集成拖拽支持

### 2. 向后兼容保证

**保持现有API不变**：
```typescript
// 现有的DownloadManager仍然可用
<DownloadManager visible={visible} onClose={onClose} />

// 新的TransferManager向后兼容
<TransferManager 
  visible={visible} 
  onClose={onClose}
  defaultTab="download" // 默认只显示下载
/>
```

**渐进式迁移**：
- 现有代码继续使用Download组件
- 新功能使用Transfer组件
- 逐步迁移现有代码到Transfer组件

### 3. 样式复用策略

**CSS类命名规范**：
```css
/* 通用传输样式 */
.transfer-dialog { }
.transfer-progress { }
.transfer-manager { }

/* 下载专用样式 */
.download-dialog { }
.download-specific { }

/* 上传专用样式 */
.upload-dialog { }
.upload-drop-zone { }
```

**样式继承关系**：
- Transfer组件继承Download组件的基础样式
- Upload组件复用Transfer组件的样式框架
- 只修改必要的颜色和图标差异

## 📱 响应式设计

### 移动端适配
```css
@media (max-width: 768px) {
  .upload-dialog {
    width: 90vw !important;
    margin: 20px;
  }
  
  .upload-drop-zone {
    min-height: 120px;
    padding: 16px;
  }
  
  .file-list {
    max-height: 200px;
    overflow-y: auto;
  }
}
```

### 触摸设备优化
- 增大点击区域
- 优化拖拽手势
- 简化复杂交互

## 🎯 用户体验设计

### 1. 一致性原则
- 与下载功能保持相同的视觉风格
- 统一的交互模式和反馈机制
- 相同的错误处理和提示方式

### 2. 易用性优化
- 智能默认值设置
- 清晰的操作指引
- 及时的状态反馈

### 3. 性能考虑
- 大文件列表虚拟滚动
- 图片预览懒加载
- 进度更新节流处理
