# 上传功能开发规划

## 📋 项目概述

基于现有下载功能的成功架构，设计并实现文件上传功能。重点关注代码复用、UI一致性和用户体验的统一。

## 🎯 设计目标

1. **最大化代码复用**：复用下载功能的架构、组件和工具函数
2. **统一用户体验**：保持与下载功能一致的UI风格和交互模式
3. **功能完整性**：支持单文件/批量上传、拖拽上传、进度管理等
4. **性能优化**：支持压缩传输、并行上传、断点续传

## 🔄 架构优化方案

### 1. 组件共用策略

#### 1.1 完全共用的组件
- **TransferHistory** (重构自DownloadHistory) - 统一的传输历史记录
- **TransferManager** (重构自DownloadManager) - 统一的传输任务管理器
- **TransferNotificationManager** - 统一的通知管理器

#### 1.2 需要适配的组件
- **TransferProgress** (重构自DownloadProgress) - 支持上传/下载双模式
- **TransferNotification** (重构自DownloadNotification) - 支持双向传输通知

#### 1.3 上传专用组件
- **UploadDialog** - 上传配置对话框
- **UploadDropZone** - 拖拽上传区域

### 2. 数据结构统一

#### 2.1 统一的传输任务接口
```typescript
interface TransferTask {
  id: string;
  type: 'download' | 'upload';
  // 下载任务字段
  file?: FileEntry;
  // 上传任务字段  
  localFiles?: File[];
  remotePath?: string;
  // 通用字段
  config: TransferConfig;
  status: TransferStatus;
  progress: TransferProgress;
  // ... 其他通用字段
}
```

#### 2.2 统一的配置接口
```typescript
interface TransferConfig {
  sessionId: string;
  overwrite: boolean;
  // 下载专用
  savePath?: string;
  fileName?: string;
  openFolder?: boolean;
  // 上传专用
  remotePath?: string;
  preservePermissions?: boolean;
  // 通用优化选项
  useCompression?: boolean;
  compressionMethod?: CompressionMethod;
  useParallelTransfer?: boolean;
  maxParallelChunks?: number;
}
```

### 3. 服务层重构

#### 3.1 统一的传输服务
```typescript
class TransferService extends EventEmitter {
  private downloadTasks = new Map<string, DownloadTask>();
  private uploadTasks = new Map<string, UploadTask>();
  
  // 统一的任务管理方法
  getAllTasks(): TransferTask[]
  getTasksByType(type: 'download' | 'upload'): TransferTask[]
  pauseTask(taskId: string): Promise<void>
  resumeTask(taskId: string): Promise<void>
  cancelTask(taskId: string): Promise<void>
}
```

#### 3.2 保持向后兼容
- DownloadService 继承 TransferService
- UploadService 继承 TransferService
- 现有API保持不变

## 📁 文件结构规划

### 1. 组件重构
```
src/renderer/components/
├── Transfer/                    # 新增：统一传输组件
│   ├── index.ts
│   ├── TransferHistory.tsx      # 重构自DownloadHistory
│   ├── TransferHistory.css
│   ├── TransferManager.tsx      # 重构自DownloadManager  
│   ├── TransferManager.css
│   ├── TransferProgress.tsx     # 重构自DownloadProgress
│   ├── TransferProgress.css
│   ├── TransferNotification.tsx # 重构自DownloadNotification
│   ├── TransferNotification.css
│   └── TransferNotificationManager.tsx
├── Download/                    # 保留：下载专用组件
│   ├── index.ts
│   ├── DownloadDialog.tsx       # 保持不变
│   └── DownloadDialog.css
└── Upload/                      # 新增：上传专用组件
    ├── index.ts
    ├── UploadDialog.tsx         # 新建
    ├── UploadDialog.css
    ├── UploadDropZone.tsx       # 新建
    └── UploadDropZone.css
```

### 2. 服务层重构
```
src/renderer/services/
├── transferService.ts           # 新增：统一传输服务基类
├── downloadService.ts           # 重构：继承TransferService
└── uploadService.ts             # 新增：继承TransferService
```

### 3. 主进程扩展
```
src/main/
├── ipc/
│   ├── transfer.ts              # 新增：统一传输IPC处理
│   ├── download.ts              # 保留：下载专用IPC
│   └── upload.ts                # 新增：上传专用IPC
└── services/
    ├── compressionUploadService.ts    # 新增
    └── parallelUploadService.ts       # 新增
```

## 🚀 开发计划

### 第一阶段：基础架构重构 (第1周)
1. **创建TransferService基类**
   - 统一任务管理逻辑
   - 事件系统重构
   - 向后兼容性保证

2. **重构现有组件为Transfer组件**
   - TransferHistory (支持上传/下载混合显示)
   - TransferManager (统一任务管理界面)
   - TransferProgress (双模式进度显示)

### 第二阶段：上传核心功能 (第2周)
1. **创建UploadDialog组件**
   - 文件选择界面
   - 远程路径配置
   - 上传参数设置

2. **实现UploadService**
   - 继承TransferService
   - 上传任务管理
   - 与主进程IPC通信

3. **主进程上传处理**
   - upload.ts IPC处理器
   - 基础文件上传逻辑

### 第三阶段：高级功能实现 (第3周)
1. **拖拽上传功能**
   - UploadDropZone组件
   - 文件拖拽处理
   - 与文件浏览器集成

2. **批量上传支持**
   - 多文件选择
   - 批量进度显示
   - 队列管理

3. **优化功能集成**
   - 压缩上传
   - 并行分块上传
   - 断点续传

### 第四阶段：集成和优化 (第4周)
1. **UI集成**
   - 文件浏览器右键菜单
   - 快捷键支持
   - 工具栏按钮

2. **测试和优化**
   - 功能测试
   - 性能优化
   - 用户体验改进

## 📋 任务清单

### 优先级1：核心架构
- [ ] 创建TransferService基类
- [ ] 重构DownloadService继承TransferService
- [ ] 创建统一的TransferTask接口
- [ ] 重构TransferHistory组件
- [ ] 重构TransferManager组件

### 优先级2：上传功能
- [ ] 创建UploadService
- [ ] 实现UploadDialog组件
- [ ] 创建upload.ts IPC处理器
- [ ] 实现基础文件上传逻辑

### 优先级3：高级功能
- [ ] 实现UploadDropZone组件
- [ ] 添加拖拽上传支持
- [ ] 实现批量上传功能
- [ ] 集成压缩和并行上传

### 优先级4：集成优化
- [ ] 文件浏览器集成
- [ ] 快捷键和工具栏
- [ ] 测试和性能优化
- [ ] 文档更新

## 🎯 成功标准

1. **功能完整性**：支持单文件/批量/拖拽上传
2. **性能表现**：支持大文件上传和优化传输
3. **用户体验**：与下载功能保持一致的交互体验
4. **代码质量**：高复用率，清晰的架构设计
5. **稳定性**：完善的错误处理和恢复机制

## 📝 注意事项

1. **向后兼容**：确保现有下载功能不受影响
2. **渐进式重构**：分阶段进行，避免大规模破坏性变更
3. **测试覆盖**：每个阶段都要进行充分测试
4. **文档同步**：及时更新相关文档和注释
