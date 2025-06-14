# 外部编辑器功能实现计划

## 实现概述

基于现有的文件浏览器架构，添加外部编辑器功能。采用模块化设计，复用现有的SFTP服务、事件总线和配置管理框架。重点关注用户体验和操作便利性。

## 详细实现步骤

### 步骤1：创建配置管理器 (ExternalEditorConfig.ts)

#### 文件位置
```
src/renderer/components/FileBrowser/ExternalEditor/config/ExternalEditorConfig.ts
```

#### 核心代码结构
```typescript
import { BaseConfig } from '../../../services/config/BaseConfig';
import * as path from 'path';
import * as os from 'os';

interface ExternalEditorSettings {
  editors: EditorConfig[];
  defaultEditor?: string;
  openMode: 'ask' | 'default' | 'remember';
  autoUpload: boolean;
  uploadDelay: number;
  tempDirectory: string;
  fileAssociations: { [extension: string]: string };
  rememberChoices: boolean;
}

interface EditorConfig {
  id: string;
  name: string;
  executablePath: string;
  arguments?: string;
  icon?: string;
  isDefault?: boolean;
  addedTime: number;
}

export class ExternalEditorConfigManager extends BaseConfig<ExternalEditorSettings> {
  protected getDefaultConfig(): ExternalEditorSettings {
    return {
      editors: [],
      openMode: 'ask',
      autoUpload: true,
      uploadDelay: 2000,
      tempDirectory: path.join(os.tmpdir(), 'ssh-editor'),
      fileAssociations: {},
      rememberChoices: true
    };
  }
  
  protected getConfigFileName(): string {
    return 'external-editor-config.json';
  }
  
  // 编辑器管理方法
  addEditor(name: string, executablePath: string, args?: string): string;
  removeEditor(editorId: string): void;
  updateEditor(editorId: string, updates: Partial<EditorConfig>): void;
  getEditors(): EditorConfig[];
  setDefaultEditor(editorId: string): void;
  
  // 文件关联方法
  setFileAssociation(extension: string, editorId: string): void;
  getEditorForFile(fileName: string): EditorConfig | undefined;
  clearFileAssociation(extension: string): void;
}
```

#### 实现要点
- 继承BaseConfig类，复用配置管理基础设施
- 提供编辑器的增删改查功能
- 支持文件扩展名关联
- 自动生成唯一的编辑器ID

### 步骤2：创建类型定义文件

#### 文件位置
```
src/renderer/components/FileBrowser/ExternalEditor/types/ExternalEditorTypes.ts
```

#### 核心类型定义
```typescript
export interface EditorConfig {
  id: string;
  name: string;
  executablePath: string;
  arguments?: string;
  icon?: string;
  isDefault?: boolean;
  addedTime: number;
}

export interface ActiveEditorSession {
  id: string;
  file: FileEntry;
  sessionInfo: SessionInfo;
  tabId: string;
  editor: EditorConfig;
  tempFilePath: string;
  editorProcess?: ChildProcess;
  lastModified: number;
  isUploading: boolean;
  uploadTimer?: NodeJS.Timeout;
}

export interface ExternalEditorSettings {
  editors: EditorConfig[];
  defaultEditor?: string;
  openMode: 'ask' | 'default' | 'remember';
  autoUpload: boolean;
  uploadDelay: number;
  tempDirectory: string;
  fileAssociations: { [extension: string]: string };
  rememberChoices: boolean;
}

export type OpenMode = 'ask' | 'default' | 'remember';
```

### 步骤3：创建临时文件管理器

#### 文件位置
```
src/renderer/components/FileBrowser/ExternalEditor/core/TempFileManager.ts
```

#### 核心功能
```typescript
export class TempFileManager {
  private tempDir: string;
  private activeTempFiles: Map<string, string> = new Map();

  constructor(tempDir: string) {
    this.tempDir = tempDir;
    this.ensureTempDirectory();
  }

  async downloadFile(session: ActiveEditorSession): Promise<void> {
    // 1. 生成临时文件路径
    // 2. 使用SFTP服务下载文件
    // 3. 保存到临时目录
    // 4. 记录文件信息
  }

  async uploadFile(session: ActiveEditorSession): Promise<void> {
    // 1. 读取本地临时文件
    // 2. 使用SFTP服务上传到服务器
    // 3. 更新文件修改时间
  }

  async cleanupTempFile(sessionId: string): Promise<void> {
    // 1. 删除临时文件
    // 2. 清理记录
  }

  private getTempFilePath(file: FileEntry, sessionId: string): string {
    // 生成唯一的临时文件路径
  }
}
```

### 步骤4：创建文件监控器

#### 文件位置
```
src/renderer/components/FileBrowser/ExternalEditor/core/FileWatcher.ts
```

#### 核心功能
```typescript
import * as chokidar from 'chokidar';

export class FileWatcher {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private uploadTimers: Map<string, NodeJS.Timeout> = new Map();

  startWatching(session: ActiveEditorSession): void {
    // 1. 创建文件监控器
    // 2. 监听文件变化事件
    // 3. 设置防抖上传机制
  }

  private async handleFileChange(session: ActiveEditorSession): Promise<void> {
    // 1. 检查文件是否真的被修改
    // 2. 清除之前的上传定时器
    // 3. 设置延迟上传
    // 4. 显示上传状态通知
  }

  stopWatching(sessionId: string): void {
    // 1. 停止文件监控
    // 2. 清理定时器
  }
}
```

### 步骤5：创建核心管理器

#### 文件位置
```
src/renderer/components/FileBrowser/ExternalEditor/core/ExternalEditorManager.ts
```

#### 核心功能
```typescript
export class ExternalEditorManager {
  private configManager: ExternalEditorConfigManager;
  private tempFileManager: TempFileManager;
  private fileWatcher: FileWatcher;
  private activeEditors: Map<string, ActiveEditorSession>;

  async openFileWithExternalEditor(
    file: FileEntry,
    sessionInfo: SessionInfo,
    tabId: string,
    editorId?: string
  ): Promise<void> {
    // 1. 选择编辑器（如果未指定）
    // 2. 创建编辑会话
    // 3. 下载文件到临时目录
    // 4. 启动外部编辑器
    // 5. 开始监控文件变化
  }

  private async selectEditor(file: FileEntry): Promise<EditorConfig | null> {
    // 1. 检查文件关联
    // 2. 显示编辑器选择对话框
    // 3. 记住用户选择（如果启用）
  }

  private async launchEditor(session: ActiveEditorSession): Promise<void> {
    // 1. 构建启动命令
    // 2. 使用child_process启动编辑器
    // 3. 处理启动错误
  }
}
```

### 步骤6：创建编辑器配置对话框

#### 文件位置
```
src/renderer/components/FileBrowser/ExternalEditor/components/EditorConfigDialog.tsx
```

#### 界面功能
- 显示已配置的编辑器列表
- 添加、编辑、删除编辑器
- 设置默认编辑器
- 配置打开模式和自动上传选项
- 管理临时文件目录

#### 核心组件结构
```typescript
interface EditorConfigDialogProps {
  visible: boolean;
  onClose: () => void;
}

export const EditorConfigDialog: React.FC<EditorConfigDialogProps> = ({
  visible,
  onClose
}) => {
  // 状态管理
  const [editors, setEditors] = useState<EditorConfig[]>([]);
  const [settings, setSettings] = useState<ExternalEditorSettings>();
  
  // 编辑器操作
  const handleAddEditor = () => { /* 显示添加编辑器对话框 */ };
  const handleEditEditor = (editor: EditorConfig) => { /* 编辑编辑器 */ };
  const handleDeleteEditor = (editorId: string) => { /* 删除编辑器 */ };
  const handleSetDefault = (editorId: string) => { /* 设为默认 */ };
  
  // 设置操作
  const handleSettingsChange = (key: string, value: any) => { /* 更新设置 */ };
  const handleSave = () => { /* 保存配置 */ };
  
  return (
    <Modal title="外部编辑器设置" open={visible} onCancel={onClose}>
      {/* 编辑器列表 */}
      {/* 操作按钮 */}
      {/* 设置选项 */}
    </Modal>
  );
};
```

### 步骤7：创建添加编辑器对话框

#### 文件位置
```
src/renderer/components/FileBrowser/ExternalEditor/components/AddEditorDialog.tsx
```

#### 界面功能
- 输入编辑器名称
- 选择可执行文件路径
- 设置启动参数
- 设为默认编辑器选项

### 步骤8：创建编辑器选择对话框

#### 文件位置
```
src/renderer/components/FileBrowser/ExternalEditor/components/EditorSelectorDialog.tsx
```

#### 界面功能
- 显示可用编辑器列表
- 选择编辑器
- 记住文件类型选择选项
- 显示操作说明

### 步骤9：集成到FileList组件

#### 修改FileList.tsx
```typescript
// 添加外部编辑器状态
const [editorConfigVisible, setEditorConfigVisible] = useState(false);

// 添加外部编辑器回调
const handleExternalEditorRequest = useCallback((files: FileEntry[]) => {
  if (files.length === 1) {
    externalEditorManager.openFileWithExternalEditor(
      files[0], 
      sessionInfo!, 
      tabId
    );
  }
}, [sessionInfo, tabId]);

// 添加编辑器配置回调
const handleEditorConfigRequest = useCallback(() => {
  setEditorConfigVisible(true);
}, []);
```

#### 修改FileListContextMenu.tsx
```typescript
// 添加外部编辑器菜单项
{
  key: 'open-external',
  label: '外部编辑器',
  disabled: selectedFiles.length !== 1 || selectedFiles[0].isDirectory,
  onClick: () => {
    onExternalEditorRequest?.(selectedFiles);
    onClose();
  }
},
{
  key: 'set-editor',
  label: '设置外部编辑器',
  onClick: () => {
    onEditorConfigRequest?.();
    onClose();
  }
}
```

### 步骤10：添加状态通知组件

#### 文件位置
```
src/renderer/components/FileBrowser/ExternalEditor/components/EditingStatusNotification.tsx
```

#### 功能
- 显示文件下载状态
- 显示编辑器启动状态
- 显示文件上传状态和结果
- 提供重试和取消操作

## 实现顺序

### 第一阶段：基础框架 (1-2天)
1. 创建配置管理器和类型定义
2. 实现编辑器配置对话框
3. 实现添加编辑器功能
4. 基础的编辑器管理功能

### 第二阶段：核心功能 (2-3天)
1. 实现临时文件管理器
2. 实现文件下载和上传逻辑
3. 实现编辑器启动功能
4. 实现编辑器选择对话框

### 第三阶段：文件监控 (1-2天)
1. 实现文件变化监控
2. 实现自动上传功能
3. 添加上传状态通知
4. 实现会话管理和清理

### 第四阶段：集成和优化 (1天)
1. 集成到FileList和右键菜单
2. 实现文件关联记忆功能
3. 添加错误处理和用户反馈
4. 界面优化和用户体验改进

## 技术要点

### 文件操作
- 使用现有的sftpService进行文件传输
- 使用fs-extra进行本地文件操作
- 使用path模块处理文件路径

### 进程管理
- 使用child_process.spawn启动编辑器
- 设置detached: true允许编辑器独立运行
- 使用process.unref()避免阻塞主进程

### 文件监控
- 使用chokidar库监控文件变化
- 实现防抖机制避免频繁上传
- 监控文件修改时间判断真实变化

### 配置管理
- 继承BaseConfig复用配置基础设施
- 使用JSON格式存储配置
- 支持配置的导入导出

### 错误处理
- 编辑器启动失败的友好提示
- 文件传输失败的重试机制
- 网络异常的优雅处理

## 用户体验优化

### 操作便利性
- 右键菜单直接访问外部编辑器
- 记住用户的编辑器选择偏好
- 一键配置常用编辑器

### 状态反馈
- 清晰的下载、编辑、上传状态提示
- 进度指示和完成通知
- 错误信息的详细说明

### 智能功能
- 根据文件扩展名推荐编辑器
- 自动检测文件变化并上传
- 临时文件的自动清理

这个实现计划提供了完整的外部编辑器功能开发路线图，重点关注用户体验和操作便利性，确保功能的实用性和稳定性。
