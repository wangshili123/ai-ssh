# 文件编辑器技术规格说明书

## 一、项目结构

### 1. 目录结构
```
src/renderer/components/FileBrowser/
├── FileEditor/                     # 文件编辑器模块
│   ├── core/                      # 核心功能模块
│   │   ├── FileEditorManager.ts  # 编辑器管理类
│   │   ├── FileLoaderManager.ts  # 文件加载管理器
│   │   ├── FilterManager.ts      # 过滤管理器
│   │   ├── SearchManager.ts      # 搜索管理器
│   │   └── FileWatchManager.ts   # 文件监控管理器
│   ├── components/                # UI组件
│   │   ├── FileEditorMain/       # 主编辑器组件
│   │   │   ├── FileEditorMain.tsx
│   │   │   ├── FileEditorMain.less
│   │   │   └── FileEditorTypes.ts
│   │   ├── FileEditorToolbar/    # 工具栏组件
│   │   │   ├── FileEditorToolbar.tsx
│   │   │   └── FileEditorToolbar.less
│   │   ├── FileFilterPanel/      # 过滤面板
│   │   │   ├── FileFilterPanel.tsx
│   │   │   └── FileFilterPanel.less
│   │   ├── FileSearchPanel/      # 搜索面板
│   │   │   ├── FileSearchPanel.tsx
│   │   │   └── FileSearchPanel.less
│   │   └── FileStatusBar/        # 状态栏
│   │       ├── FileStatusBar.tsx
│   │       └── FileStatusBar.less
│   ├── store/                    # 状态管理
│   │   ├── FileEditorStore.ts   # 编辑器状态
│   │   ├── FileFilterStore.ts   # 过滤状态
│   │   └── FileSearchStore.ts   # 搜索状态
│   ├── utils/                    # 工具函数
│   │   ├── FileEditorUtils.ts   # 编辑器工具
│   │   ├── FileFilterUtils.ts   # 过滤工具
│   │   └── FileSearchUtils.ts   # 搜索工具
│   └── types/                    # 类型定义
│       └── FileEditorTypes.ts    # 公共类型
└── FileList/                     # 文件列表模块
    ├── core/                     # 核心功能模块
    │   └── FileOpenManager.ts    # 文件打开管理器
    ├── components/               # UI组件
    │   └── ContextMenu/         # 右键菜单组件
    └── types/                   # 类型定义
```

### 2. 主要文件说明
- **FileEditorManager.ts**: 编辑器核心实现，负责文本处理和编辑功能
- **FileLoaderManager.ts**: 实现大文件分块加载和虚拟滚动
- **FilterManager.ts**: 实现文件内容过滤功能
- **FileWatchManager.ts**: 实现文件变化监控和实时更新
- **FileEditorStore.ts**: 统一状态管理，处理组件间通信

## 二、技术栈选型

### 1. 核心技术
- **框架**: React 18 + TypeScript
- **状态管理**: Mobx
- **编辑器核心**: Monaco Editor
- **样式方案**: Less + CSS Modules
- **构建工具**: Webpack 5

### 2. 关键依赖包
```json
{
  "dependencies": {
    "monaco-editor": "^0.45.0",    // 编辑器核心
    "mobx": "^6.12.0",            // 状态管理
    "mobx-react": "^9.1.0",       // React绑定
    "rxjs": "^7.8.1",             // 响应式编程
    "chokidar": "^3.5.3",         // 文件监控
  }
}
```

## 三、核心模块设计

### 1. 文件加载模块
```typescript
interface IFileLoader {
  // 加载指定范围的文件内容
  loadChunk(start: number, end: number): Promise<string[]>;
  
  // 获取文件基本信息
  getFileInfo(): Promise<FileInfo>;
  
  // 应用过滤条件
  applyFilter(filter: FilterConfig): void;
  
  // 清除过滤
  clearFilter(): void;
}

interface FileInfo {
  size: number;
  lineCount: number;
  encoding: string;
  lastModified: Date;
}

interface FilterConfig {
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
}
```

### 2. 过滤引擎
```typescript
interface IFilterEngine {
  // 设置过滤条件
  setFilter(config: FilterConfig): void;
  
  // 处理文本块
  processChunk(text: string): string[];
  
  // 获取过滤状态
  getStats(): FilterStats;
}

interface FilterStats {
  matchedLines: number;
  totalLines: number;
  processedSize: number;
}
```

### 3. 文件监控
```typescript
interface IFileWatcher {
  // 开始监控文件变化
  watch(path: string): void;
  
  // 停止监控
  stop(): void;
  
  // 设置变化处理器
  onChanged(handler: (content: string) => void): void;
}
```

## 四、性能优化策略

### 1. 大文件处理
- 使用虚拟滚动技术
- 分块加载，默认块大小2MB
- LRU缓存管理已加载内容
- 后台预加载临近块

### 2. 过滤优化
- 流式处理，边读边过滤
- 多线程处理大文件
- 增量处理新内容
- 过滤结果缓存

### 3. 内存管理
- 设置最大内存使用限制（默认512MB）
- 超出限制时自动释放远端内容
- 定期清理未使用的缓存

## 五、接口规范

### 1. 事件定义
```typescript
enum EditorEvents {
  CONTENT_CHANGED = 'content-changed',
  FILTER_APPLIED = 'filter-applied',
  FILTER_CLEARED = 'filter-cleared',
  FILE_LOADED = 'file-loaded',
  ERROR_OCCURRED = 'error-occurred'
}
```

### 2. 状态定义
```typescript
interface EditorState {
  isLoading: boolean;
  currentFile: string;
  filterActive: boolean;
  filterStats: FilterStats;
  error: Error | null;
}
```

## 六、错误处理

### 1. 错误类型
```typescript
enum EditorErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ENCODING_ERROR = 'ENCODING_ERROR',
  MEMORY_EXCEEDED = 'MEMORY_EXCEEDED',
  FILTER_ERROR = 'FILTER_ERROR'
}
```

### 7. 文件打开方式实现

#### 数据结构
```typescript
// 文件打开设置
interface FileOpenSettings {
  defaultEditor: 'built-in';
  fileTypeAssociations: {
    [extension: string]: {
      editor: 'built-in';
    }
  }
}

// 扩展现有的 UISettings
interface UISettings {
  isFileBrowserVisible: boolean;
  isAIVisible: boolean;
  fileOpenSettings: FileOpenSettings;
}
```

#### 核心模块
- **FileListContextMenu**：
  - 位置：`src/renderer/components/FileBrowser/FileList/components/ContextMenu`
  - 职责：实现文件列表的右键菜单UI和交互
  
- **FileOpenManager**：
  - 位置：`src/renderer/components/FileBrowser/FileList/core`
  - 职责：管理文件打开方式的配置和执行

#### 实现流程
1. 存储层：
   - 扩展 StorageService 添加文件打开设置的存储和读取
   - 实现配置的自动保存

2. 组件层：
   - 实现右键菜单组件
   - 集成到 FileList 组件
   - 处理菜单事件

3. 状态管理：
   - 在 Store 中维护打开方式配置
   - 实现配置变更的响应式更新

4. 事件处理：
   - 右键菜单事件
   - 双击文件事件
   - 打开方式选择事件

#### 接口定义
```typescript
interface FileOpenManager {
  // 获取文件的默认打开方式
  getDefaultEditor(filePath: string): 'built-in';
  
  // 设置文件类型的默认打开方式
  setDefaultEditor(extension: string, editor: 'built-in'): void;
  
  // 使用指定方式打开文件
  openFile(filePath: string, editor?: 'built-in'): void;
}

interface FileListContextMenu {
  // 显示右键菜单
  show(x: number, y: number, file: FileInfo): void;
  
  // 隐藏右键菜单
  hide(): void;
  
  // 处理菜单项选择
  onMenuItemSelect(action: string, file: FileInfo): void;
}
```

### 8. FileList与FileEditor集成

#### 组件关系
```
应用程序/
├── FileBrowser/           # 文件浏览器窗口
│   └── FileList/         # 文件列表模块
│       ├── FileList.tsx  # 文件列表组件
│       └── core/
│           └── FileOpenManager.ts  # 打开方式管理
└── FileEditor/           # 独立的编辑器窗口
    ├── index.ts         # 入口文件
    └── core/
        └── FileEditorManager.ts
```

#### 集成流程
1. 在主进程中添加新窗口创建逻辑：
```typescript
// main/services/window.ts
interface CreateEditorWindowOptions {
  file: FileEntry;
  sessionInfo: SessionInfo;
}

class WindowManager {
  // 创建编辑器窗口
  createEditorWindow(options: CreateEditorWindowOptions): BrowserWindow {
    const win = new BrowserWindow({
      width: 1024,
      height: 768,
      title: `编辑器 - ${options.file.name}`,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // 加载编辑器页面
    win.loadURL(`file://${__dirname}/editor.html`);
    
    // 传递文件信息
    win.webContents.on('did-finish-load', () => {
      win.webContents.send('init-editor', options);
    });

    return win;
  }
}
```

2. 在渲染进程中处理文件打开：
```typescript
// renderer/components/FileBrowser/FileList/FileList.tsx
const handleFileOpen = async (file: FileEntry) => {
  // 通过IPC调用主进程打开新窗口
  ipcRenderer.send('open-editor', {
    file,
    sessionInfo,
    connectionId
  });
};
```

3. 文件打开流程：
```
FileList双击文件
    ↓
发送IPC消息到主进程
    ↓
主进程创建新窗口
    ↓
加载编辑器页面
    ↓
初始化编辑器并加载文件
```

#### 窗口通信
```typescript
// IPC事件定义
interface IPCEvents {
  // 主进程 -> 渲染进程
  'init-editor': {
    file: FileEntry;
    sessionInfo: SessionInfo;
  };
  
  // 渲染进程 -> 主进程
  'open-editor': {
    file: FileEntry;
    sessionInfo: SessionInfo;
    connectionId: string;
  };
  
  // 编辑器状态事件
  'editor-file-saved': {
    file: FileEntry;
  };
}
```

#### 编辑器窗口
- 独立的窗口进程
- 包含完整的编辑器功能
- 支持多窗口打开
- 窗口间状态独立

#### 状态管理
- 每个编辑器窗口维护自己的状态
- 通过IPC与主进程通信
- 支持窗口关闭时保存状态

#### 用户界面
- 独立的编辑器窗口
- 窗口标题显示文件名
- 支持窗口大小调整
- 支持窗口最大化/最小化