# 文件下载功能技术实现方案

## 🔧 技术架构详解

### 为什么不使用第三方下载组件？

#### 1. 现有技术栈充分
项目已经集成了完整的SSH/SFTP技术栈：
- `ssh2`: SSH2协议实现
- `ssh2-sftp-client`: SFTP客户端
- `better-sqlite3`: 本地数据存储
- `electron`: 文件系统访问

#### 2. 深度集成优势
- **无缝对接**: 直接使用现有SFTP连接，无需额外认证
- **状态共享**: 与文件浏览器共享连接状态和会话信息
- **错误统一**: 统一的错误处理和用户反馈机制

#### 3. 自主可控
- **定制化**: 完全按照项目需求定制功能
- **性能优化**: 针对SSH场景优化传输策略
- **安全性**: 避免第三方组件的安全风险

## 📊 核心实现原理

### 1. SFTP流式下载
```typescript
// 基于ssh2-sftp-client的流式下载实现
async function downloadFileStream(
  sftpClient: SFTPClient,
  remotePath: string,
  localPath: string,
  onProgress: (progress: DownloadProgress) => void
): Promise<void> {
  const readStream = sftpClient.createReadStream(remotePath);
  const writeStream = fs.createWriteStream(localPath);
  
  let transferred = 0;
  const startTime = Date.now();
  
  readStream.on('data', (chunk: Buffer) => {
    transferred += chunk.length;
    const elapsed = Date.now() - startTime;
    const speed = transferred / (elapsed / 1000);
    
    onProgress({
      transferred,
      speed,
      percentage: (transferred / totalSize) * 100
    });
  });
  
  return pipeline(readStream, writeStream);
}
```

### 2. 断点续传机制
```typescript
// 检查本地文件大小，实现断点续传
async function resumeDownload(
  sftpClient: SFTPClient,
  remotePath: string,
  localPath: string,
  totalSize: number
): Promise<void> {
  let startPosition = 0;
  
  if (fs.existsSync(localPath)) {
    const stats = fs.statSync(localPath);
    startPosition = stats.size;
    
    // 验证远程文件是否发生变化
    const remoteStats = await sftpClient.stat(remotePath);
    if (remoteStats.size !== totalSize) {
      throw new Error('远程文件已发生变化，无法续传');
    }
  }
  
  const readStream = sftpClient.createReadStream(remotePath, {
    start: startPosition
  });
  const writeStream = fs.createWriteStream(localPath, {
    flags: 'a' // 追加模式
  });
  
  return pipeline(readStream, writeStream);
}
```

### 3. 进度计算算法
```typescript
class ProgressCalculator {
  private samples: Array<{time: number, bytes: number}> = [];
  private readonly maxSamples = 10;
  
  updateProgress(transferredBytes: number): DownloadProgress {
    const now = Date.now();
    this.samples.push({time: now, bytes: transferredBytes});
    
    // 保持样本数量
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }
    
    // 计算平均速度
    const speed = this.calculateAverageSpeed();
    
    // 估算剩余时间
    const remainingBytes = this.totalSize - transferredBytes;
    const remainingTime = speed > 0 ? remainingBytes / speed : 0;
    
    return {
      transferred: transferredBytes,
      total: this.totalSize,
      percentage: (transferredBytes / this.totalSize) * 100,
      speed,
      remainingTime,
      eta: new Date(Date.now() + remainingTime * 1000)
    };
  }
  
  private calculateAverageSpeed(): number {
    if (this.samples.length < 2) return 0;
    
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    
    const timeDiff = (last.time - first.time) / 1000; // 秒
    const bytesDiff = last.bytes - first.bytes;
    
    return timeDiff > 0 ? bytesDiff / timeDiff : 0;
  }
}
```

## 🏗️ 组件实现架构

### 1. 主进程IPC处理器
```typescript
// src/main/ipc/download.ts
export class DownloadIPCHandler {
  private downloadTasks = new Map<string, DownloadTask>();
  
  async startDownload(config: DownloadConfig): Promise<string> {
    const taskId = uuidv4();
    const task = new DownloadTask(taskId, config);
    
    this.downloadTasks.set(taskId, task);
    
    // 开始下载
    task.start().catch(error => {
      this.notifyError(taskId, error);
    });
    
    return taskId;
  }
  
  async pauseDownload(taskId: string): Promise<void> {
    const task = this.downloadTasks.get(taskId);
    if (task) {
      await task.pause();
    }
  }
  
  private notifyProgress(taskId: string, progress: DownloadProgress): void {
    // 发送进度更新到渲染进程
    BrowserWindow.getAllWindows().forEach(window => {
      window.webContents.send('download-progress', {taskId, progress});
    });
  }
}
```

### 2. 渲染进程下载服务
```typescript
// src/renderer/services/downloadService.ts
export class DownloadService {
  private tasks = new Map<string, DownloadTaskState>();
  private eventEmitter = new EventEmitter();
  
  async startDownload(file: FileEntry, config: DownloadConfig): Promise<string> {
    // 显示下载对话框
    const userConfig = await this.showDownloadDialog(file, config);
    if (!userConfig) return '';
    
    // 调用主进程开始下载
    const taskId = await ipcRenderer.invoke('download:start', {
      file,
      config: userConfig,
      sessionId: config.sessionId
    });
    
    // 创建本地任务状态
    this.tasks.set(taskId, {
      id: taskId,
      file,
      config: userConfig,
      status: 'downloading',
      progress: {
        transferred: 0,
        total: file.size,
        percentage: 0,
        speed: 0,
        remainingTime: 0
      }
    });
    
    // 显示进度通知
    this.showProgressNotification(taskId);
    
    return taskId;
  }
  
  private showDownloadDialog(file: FileEntry, config: DownloadConfig): Promise<DownloadConfig | null> {
    return new Promise((resolve) => {
      const dialog = Modal.confirm({
        title: '下载文件',
        content: <DownloadDialog file={file} config={config} />,
        onOk: (userConfig) => resolve(userConfig),
        onCancel: () => resolve(null)
      });
    });
  }
}
```

### 3. React组件实现
```typescript
// src/renderer/components/Download/DownloadDialog.tsx
export const DownloadDialog: React.FC<DownloadDialogProps> = ({
  file,
  config,
  onConfirm,
  onCancel
}) => {
  const [savePath, setSavePath] = useState(config.defaultPath);
  const [fileName, setFileName] = useState(file.name);
  const [overwrite, setOverwrite] = useState(false);
  const [openFolder, setOpenFolder] = useState(true);
  
  const handleBrowse = async () => {
    const result = await ipcRenderer.invoke('dialog:show-save-dialog', {
      defaultPath: path.join(savePath, fileName),
      filters: [
        { name: '所有文件', extensions: ['*'] }
      ]
    });
    
    if (!result.canceled) {
      setSavePath(path.dirname(result.filePath));
      setFileName(path.basename(result.filePath));
    }
  };
  
  const handleConfirm = () => {
    onConfirm({
      ...config,
      savePath,
      fileName,
      overwrite,
      openFolder
    });
  };
  
  return (
    <div className="download-dialog">
      <div className="file-info">
        <h3>{file.name}</h3>
        <p>大小: {formatFileSize(file.size)}</p>
        <p>来源: {file.path}</p>
      </div>
      
      <div className="save-config">
        <div className="path-selector">
          <Input
            value={savePath}
            onChange={(e) => setSavePath(e.target.value)}
            addonAfter={<Button onClick={handleBrowse}>浏览...</Button>}
          />
        </div>
        
        <div className="filename-input">
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
          />
        </div>
        
        <div className="options">
          <Checkbox
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
          >
            覆盖同名文件
          </Checkbox>
          
          <Checkbox
            checked={openFolder}
            onChange={(e) => setOpenFolder(e.target.checked)}
          >
            下载完成后打开文件夹
          </Checkbox>
        </div>
      </div>
      
      <div className="dialog-actions">
        <Button onClick={onCancel}>取消</Button>
        <Button type="primary" onClick={handleConfirm}>开始下载</Button>
      </div>
    </div>
  );
};
```

## 🎯 性能优化策略

### 1. 内存管理
- **流式处理**: 使用Stream避免大文件占用过多内存
- **缓冲区控制**: 限制读写缓冲区大小
- **垃圾回收**: 及时释放不需要的对象引用

### 2. 网络优化
- **并发控制**: 限制同时下载任务数量
- **重试机制**: 网络异常时自动重试
- **超时处理**: 设置合理的超时时间

### 3. 用户体验优化
- **进度平滑**: 使用移动平均算法平滑进度显示
- **响应式更新**: 限制UI更新频率避免卡顿
- **后台下载**: 支持最小化到系统托盘继续下载

## 🔒 安全考虑

### 1. 路径安全
- **路径验证**: 防止路径遍历攻击
- **权限检查**: 验证目标目录写入权限
- **文件名过滤**: 过滤非法字符

### 2. 传输安全
- **连接复用**: 使用现有安全连接
- **数据完整性**: 下载完成后校验文件大小
- **错误处理**: 安全地处理传输错误

---

**技术负责人**: AI Assistant  
**文档版本**: v1.0  
**最后更新**: 2024-12-22
