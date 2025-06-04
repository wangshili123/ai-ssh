# 文件下载功能专项任务

## 📋 任务概述

为AI SSH Tool的文件浏览器添加完整的文件下载功能，提供现代化的UI界面、良好的用户体验和强大的功能特性。

## 🎯 项目目标

### 核心功能
- ✅ 单文件下载
- ✅ 批量文件下载  
- ✅ 断点续传
- ✅ 下载进度显示
- ✅ 下载队列管理
- ✅ 错误处理和重试

### 用户体验
- 🎨 现代化UI设计
- 🚀 一键下载操作
- 📊 实时进度反馈
- 🔔 下载完成通知
- 📁 智能路径选择

## 🏗️ 技术方案

### 技术选型说明

**不使用第三方下载组件**，基于项目现有技术栈自主实现：

#### 核心技术栈
- **SFTP传输**: 基于现有的`ssh2`和`ssh2-sftp-client`
- **进度跟踪**: 使用Node.js Stream API监听数据传输
- **UI组件**: 基于Ant Design组件库自定义实现
- **状态管理**: 使用MobX进行下载状态管理
- **文件系统**: Electron的dialog API选择保存路径

#### 实现优势
1. **无额外依赖**: 充分利用现有技术栈
2. **深度集成**: 与现有SFTP服务无缝集成
3. **可控性强**: 完全控制下载逻辑和错误处理
4. **性能优化**: 针对SSH文件传输场景优化

### 架构设计

```
┌─────────────────────────────────────┐
│           前端UI层                   │
├─────────────────────────────────────┤
│ DownloadDialog  │ DownloadProgress  │
│ DownloadManager │ DownloadNotify    │
└─────────────────────────────────────┘
                    │
┌─────────────────────────────────────┐
│           服务层                     │
├─────────────────────────────────────┤
│ DownloadService │ DownloadQueue     │
│ ProgressTracker │ StateManager      │
└─────────────────────────────────────┘
                    │
┌─────────────────────────────────────┐
│         主进程IPC层                  │
├─────────────────────────────────────┤
│ FileDownloadHandler                 │
│ ProgressReporter                    │
└─────────────────────────────────────┘
                    │
┌─────────────────────────────────────┐
│         底层传输层                   │
├─────────────────────────────────────┤
│ SFTP Client (ssh2)                  │
│ File System (fs)                    │
└─────────────────────────────────────┘
```

## 📦 组件设计

### 1. DownloadDialog - 下载配置对话框
```typescript
interface DownloadDialogProps {
  file: FileEntry;
  visible: boolean;
  onConfirm: (config: DownloadConfig) => void;
  onCancel: () => void;
}
```

**功能特性:**
- 文件信息展示（名称、大小、路径）
- 保存位置选择（记住上次位置）
- 文件名编辑
- 下载选项配置（覆盖、打开文件夹等）

### 2. DownloadProgress - 下载进度组件
```typescript
interface DownloadProgressProps {
  taskId: string;
  fileName: string;
  progress: number;
  speed: number;
  remainingTime: number;
  status: DownloadStatus;
}
```

**功能特性:**
- 圆形进度条显示
- 实时速度和剩余时间
- 暂停/恢复/取消操作
- 状态图标和文字提示

### 3. DownloadManager - 下载管理面板
```typescript
interface DownloadManagerProps {
  tasks: DownloadTask[];
  onPause: (taskId: string) => void;
  onResume: (taskId: string) => void;
  onCancel: (taskId: string) => void;
  onRetry: (taskId: string) => void;
}
```

**功能特性:**
- 下载任务列表
- 批量操作（全部暂停/恢复）
- 下载历史记录
- 统计信息显示

## 🔧 核心服务

### DownloadService - 下载服务
```typescript
class DownloadService {
  // 开始下载
  async startDownload(config: DownloadConfig): Promise<string>
  
  // 暂停下载
  async pauseDownload(taskId: string): Promise<void>
  
  // 恢复下载
  async resumeDownload(taskId: string): Promise<void>
  
  // 取消下载
  async cancelDownload(taskId: string): Promise<void>
  
  // 获取下载进度
  getProgress(taskId: string): DownloadProgress
}
```

### ProgressTracker - 进度跟踪器
```typescript
class ProgressTracker {
  // 计算下载速度
  calculateSpeed(bytesTransferred: number, timeElapsed: number): number
  
  // 估算剩余时间
  estimateRemainingTime(totalSize: number, transferred: number, speed: number): number
  
  // 更新进度
  updateProgress(taskId: string, progress: DownloadProgress): void
}
```

## 📋 开发计划

### Phase 1: 基础下载功能 (Week 1) ✅ **已完成**
- [x] 创建下载对话框组件
- [x] 实现文件保存位置选择
- [x] 添加基础SFTP下载功能
- [x] 集成到右键菜单

### Phase 2: 进度和状态管理 (Week 2) ✅ **已完成**
- [x] 实现下载进度跟踪
- [x] 添加下载速度计算
- [x] 创建下载状态管理
- [x] 实现下载通知系统

### Phase 3: 高级功能 (Week 3)
- [ ] 支持断点续传
- [ ] 添加下载队列管理
- [ ] 实现批量下载
- [ ] 添加下载历史记录和查看的按钮（实现内存就行，不用磁盘），按钮放在main.ts顶部菜单栏，新建一个“查看”的菜单项，放在查看下面

### Phase 4: 优化和完善 (Week 4)
- [ ] 性能优化

## 🎨 UI设计规范

### 色彩方案
- 主色调: #1890ff (Ant Design Primary)
- 成功色: #52c41a
- 警告色: #faad14  
- 错误色: #ff4d4f
- 背景色: #1E1E1E (深色主题)

### 组件样式
- 圆角: 4px
- 阴影: 0 2px 8px rgba(0, 0, 0, 0.15)
- 字体: 13px (菜单), 14px (正文)
- 间距: 8px, 16px, 24px

### 动画效果
- 进度条动画: 300ms ease
- 弹窗动画: 200ms ease-out
- 状态切换: 150ms ease

## 📊 性能指标

### 下载性能
- 支持文件大小: 无限制
- 并发下载数: 最多5个
- 内存占用: < 100MB (单个大文件)
- 断点续传: 支持

### 用户体验
- 响应时间: < 200ms
- 进度更新频率: 每100ms
- 错误恢复时间: < 3s



## 📂 相关文档

- [技术实现方案](./technical-implementation.md) - 详细的技术架构和实现原理
- [UI设计规范](./ui-design-specs.md) - 完整的界面设计规范和样式指南
- [实现指南](./implementation-guide.md) - 第一阶段实现完成说明和使用指南

## 🚀 快速开始

### 第一步：了解现有架构
1. 查看现有SFTP服务实现: `src/renderer/services/sftp.ts`
2. 了解文件浏览器组件: `src/renderer/components/FileBrowser/`
3. 熟悉右键菜单实现: `src/renderer/components/FileBrowser/FileList/components/ContextMenu/`

### 第二步：创建基础组件
1. 创建下载对话框: `src/renderer/components/Download/DownloadDialog.tsx`
2. 实现下载服务: `src/renderer/services/downloadService.ts`
3. 添加主进程IPC处理: `src/main/ipc/download.ts`

### 第三步：集成到现有系统
1. 修改右键菜单，添加下载功能
2. 集成到文件浏览器主界面
3. 添加下载状态显示

## 🔗 技术依赖

### 现有依赖（无需新增）
- `ssh2`: SSH2协议实现
- `ssh2-sftp-client`: SFTP客户端
- `electron`: 桌面应用框架
- `antd`: UI组件库
- `react`: 前端框架
- `mobx`: 状态管理

### 可能需要的工具库
- `uuid`: 生成唯一任务ID
- `path`: 路径处理
- `fs`: 文件系统操作

---

**创建时间**: 2024-12-22
**负责人**: AI Assistant
**预计完成**: 2025-01-22
**优先级**: 高
