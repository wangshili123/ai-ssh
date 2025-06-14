# 外部编辑器功能设计方案

## 项目概述

为AI SSH Tool添加外部编辑器功能，让用户可以使用Windows中的任何编辑器来编辑远程文件。采用FinalShell的思路：自动下载到本地 → 用外部编辑器打开 → 保存后自动上传回服务器。

## 功能需求

### 核心功能
1. **编辑器配置管理**：用户可以添加、配置和管理多个外部编辑器
2. **文件自动下载**：选择外部编辑器打开时，自动下载文件到本地临时目录
3. **编辑器启动**：使用指定的外部编辑器打开下载的文件
4. **文件监控上传**：监控文件变化，保存后自动上传回服务器
5. **配置持久化**：永久保存编辑器配置和用户偏好

### 用户体验设计
- **简单配置**：通过文件浏览器选择编辑器可执行文件
- **智能记忆**：记住用户对不同文件类型的编辑器选择
- **状态提示**：清晰的下载、编辑、上传状态反馈
- **一键操作**：右键菜单直接选择"外部编辑器打开"

## 架构设计

### 组件结构
```
ExternalEditor/
├── config/
│   └── ExternalEditorConfig.ts (配置管理器，参考AIConfigManager)
├── core/
│   ├── ExternalEditorManager.ts (核心管理器)
│   ├── TempFileManager.ts (临时文件管理)
│   └── FileWatcher.ts (文件变化监控)
├── components/
│   ├── EditorConfigDialog.tsx (编辑器配置对话框)
│   ├── EditorSelectorDialog.tsx (编辑器选择对话框)
│   └── EditingStatusDialog.tsx (编辑状态提示对话框)
└── types/
    └── ExternalEditorTypes.ts (类型定义)
```

### 数据流设计
1. **配置阶段**: 用户添加编辑器 → 选择可执行文件 → 保存配置
2. **打开阶段**: 右键选择外部编辑器 → 选择具体编辑器 → 下载文件 → 启动编辑器
3. **编辑阶段**: 监控文件变化 → 检测保存操作 → 自动上传到服务器
4. **完成阶段**: 编辑器关闭 → 清理临时文件 → 刷新文件列表

## 技术实现细节

### 配置管理器 (ExternalEditorConfig.ts)
```typescript
interface ExternalEditorSettings {
  editors: EditorConfig[];
  defaultEditor?: string;
  openMode: 'ask' | 'default' | 'remember';
  autoUpload: boolean;
  uploadDelay: number; // 保存后延迟上传时间(ms)
  tempDirectory: string;
  fileAssociations: { [extension: string]: string };
  rememberChoices: boolean;
}

interface EditorConfig {
  id: string;
  name: string;
  executablePath: string;
  arguments?: string; // 启动参数，如 "-n" 表示新窗口
  icon?: string; // 编辑器图标路径
  isDefault?: boolean;
  addedTime: number;
}

class ExternalEditorConfigManager extends BaseConfig<ExternalEditorSettings> {
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
  
  // 编辑器管理
  addEditor(name: string, executablePath: string, args?: string): string;
  removeEditor(editorId: string): void;
  updateEditor(editorId: string, updates: Partial<EditorConfig>): void;
  getEditors(): EditorConfig[];
  
  // 文件关联
  setFileAssociation(extension: string, editorId: string): void;
  getEditorForFile(fileName: string): EditorConfig | undefined;
  clearFileAssociation(extension: string): void;
}
```

### 核心管理器 (ExternalEditorManager.ts)
```typescript
class ExternalEditorManager {
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
    const editor = editorId ? 
      this.configManager.getEditor(editorId) : 
      await this.selectEditor(file);
    
    if (!editor) return;
    
    // 2. 创建编辑会话
    const session = await this.createEditorSession(file, sessionInfo, tabId, editor);
    
    // 3. 下载文件到临时目录
    await this.tempFileManager.downloadFile(session);
    
    // 4. 启动外部编辑器
    await this.launchEditor(session);
    
    // 5. 开始监控文件变化
    this.fileWatcher.startWatching(session);
  }

  private async selectEditor(file: FileEntry): Promise<EditorConfig | null> {
    // 检查是否有文件关联
    const associatedEditor = this.configManager.getEditorForFile(file.name);
    if (associatedEditor) return associatedEditor;
    
    // 显示编辑器选择对话框
    return await this.showEditorSelector(file);
  }

  private async launchEditor(session: ActiveEditorSession): Promise<void> {
    const { editor, tempFilePath } = session;
    const args = this.buildCommandArgs(editor, tempFilePath);
    
    // 使用child_process启动编辑器
    const process = spawn(editor.executablePath, args, {
      detached: true,
      stdio: 'ignore'
    });
    
    session.editorProcess = process;
    process.unref(); // 允许父进程退出
  }

  private buildCommandArgs(editor: EditorConfig, filePath: string): string[] {
    const args: string[] = [];
    
    // 添加用户自定义参数
    if (editor.arguments) {
      args.push(...editor.arguments.split(' ').filter(arg => arg.trim()));
    }
    
    // 添加文件路径
    args.push(filePath);
    
    return args;
  }
}

interface ActiveEditorSession {
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
```

### 临时文件管理器 (TempFileManager.ts)
```typescript
class TempFileManager {
  private tempDir: string;
  private activeTempFiles: Map<string, string> = new Map();

  constructor(tempDir: string) {
    this.tempDir = tempDir;
    this.ensureTempDirectory();
  }

  async downloadFile(session: ActiveEditorSession): Promise<void> {
    const { file, sessionInfo } = session;
    const tempFilePath = this.getTempFilePath(file, session.id);
    
    // 使用SFTP下载文件
    const content = await sftpService.readFile(sessionInfo.id, file.path);
    await fs.writeFile(tempFilePath, content);
    
    session.tempFilePath = tempFilePath;
    session.lastModified = (await fs.stat(tempFilePath)).mtime.getTime();
    
    this.activeTempFiles.set(session.id, tempFilePath);
  }

  async uploadFile(session: ActiveEditorSession): Promise<void> {
    const { tempFilePath, file, sessionInfo } = session;
    
    // 读取本地文件内容
    const content = await fs.readFile(tempFilePath);
    
    // 上传到服务器
    await sftpService.writeFile(sessionInfo.id, file.path, content.toString());
    
    // 更新最后修改时间
    session.lastModified = (await fs.stat(tempFilePath)).mtime.getTime();
  }

  async cleanupTempFile(sessionId: string): Promise<void> {
    const tempFilePath = this.activeTempFiles.get(sessionId);
    if (tempFilePath && await fs.pathExists(tempFilePath)) {
      await fs.remove(tempFilePath);
      this.activeTempFiles.delete(sessionId);
    }
  }

  private getTempFilePath(file: FileEntry, sessionId: string): string {
    const fileName = `${sessionId}_${file.name}`;
    return path.join(this.tempDir, fileName);
  }

  private async ensureTempDirectory(): Promise<void> {
    await fs.ensureDir(this.tempDir);
  }
}
```

### 文件监控器 (FileWatcher.ts)
```typescript
class FileWatcher {
  private watchers: Map<string, chokidar.FSWatcher> = new Map();
  private uploadTimers: Map<string, NodeJS.Timeout> = new Map();

  startWatching(session: ActiveEditorSession): void {
    const { id, tempFilePath } = session;
    
    const watcher = chokidar.watch(tempFilePath, {
      persistent: true,
      ignoreInitial: true
    });

    watcher.on('change', () => {
      this.handleFileChange(session);
    });

    this.watchers.set(id, watcher);
  }

  private async handleFileChange(session: ActiveEditorSession): Promise<void> {
    const { id, tempFilePath, lastModified } = session;
    
    // 检查文件是否真的被修改了
    const stats = await fs.stat(tempFilePath);
    if (stats.mtime.getTime() <= lastModified) return;
    
    // 清除之前的上传定时器
    const existingTimer = this.uploadTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // 设置延迟上传（避免频繁上传）
    const timer = setTimeout(async () => {
      try {
        session.isUploading = true;
        await this.tempFileManager.uploadFile(session);
        
        // 通知用户上传成功
        this.showUploadNotification(session.file.name, true);
        
        // 刷新文件列表
        eventBus.emit('file-uploaded', {
          tabId: session.tabId,
          fileName: session.file.name,
          filePath: session.file.path
        });
        
      } catch (error) {
        console.error('文件上传失败:', error);
        this.showUploadNotification(session.file.name, false, error.message);
      } finally {
        session.isUploading = false;
        this.uploadTimers.delete(id);
      }
    }, this.configManager.getConfig().uploadDelay);
    
    this.uploadTimers.set(id, timer);
  }

  stopWatching(sessionId: string): void {
    const watcher = this.watchers.get(sessionId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(sessionId);
    }
    
    const timer = this.uploadTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.uploadTimers.delete(sessionId);
    }
  }

  private showUploadNotification(fileName: string, success: boolean, error?: string): void {
    if (success) {
      message.success(`文件 ${fileName} 已自动上传到服务器`);
    } else {
      message.error(`文件 ${fileName} 上传失败: ${error}`);
    }
  }
}
```

## 用户界面设计

### 编辑器配置对话框
```
┌─────────────────────────────────────────┐
│ 外部编辑器设置                            │
├─────────────────────────────────────────┤
│ 已配置的编辑器:                          │
│ ┌─────────────────────────────────────┐ │
│ │ ✓ Visual Studio Code (默认)         │ │
│ │   C:\Users\...\Code.exe             │ │
│ │ ○ Notepad++                         │ │
│ │   C:\Program Files\Notepad++\...    │ │
│ │ ○ 记事本                            │ │
│ │   C:\Windows\System32\notepad.exe   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [添加编辑器] [编辑] [删除] [设为默认]     │
│                                         │
│ 打开模式:                               │
│ ○ 每次询问使用哪个编辑器                 │
│ ○ 使用默认编辑器                        │
│ ○ 根据文件类型记住选择                   │
│                                         │
│ 文件监控设置:                           │
│ ☑ 自动上传文件修改                       │
│ 上传延迟: [2000] 毫秒                   │
│                                         │
│ 临时文件目录:                           │
│ [C:\Temp\SSH-Editor] [浏览]             │
│                                         │
│              [确定] [取消]              │
└─────────────────────────────────────────┘
```

### 添加编辑器对话框
```
┌─────────────────────────────────────┐
│ 添加外部编辑器                        │
├─────────────────────────────────────┤
│ 编辑器名称:                          │
│ [Visual Studio Code            ]    │
│                                     │
│ 可执行文件路径:                      │
│ [C:\Users\...\Code.exe] [浏览...]   │
│                                     │
│ 启动参数 (可选):                     │
│ [-n                           ]    │
│ 提示: -n 表示新窗口打开              │
│                                     │
│ ☑ 设为默认编辑器                     │
│                                     │
│           [确定] [取消]              │
└─────────────────────────────────────┘
```

### 编辑器选择对话框
```
┌─────────────────────────────────────┐
│ 选择外部编辑器                        │
├─────────────────────────────────────┤
│ 文件: config.json                   │
│                                     │
│ 选择编辑器:                          │
│ ○ Visual Studio Code                │
│ ○ Notepad++                         │
│ ○ 记事本                            │
│                                     │
│ ☑ 记住 .json 文件的选择              │
│                                     │
│ 说明:                               │
│ • 文件将下载到本地临时目录            │
│ • 使用选择的编辑器打开               │
│ • 保存后自动上传到服务器             │
│                                     │
│           [打开] [取消]              │
└─────────────────────────────────────┘
```

## 文件结构

```
src/renderer/components/FileBrowser/ExternalEditor/
├── config/
│   └── ExternalEditorConfig.ts
├── core/
│   ├── ExternalEditorManager.ts
│   ├── TempFileManager.ts
│   └── FileWatcher.ts
├── components/
│   ├── EditorConfigDialog.tsx
│   ├── EditorConfigDialog.css
│   ├── AddEditorDialog.tsx
│   ├── EditorSelectorDialog.tsx
│   └── EditingStatusNotification.tsx
├── types/
│   └── ExternalEditorTypes.ts
└── index.ts
```

## 实现计划

### 第一阶段：配置管理 (1-2天)
1. 创建ExternalEditorConfig配置管理器
2. 实现编辑器配置对话框
3. 实现添加/编辑/删除编辑器功能
4. 集成到右键菜单

### 第二阶段：核心功能 (2-3天)
1. 实现TempFileManager临时文件管理
2. 实现文件下载和上传逻辑
3. 实现编辑器启动功能
4. 实现编辑器选择对话框

### 第三阶段：文件监控 (1-2天)
1. 实现FileWatcher文件变化监控
2. 实现自动上传功能
3. 添加上传状态通知
4. 实现临时文件清理

### 第四阶段：用户体验优化 (1天)
1. 添加文件关联记忆功能
2. 优化界面和交互体验
3. 添加错误处理和用户反馈
4. 完善配置选项

## 配置文件示例

```json
{
  "editors": [
    {
      "id": "vscode",
      "name": "Visual Studio Code",
      "executablePath": "C:\\Users\\...\\Microsoft VS Code\\Code.exe",
      "arguments": "-n",
      "isDefault": true,
      "addedTime": 1703123456789
    },
    {
      "id": "notepadpp",
      "name": "Notepad++",
      "executablePath": "C:\\Program Files\\Notepad++\\notepad++.exe",
      "addedTime": 1703123456790
    }
  ],
  "openMode": "remember",
  "autoUpload": true,
  "uploadDelay": 2000,
  "tempDirectory": "C:\\Temp\\SSH-Editor",
  "fileAssociations": {
    "js": "vscode",
    "ts": "vscode",
    "json": "vscode",
    "txt": "notepadpp"
  },
  "rememberChoices": true
}
```
