# 文件编辑器实现指南

## 1. 整体架构

文件编辑器是基于Monaco Editor实现的，支持两种模式：
- **浏览模式**：适用于大文件，支持分块加载
- **编辑模式**：适用于完整编辑文件内容

### 目录结构

```
src/renderer/components/FileBrowser/FileEditor/
├── components/             # UI组件
│   ├── FileEditorMain/     # 编辑器主容器
│   │   ├── FileEditorMain.tsx
│   │   └── FileEditorMain.css
│   ├── EditorToolbar/      # 编辑器工具栏
│   ├── FileSearchPanel/    # 搜索面板
│   ├── FileFilterPanel/    # 过滤面板
│   └── ModeSwitchButton/   # 模式切换按钮
├── core/                   # 核心逻辑类
│   ├── EditorManager.ts    # 编辑器状态管理
│   ├── EditorContentManager.ts  # 内容管理
│   ├── EditorModeManager.ts     # 模式管理
│   └── EditorReadOnlyHandler.ts # 只读模式处理
├── types/                  # 类型定义
│   └── FileEditorTypes.ts  # 编辑器相关类型
├── styles/                 # 样式文件
├── utils/                  # 工具函数
└── store/                  # 状态管理
```

### SFTP相关文件结构

```
src/
├── main/services/          # 主进程服务
│   ├── sftp.ts             # SFTP主进程实现
│   └── sftp-manager.ts     # SFTP管理器
├── main/ipc/               # IPC处理
│   └── sftp.ts             # SFTP IPC处理器
└── renderer/services/      # 渲染进程服务
    └── sftp.ts             # SFTP客户端封装
```

### 核心组件

- **FileEditorMain**: 主要React组件，负责展示编辑器UI和状态管理
- **EditorManager**: 核心类，管理编辑器状态和操作
- **EditorContentManager**: 负责文件内容的加载、编辑和保存
- **EditorModeManager**: 管理编辑器的模式切换
- **SFTPService**: 处理文件读写的服务层

### 数据流向

1. 用户操作 → React组件
2. React组件 → EditorManager
3. EditorManager → EditorContentManager/EditorModeManager
4. EditorContentManager → SFTPService
5. SFTPService → IPC → 主进程 → SFTP操作 → 远程文件系统

## 2. 大文件处理机制

### 分块加载（浏览模式）

```
用户打开文件
  ↓
检查文件大小
  ↓
如果是大文件
  ↓
分块加载初始内容
  ↓
用户滚动到底部
  ↓
触发加载更多内容
  ↓
追加新内容到编辑器
```

### 关键优化点

1. **限制初始加载大小**：默认最初只加载64KB内容
2. **滚动触发加载**：滚动到底部时自动加载更多内容
3. **内容追加机制**：将新内容追加到已有内容
4. **浏览模式不触发isDirty**：防止用户滚动时出现保存提示

### 完整加载（编辑模式）

```
用户切换到编辑模式
  ↓
检测是否为大文件
  ↓
如果是，并行读取整个文件
  ↓
显示加载进度条
  ↓
加载完成后更新编辑器
  ↓
关闭大文件状态
```

## 3. SFTP集成

### 读取文件

SFTP客户端有64KB的单次读取限制。解决方案：

```typescript
// 多线程并行读取大文件
async readLargeFile(sessionId, filePath, options): Promise<{content, totalSize, bytesRead}> {
  // 1. 获取文件信息
  // 2. 分割文件为多个块
  // 3. 并行读取多个块
  // 4. 合并结果
  // 5. 更新进度
}
```

### 写入文件

```typescript
// 保存文件内容
async saveContent(): Promise<boolean> {
  // 1. 获取当前内容
  // 2. 写入到远程文件
  // 3. 更新isDirty状态
}
```

### 进度显示

```typescript
// 使用事件系统通知加载进度
onProgress = (progress: number) => {
  // 发送进度事件
  this.emit('loadingProgress', progress);
  // 更新状态
  this.emit('stateChanged', {...state, loadingProgress: progress});
}
```

## 4. 模式切换机制

### 浏览模式到编辑模式

```
检查是否为大文件
  ↓
如果是，加载完整文件
  ↓
显示加载进度
  ↓
加载完成，更新编辑器内容
  ↓
更新编辑器状态
  ↓
切换到可编辑状态
```

### 编辑模式到浏览模式

```
检查是否有未保存内容
  ↓
提示用户保存
  ↓
切换到只读状态
```

## 5. 用户界面

### 主要组件

- **FileEditorMain**: 编辑器主容器
- **EditorToolbar**: 工具栏，包含模式切换、保存等按钮
- **LoadingIndicator**: 加载指示器，支持进度条显示

### 加载进度条实现

```tsx
{editorState.isLoading && (
  <div className="loading-indicator">
    <LoadingOutlined style={{ marginRight: 8 }} />
    <span>
      {editorState.loadingProgress !== undefined 
        ? `正在加载文件... ${Math.round(editorState.loadingProgress * 100)}%` 
        : '正在加载文件...'}
    </span>
    {editorState.loadingProgress !== undefined && (
      <div className="loading-progress-bar-container">
        <div 
          className="loading-progress-bar" 
          style={{ width: `${Math.round(editorState.loadingProgress * 100)}%` }}
        />
      </div>
    )}
  </div>
)}
```

## 6. 注意事项与优化点

1. **浏览模式下不更新isDirty状态**：
   ```typescript
   // 在EditorContentManager中
   if(this.activeMode === EditorMode.BROWSE) {
     console.log('[EditorContentManager] 浏览模式下，不处理内容变化');
     return;
   }
   ```

2. **内容追加的边界处理**：确保内容追加的位置正确

3. **模式切换时的状态一致性**：确保UI状态和编辑器状态同步

4. **大文件加载进度计算**：基于实际读取的字节数计算进度
   ```typescript
   const progress = Math.min(totalBytesRead / actualTotalSize, 1);
   ```

## 7. 未来改进方向

1. 增加文件编码自动识别
2. 优化大文件搜索功能
3. 添加文件对比功能
4. 实现文件修改监控功能
5. 增强编辑器语法高亮支持 