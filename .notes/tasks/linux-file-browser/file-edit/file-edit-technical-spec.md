# 远程文件编辑器技术规格说明书

## 一、项目定位

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
- **运行环境**: Electron + Node.js
- **前端框架**: React 18 + TypeScript
- **编辑器核心**: Monaco Editor
- **远程连接**: SSH2 + SFTP
- **状态管理**: MobX
- **构建工具**: Webpack 5

### 2. 关键依赖包
```json
{
  "dependencies": {
    "electron": "^28.0.0",        // Electron 运行环境
    "monaco-editor": "^0.45.0",   // 代码编辑器核心
    "ssh2": "^1.15.0",           // SSH/SFTP 客户端
    "mobx": "^6.12.0",           // 状态管理
    "mobx-react": "^9.1.0",      // React 状态绑定
    "iconv-lite": "^0.6.3",      // 字符编码转换
    "jschardet": "^3.0.0"        // 编码检测
  }
}
```

## 三、核心模块设计

### 1. 远程会话管理
```typescript
interface ISessionManager {
  // 创建新的远程会话
  createSession(config: SSHConfig): Promise<string>;
  
  // 获取现有会话
  getSession(sessionId: string): Session;
  
  // 关闭会话
  closeSession(sessionId: string): Promise<void>;
  
  // 会话状态管理
  isConnected(sessionId: string): boolean;
  reconnect(sessionId: string): Promise<void>;
}

interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}
```

### 2. 远程文件管理
```typescript
interface IRemoteFileManager {
  // 文件读写
  readFile(sessionId: string, path: string, start?: number, length?: number): Promise<Buffer>;
  writeFile(sessionId: string, path: string, content: string): Promise<void>;
  
  // 文件信息
  stat(sessionId: string, path: string): Promise<FileStat>;
  
  // 文件锁定
  lockFile(sessionId: string, path: string): Promise<void>;
  unlockFile(sessionId: string, path: string): Promise<void>;
  isLocked(sessionId: string, path: string): boolean;
}

interface FileStat {
  size: number;
  modifyTime: number;
  isDirectory: boolean;
  permissions: number;
}
```

### 3. 文件监控管理
```typescript
interface IFileWatchManager {
  // 开始监控（使用 tail -f）
  startWatch(sessionId: string, filePath: string): Promise<void>;
  
  // 停止监控
  stopWatch(): void;
  
  // 事件监听
  onFileChanged(callback: (content: string) => void): void;
  onError(callback: (error: Error) => void): void;
}
```

### 4. 编辑器管理
```typescript
interface IEditorManager {
  // 编辑器初始化
  initialize(container: HTMLElement, options: EditorOptions): void;
  
  // 内容管理
  setValue(content: string): void;
  getValue(): string;
  
  // 编码处理
  setEncoding(encoding: string): void;
  detectEncoding(content: Buffer): string;
  
  // 状态管理
  isDirty(): boolean;
  save(): Promise<void>;
}
```

## 四、性能优化策略

### 1. 远程文件处理
- SFTP 连接池管理
- 文件分块加载（默认块大小 1MB）
- 本地缓存策略
- 压缩传输

### 2. 大文件支持
- 虚拟滚动技术
- 动态加载和卸载
- 内存使用限制
- 后台预加载

### 3. 网络优化
- 断点续传
- 请求队列管理
- 失败重试机制
- 连接保活

## 五、错误处理

### 1. 错误类型
```typescript
enum RemoteFileError {
  // 连接错误
  CONNECTION_LOST = 'CONNECTION_LOST',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  
  // 文件错误
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_PERMISSION_DENIED = 'FILE_PERMISSION_DENIED',
  FILE_LOCKED = 'FILE_LOCKED',
  
  // 网络错误
  NETWORK_ERROR = 'NETWORK_ERROR',
  SFTP_ERROR = 'SFTP_ERROR',
  SSH_ERROR = 'SSH_ERROR',
  
  // 编码错误
  ENCODING_ERROR = 'ENCODING_ERROR'
}
```

### 2. 错误恢复策略
- 自动重连机制
- 编辑内容本地备份
- 错误状态恢复
- 用户操作重试

## 六、安全考虑

### 1. 认证安全
- SSH 密钥管理
- 密码加密存储
- 会话超时处理

### 2. 数据安全
- 本地缓存加密
- 传输数据加密
- 临时文件清理

### 3. 权限控制
- 文件权限检查
- 操作权限验证
- 会话权限管理

## 七、用户体验

### 1. 编辑功能
- 代码高亮
- 自动补全
- 代码折叠
- 查找替换
- 多光标编辑

### 2. 状态反馈
- 连接状态显示
- 加载进度提示
- 错误信息展示
- 操作结果反馈

### 3. 实时特性
- 文件变更提示
- 自动保存选项
- 实时预览
- 协同编辑支持