# 上传功能技术实现方案

## 🏗️ 技术架构

### 1. 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    渲染进程 (Renderer)                        │
├─────────────────────────────────────────────────────────────┤
│ UI Components                                               │
│ ├── UploadDialog          ├── TransferManager               │
│ ├── UploadDropZone        ├── TransferHistory               │
│ └── TransferProgress      └── TransferNotification          │
├─────────────────────────────────────────────────────────────┤
│ Services Layer                                              │
│ ├── TransferService (基类)                                  │
│ ├── UploadService (继承)                                    │
│ └── DownloadService (重构继承)                               │
├─────────────────────────────────────────────────────────────┤
│ IPC Communication                                          │
│ └── ipcRenderer.invoke('upload:*', data)                   │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                     主进程 (Main)                           │
├─────────────────────────────────────────────────────────────┤
│ IPC Handlers                                               │
│ ├── upload.ts             ├── transfer.ts                  │
│ └── download.ts (现有)     └── 统一传输处理                  │
├─────────────────────────────────────────────────────────────┤
│ Upload Services                                            │
│ ├── CompressionUploadService                               │
│ ├── ParallelUploadService                                  │
│ └── BasicUploadService                                     │
├─────────────────────────────────────────────────────────────┤
│ SFTP/SSH Connection                                        │
│ └── sftpManager                                            │
└─────────────────────────────────────────────────────────────┘
```

### 2. 数据流设计

```
用户操作 → UploadDialog → UploadService → IPC → 主进程 → SFTP → 远程服务器
    ↑                                                              │
    └── 进度回调 ← TransferProgress ← 事件系统 ← IPC ← 进度更新 ←──┘
```

## 📊 数据结构设计

### 1. 统一传输任务接口

```typescript
// 基础传输任务接口
interface BaseTransferTask {
  id: string;
  type: 'download' | 'upload';
  status: TransferStatus;
  progress: TransferProgress;
  config: TransferConfig;
  error?: string;
  startTime?: Date;
  endTime?: Date;
  retryCount?: number;
  maxRetries?: number;
  // 优化相关
  compressionEnabled?: boolean;
  parallelEnabled?: boolean;
  maxParallelChunks?: number;
  optimizationUsed?: string[];
}

// 下载任务（向后兼容）
interface DownloadTask extends BaseTransferTask {
  type: 'download';
  file: FileEntry;
  config: DownloadConfig;
}

// 上传任务
interface UploadTask extends BaseTransferTask {
  type: 'upload';
  localFiles: File[];
  config: UploadConfig;
  // 上传特有字段
  totalFiles: number;
  completedFiles: number;
  currentFile?: File;
  remotePath: string;
}

// 统一传输任务类型
type TransferTask = DownloadTask | UploadTask;
```

### 2. 配置接口设计

```typescript
// 基础传输配置
interface BaseTransferConfig {
  sessionId: string;
  overwrite: boolean;
  // 优化选项
  useCompression?: boolean;
  compressionMethod?: 'auto' | 'gzip' | 'bzip2' | 'xz' | 'none';
  useParallelTransfer?: boolean;
  maxParallelChunks?: number;
}

// 下载配置（保持兼容）
interface DownloadConfig extends BaseTransferConfig {
  savePath: string;
  fileName: string;
  openFolder: boolean;
}

// 上传配置
interface UploadConfig extends BaseTransferConfig {
  remotePath: string;
  preservePermissions: boolean;
  createDirectories?: boolean;  // 自动创建目录
  conflictResolution?: 'overwrite' | 'skip' | 'rename'; // 冲突处理
}
```

### 3. 进度信息接口

```typescript
interface TransferProgress {
  transferred: number;
  total: number;
  percentage: number;
  speed: number;
  remainingTime: number;
  eta?: Date;
  
  // 压缩相关
  compressionPhase?: 'compressing' | 'transferring' | 'extracting';
  originalSize?: number;
  compressedSize?: number;
  compressionRatio?: number;
  
  // 并行传输相关
  transferChunks?: TransferChunk[];
  activeChunks?: number;
  
  // 上传特有进度
  currentFileIndex?: number;
  currentFileName?: string;
  filesCompleted?: number;
  filesTotal?: number;
}
```

## 🔧 服务层实现

### 1. TransferService 基类

```typescript
export abstract class TransferService extends EventEmitter {
  protected tasks = new Map<string, TransferTask>();
  protected maxConcurrentTransfers = 3;
  protected transferQueue: string[] = [];
  protected activeTransfers = new Set<string>();

  // 抽象方法，子类实现
  abstract startTransfer(config: any): Promise<string>;
  
  // 通用方法
  async pauseTransfer(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || !this.canPause(task.status)) return;
    
    await this.sendIPCCommand('pause', taskId);
    this.updateTaskStatus(taskId, 'paused');
  }

  async resumeTransfer(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'paused') return;
    
    await this.sendIPCCommand('resume', taskId);
    this.updateTaskStatus(taskId, this.getActiveStatus());
  }

  async cancelTransfer(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    await this.sendIPCCommand('cancel', taskId);
    this.updateTaskStatus(taskId, 'cancelled');
    this.activeTransfers.delete(taskId);
    this.processQueue();
  }

  getAllTasks(): TransferTask[] {
    return Array.from(this.tasks.values());
  }

  getTasksByType(type: 'download' | 'upload'): TransferTask[] {
    return this.getAllTasks().filter(task => task.type === type);
  }

  // 抽象方法
  protected abstract sendIPCCommand(command: string, taskId: string, data?: any): Promise<any>;
  protected abstract getActiveStatus(): TransferStatus;
  protected abstract canPause(status: TransferStatus): boolean;
}
```

### 2. UploadService 实现

```typescript
export class UploadService extends TransferService {
  private static instance: UploadService;

  static getInstance(): UploadService {
    if (!UploadService.instance) {
      UploadService.instance = new UploadService();
    }
    return UploadService.instance;
  }

  async startUpload(files: File[], config: UploadConfig): Promise<string> {
    const taskId = uuidv4();
    
    // 创建上传任务
    const task: UploadTask = {
      id: taskId,
      type: 'upload',
      localFiles: files,
      config,
      status: 'pending',
      progress: this.createInitialProgress(files),
      startTime: new Date(),
      retryCount: 0,
      maxRetries: 3,
      totalFiles: files.length,
      completedFiles: 0,
      remotePath: config.remotePath,
      // 优化选项
      compressionEnabled: config.useCompression,
      parallelEnabled: config.useParallelTransfer,
      maxParallelChunks: config.maxParallelChunks || 4
    };

    this.tasks.set(taskId, task);
    this.addToQueue(taskId);
    
    return taskId;
  }

  protected async sendIPCCommand(command: string, taskId: string, data?: any): Promise<any> {
    const { ipcRenderer } = window.require('electron');
    return await ipcRenderer.invoke(`upload:${command}`, taskId, data);
  }

  protected getActiveStatus(): TransferStatus {
    return 'uploading';
  }

  protected canPause(status: TransferStatus): boolean {
    return status === 'uploading';
  }

  private createInitialProgress(files: File[]): TransferProgress {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    return {
      transferred: 0,
      total: totalSize,
      percentage: 0,
      speed: 0,
      remainingTime: 0,
      filesCompleted: 0,
      filesTotal: files.length,
      currentFileIndex: 0,
      currentFileName: files[0]?.name
    };
  }
}
```

### 3. DownloadService 重构

```typescript
export class DownloadService extends TransferService {
  // 保持现有API不变，内部重构继承TransferService
  
  async startDownload(file: FileEntry, config: DownloadConfig): Promise<string> {
    // 现有实现保持不变，但内部使用统一的TransferTask
    return this.startTransfer({ file, config });
  }

  protected async sendIPCCommand(command: string, taskId: string, data?: any): Promise<any> {
    const { ipcRenderer } = window.require('electron');
    return await ipcRenderer.invoke(`download:${command}`, taskId, data);
  }

  protected getActiveStatus(): TransferStatus {
    return 'downloading';
  }

  protected canPause(status: TransferStatus): boolean {
    return status === 'downloading';
  }
}
```

## 🔌 IPC 通信设计

### 1. 上传 IPC 处理器

```typescript
// src/main/ipc/upload.ts
export class UploadIPCHandler {
  private tasks = new Map<string, UploadTaskInfo>();

  async startUpload(taskId: string, files: File[], config: UploadConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // 创建任务信息
      const taskInfo: UploadTaskInfo = {
        id: taskId,
        files,
        config,
        status: 'uploading',
        abortController: new AbortController(),
        startTime: new Date()
      };

      this.tasks.set(taskId, taskInfo);

      // 根据配置选择上传策略
      if (config.useCompression && config.useParallelTransfer) {
        await this.performCompressedParallelUpload(taskInfo);
      } else if (config.useCompression) {
        await this.performCompressedUpload(taskInfo);
      } else if (config.useParallelTransfer) {
        await this.performParallelUpload(taskInfo);
      } else {
        await this.performBasicUpload(taskInfo);
      }

      return { success: true };
    } catch (error) {
      console.error('上传启动失败:', error);
      return { success: false, error: error.message };
    }
  }

  async pauseUpload(taskId: string): Promise<void> {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      taskInfo.abortController?.abort();
      taskInfo.status = 'paused';
      this.notifyPaused(taskId);
    }
  }

  async resumeUpload(taskId: string): Promise<void> {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo && taskInfo.status === 'paused') {
      // 重新创建 AbortController
      taskInfo.abortController = new AbortController();
      taskInfo.status = 'uploading';
      
      // 从断点位置恢复上传
      await this.resumeFromBreakpoint(taskInfo);
    }
  }

  async cancelUpload(taskId: string): Promise<void> {
    const taskInfo = this.tasks.get(taskId);
    if (taskInfo) {
      taskInfo.abortController?.abort();
      this.tasks.delete(taskId);
      this.notifyCancelled(taskId);
    }
  }

  private async performBasicUpload(taskInfo: UploadTaskInfo): Promise<void> {
    // 基础上传实现
    for (let i = 0; i < taskInfo.files.length; i++) {
      const file = taskInfo.files[i];
      
      // 更新当前文件信息
      this.updateCurrentFile(taskInfo.id, i, file.name);
      
      // 上传单个文件
      await this.uploadSingleFile(taskInfo, file, i);
      
      // 更新完成文件数
      this.updateCompletedFiles(taskInfo.id, i + 1);
    }
    
    this.handleUploadCompleted(taskInfo.id);
  }

  private async uploadSingleFile(taskInfo: UploadTaskInfo, file: File, fileIndex: number): Promise<void> {
    const remotePath = path.join(taskInfo.config.remotePath, file.name);
    const connectionId = `sftp-${taskInfo.config.sessionId}`;
    
    try {
      // 使用 SFTP 上传文件
      await sftpManager.uploadFile(
        connectionId,
        file.path, // 本地文件路径
        remotePath,
        {
          onProgress: (transferred, total) => {
            this.updateFileProgress(taskInfo.id, fileIndex, transferred, total);
          },
          abortSignal: taskInfo.abortController?.signal
        }
      );
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error; // 重新抛出取消错误
      }
      throw new Error(`上传文件 ${file.name} 失败: ${error.message}`);
    }
  }
}
```

### 2. IPC 事件注册

```typescript
// src/main/ipc/index.ts
export function registerUploadHandlers(): void {
  const uploadHandler = new UploadIPCHandler();

  ipcMain.handle('upload:start', async (event, data: {
    taskId: string;
    files: File[];
    config: UploadConfig;
  }) => {
    return await uploadHandler.startUpload(data.taskId, data.files, data.config);
  });

  ipcMain.handle('upload:pause', async (event, taskId: string) => {
    await uploadHandler.pauseUpload(taskId);
  });

  ipcMain.handle('upload:resume', async (event, taskId: string) => {
    await uploadHandler.resumeUpload(taskId);
  });

  ipcMain.handle('upload:cancel', async (event, taskId: string) => {
    await uploadHandler.cancelUpload(taskId);
  });
}
```

## 🚀 优化功能实现

### 1. 压缩上传服务

```typescript
// src/main/services/compressionUploadService.ts
export class CompressionUploadService {
  static async performCompressedUpload(options: CompressionUploadOptions): Promise<void> {
    const { taskId, files, config, onProgress, abortSignal } = options;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 第一阶段：本地压缩 (0% - 20%)
      onProgress?.(0, file.size, 'compressing', i);
      const compressedPath = await this.compressLocalFile(file, config.compressionMethod);
      
      if (abortSignal?.aborted) {
        await this.cleanupTempFile(compressedPath);
        return;
      }
      
      // 第二阶段：上传压缩文件 (20% - 90%)
      onProgress?.(file.size * 0.2, file.size, 'transferring', i);
      await this.uploadCompressedFile(compressedPath, config, (transferred, total) => {
        const adjustedProgress = file.size * 0.2 + (transferred / total) * file.size * 0.7;
        onProgress?.(adjustedProgress, file.size, 'transferring', i);
      }, abortSignal);
      
      // 第三阶段：远程解压 (90% - 100%)
      onProgress?.(file.size * 0.9, file.size, 'extracting', i);
      await this.extractRemoteFile(config, file.name);
      onProgress?.(file.size, file.size, 'completed', i);
      
      // 清理临时文件
      await this.cleanupTempFile(compressedPath);
    }
  }
}
```

### 2. 并行上传服务

```typescript
// src/main/services/parallelUploadService.ts
export class ParallelUploadService {
  static async performParallelUpload(options: ParallelUploadOptions): Promise<void> {
    const { taskId, files, config, maxParallelChunks, onProgress, abortSignal } = options;
    
    for (const file of files) {
      if (file.size < 10 * 1024 * 1024) {
        // 小文件直接上传
        await this.uploadSingleFile(file, config, onProgress, abortSignal);
      } else {
        // 大文件分块并行上传
        await this.uploadFileInChunks(file, config, maxParallelChunks, onProgress, abortSignal);
      }
    }
  }

  private static async uploadFileInChunks(
    file: File,
    config: UploadConfig,
    maxChunks: number,
    onProgress?: ProgressCallback,
    abortSignal?: AbortSignal
  ): Promise<void> {
    const chunkSize = Math.ceil(file.size / maxChunks);
    const chunks: UploadChunk[] = [];
    
    // 创建分块
    for (let i = 0; i < maxChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      
      chunks.push({
        id: i,
        start,
        end,
        size: end - start,
        uploaded: 0,
        status: 'pending',
        retryCount: 0
      });
    }
    
    // 并行上传分块
    const uploadPromises = chunks.map(chunk => 
      this.uploadChunk(file, chunk, config, onProgress, abortSignal)
    );
    
    await Promise.all(uploadPromises);
    
    // 合并远程文件
    await this.mergeRemoteChunks(file, chunks, config);
  }
}
```

## 📱 前端集成

### 1. 文件浏览器集成

```typescript
// 在文件浏览器中添加上传按钮和右键菜单
const handleUpload = () => {
  setUploadDialogVisible(true);
};

const contextMenuItems = [
  // ... 现有菜单项
  {
    key: 'upload',
    icon: <UploadOutlined />,
    label: '上传文件',
    onClick: handleUpload
  }
];
```

### 2. 拖拽上传集成

```typescript
// 在文件浏览器中集成拖拽上传
const handleDrop = (e: React.DragEvent) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer.files);
  
  if (files.length > 0) {
    setSelectedFiles(files);
    setUploadDialogVisible(true);
  }
};

return (
  <div 
    onDrop={handleDrop}
    onDragOver={(e) => e.preventDefault()}
    className="file-browser"
  >
    {/* 文件浏览器内容 */}
  </div>
);
```

## 🧪 测试策略

### 1. 单元测试
- TransferService 基类测试
- UploadService 功能测试
- 组件渲染和交互测试

### 2. 集成测试
- IPC 通信测试
- 文件上传流程测试
- 错误处理测试

### 3. 性能测试
- 大文件上传测试
- 并发上传测试
- 内存使用监控

## 📋 开发检查清单

### 阶段1：基础架构
- [ ] 创建 TransferService 基类
- [ ] 重构 DownloadService 继承 TransferService
- [ ] 定义统一的 TransferTask 接口
- [ ] 创建 UploadService 类
- [ ] 实现基础 IPC 通信

### 阶段2：核心组件
- [ ] 重构 TransferHistory 组件
- [ ] 重构 TransferManager 组件
- [ ] 重构 TransferProgress 组件
- [ ] 创建 UploadDialog 组件
- [ ] 创建 UploadDropZone 组件

### 阶段3：高级功能
- [ ] 实现压缩上传服务
- [ ] 实现并行上传服务
- [ ] 添加断点续传支持
- [ ] 集成拖拽上传功能
- [ ] 完善错误处理机制

### 阶段4：集成优化
- [ ] 文件浏览器集成
- [ ] 快捷键和工具栏支持
- [ ] 性能优化和测试
- [ ] 文档更新和完善

## 🎯 质量保证

### 代码质量
- 遵循现有代码规范
- 完善的 TypeScript 类型定义
- 充分的错误处理
- 清晰的注释和文档

### 用户体验
- 与下载功能保持一致的交互体验
- 流畅的动画和过渡效果
- 及时的状态反馈
- 友好的错误提示

### 性能要求
- 支持大文件上传（>1GB）
- 内存使用控制在合理范围
- 响应时间 < 100ms
- 支持并发上传任务
