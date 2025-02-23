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
└── // ... 其他现有的FileBrowser模块
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

### 2. 错误处理策略
- 文件不存在：提示并允许重试
- 权限错误：提示并请求权限
- 编码错误：尝试自动检测编码
- 内存超限：自动清理并提示
- 过滤错误：提示并允许修改过滤条件

