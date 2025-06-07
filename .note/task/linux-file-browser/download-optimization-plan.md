# 文件下载性能优化方案

## 📋 优化目标

将当前下载速度提升 **3-8倍**，特别是对于可压缩文件（源代码、日志、配置文件等），同时保持用户体验的流畅性。

## 🎯 核心优化策略

### 1. 智能压缩传输（主要优化）
**原理**：下载前自动判断文件类型，对可压缩文件进行压缩传输，用户无感知
**预期提升**：文本文件 5-8倍，二进制文件 1.2-2倍

### 2. 并行分块下载
**原理**：大文件分块并行下载，最后合并
**预期提升**：大文件 2-4倍

### 3. 连接复用优化
**原理**：复用现有SSH连接，减少握手开销
**预期提升**：小文件 1.5-2倍

### 4. 动态缓冲区调整
**原理**：根据文件大小和网络状况动态调整传输块大小
**预期提升**：整体 1.2-1.5倍

## 🏗️ 技术实现方案

### 方案一：智能压缩传输（优先级：高）

#### 1.1 压缩策略选择
```typescript
interface CompressionStrategy {
  enabled: boolean;
  method: 'gzip' | 'bzip2' | 'xz' | 'none';
  command: string;
  extension: string;
  threshold: number; // 最小文件大小阈值
}

function selectCompressionStrategy(file: FileEntry): CompressionStrategy {
  const ext = path.extname(file.name).toLowerCase();
  const size = file.size;
  
  // 高压缩比文件类型
  const highCompressible = ['.txt', '.js', '.ts', '.json', '.xml', '.html', 
                           '.css', '.md', '.log', '.conf', '.sql', '.csv'];
  
  // 中等压缩比文件类型
  const mediumCompressible = ['.py', '.java', '.cpp', '.c', '.h', '.php'];
  
  // 不适合压缩的文件类型
  const nonCompressible = ['.jpg', '.png', '.gif', '.mp4', '.zip', '.gz', 
                          '.rar', '.7z', '.exe', '.bin'];
  
  if (nonCompressible.includes(ext) || size < 1024) {
    return { enabled: false, method: 'none', command: 'cat', extension: '', threshold: 0 };
  }
  
  if (highCompressible.includes(ext)) {
    if (size > 50 * 1024 * 1024) { // 50MB以上用最高压缩
      return { 
        enabled: true, 
        method: 'xz', 
        command: 'tar -Jcf -', 
        extension: '.tar.xz',
        threshold: 1024 
      };
    } else {
      return { 
        enabled: true, 
        method: 'gzip', 
        command: 'tar -czf -', 
        extension: '.tar.gz',
        threshold: 1024 
      };
    }
  }
  
  if (mediumCompressible.includes(ext)) {
    return { 
      enabled: true, 
      method: 'gzip', 
      command: 'tar -czf -', 
      extension: '.tar.gz',
      threshold: 2048 
    };
  }
  
  // 默认策略：尝试轻量压缩
  return { 
    enabled: size > 10 * 1024, // 10KB以上才压缩
    method: 'gzip', 
    command: 'tar -czf -', 
    extension: '.tar.gz',
    threshold: 10240 
  };
}
```

#### 1.2 压缩下载流程
```typescript
// 主进程实现
async performCompressedDownload(taskInfo: DownloadTaskInfo): Promise<void> {
  const { file, config, taskId } = taskInfo;
  const strategy = selectCompressionStrategy(file);
  
  try {
    // 1. 检查远程文件是否存在
    const remoteExists = await sftpManager.exists(connectionId, file.path);
    if (!remoteExists) {
      throw new Error('远程文件不存在');
    }
    
    // 2. 生成临时文件名
    const tempCompressedName = `download_${taskId}${strategy.extension}`;
    const remoteTempPath = `/tmp/${tempCompressedName}`;
    
    // 3. 在远程服务器执行压缩
    const compressCommand = `${strategy.command} "${remoteTempPath}" "${file.path}"`;
    await sftpManager.executeCommand(connectionId, compressCommand);
    
    // 4. 获取压缩后文件大小
    const compressedStats = await sftpManager.stat(connectionId, remoteTempPath);
    const compressedSize = compressedStats.size;
    
    // 5. 更新任务信息（显示压缩后的大小用于进度计算）
    taskInfo.compressedSize = compressedSize;
    taskInfo.originalSize = file.size;
    
    // 6. 下载压缩文件
    await this.downloadCompressedFile(taskInfo, remoteTempPath);
    
    // 7. 本地解压
    await this.extractCompressedFile(taskInfo, strategy);
    
    // 8. 清理远程临时文件
    await sftpManager.deleteFile(connectionId, remoteTempPath);
    
  } catch (error) {
    console.warn('压缩下载失败，降级到普通下载:', error);
    // 降级到普通下载
    await this.performNormalDownload(taskInfo);
  }
}
```

#### 1.3 本地解压实现
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async extractCompressedFile(taskInfo: DownloadTaskInfo, strategy: CompressionStrategy): Promise<void> {
  const { tempPath, localPath } = taskInfo;
  const targetDir = path.dirname(localPath);
  const fileName = path.basename(localPath);
  
  try {
    // 确保目标目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // 根据压缩方法选择解压命令
    let extractCommand: string;
    switch (strategy.method) {
      case 'gzip':
        extractCommand = `tar -xzf "${tempPath}" -C "${targetDir}"`;
        break;
      case 'bzip2':
        extractCommand = `tar -xjf "${tempPath}" -C "${targetDir}"`;
        break;
      case 'xz':
        extractCommand = `tar -xJf "${tempPath}" -C "${targetDir}"`;
        break;
      default:
        throw new Error(`不支持的压缩方法: ${strategy.method}`);
    }
    
    // 执行解压
    await execAsync(extractCommand);
    
    // 查找解压出的文件并重命名到目标位置
    const extractedFiles = fs.readdirSync(targetDir);
    const extractedFile = extractedFiles.find(f => f !== path.basename(tempPath));
    
    if (extractedFile) {
      const extractedPath = path.join(targetDir, extractedFile);
      if (extractedPath !== localPath) {
        fs.renameSync(extractedPath, localPath);
      }
    }
    
    // 删除压缩文件
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    
  } catch (error) {
    console.error('解压失败:', error);
    throw new Error(`文件解压失败: ${error.message}`);
  }
}
```

### 方案二：并行分块下载（优先级：中）

#### 2.1 分块策略
```typescript
interface ChunkStrategy {
  chunkSize: number;
  maxParallelChunks: number;
  enabled: boolean;
}

function selectChunkStrategy(file: FileEntry): ChunkStrategy {
  const size = file.size;
  
  // 小文件不分块
  if (size < 10 * 1024 * 1024) { // 10MB
    return { chunkSize: size, maxParallelChunks: 1, enabled: false };
  }
  
  // 中等文件
  if (size < 100 * 1024 * 1024) { // 100MB
    return { 
      chunkSize: 5 * 1024 * 1024, // 5MB块
      maxParallelChunks: 3, 
      enabled: true 
    };
  }
  
  // 大文件
  return { 
    chunkSize: 10 * 1024 * 1024, // 10MB块
    maxParallelChunks: 5, 
    enabled: true 
  };
}
```

#### 2.2 并行下载实现
```typescript
async performParallelDownload(taskInfo: DownloadTaskInfo): Promise<void> {
  const { file } = taskInfo;
  const strategy = selectChunkStrategy(file);
  
  if (!strategy.enabled) {
    return this.performNormalDownload(taskInfo);
  }
  
  const totalSize = file.size;
  const chunkSize = strategy.chunkSize;
  const chunks: Array<{start: number, end: number, index: number}> = [];
  
  // 计算分块
  for (let start = 0; start < totalSize; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, totalSize - 1);
    chunks.push({ start, end, index: chunks.length });
  }
  
  // 创建临时文件用于存储各个块
  const chunkFiles = chunks.map(chunk => 
    `${taskInfo.tempPath}.chunk${chunk.index}`
  );
  
  try {
    // 并行下载所有块
    await Promise.all(
      chunks.map((chunk, index) => 
        this.downloadChunk(taskInfo, chunk, chunkFiles[index])
      )
    );
    
    // 合并所有块
    await this.mergeChunks(chunkFiles, taskInfo.tempPath);
    
    // 清理临时块文件
    chunkFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    
  } catch (error) {
    // 清理失败的块文件
    chunkFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    });
    throw error;
  }
}
```

### 方案三：连接复用优化（优先级：中）

#### 3.1 连接池管理
```typescript
class SFTPConnectionPool {
  private connections = new Map<string, SFTPConnection>();
  private lastUsed = new Map<string, number>();
  private readonly maxIdleTime = 5 * 60 * 1000; // 5分钟
  
  async getConnection(sessionId: string): Promise<SFTPConnection> {
    const connectionId = `sftp-${sessionId}`;
    
    // 检查现有连接
    if (this.connections.has(connectionId)) {
      const connection = this.connections.get(connectionId)!;
      if (connection.isConnected()) {
        this.lastUsed.set(connectionId, Date.now());
        return connection;
      } else {
        // 连接已断开，移除
        this.connections.delete(connectionId);
        this.lastUsed.delete(connectionId);
      }
    }
    
    // 创建新连接
    const connection = await this.createConnection(sessionId);
    this.connections.set(connectionId, connection);
    this.lastUsed.set(connectionId, Date.now());
    
    return connection;
  }
  
  // 定期清理空闲连接
  startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [connectionId, lastUsed] of this.lastUsed.entries()) {
        if (now - lastUsed > this.maxIdleTime) {
          const connection = this.connections.get(connectionId);
          if (connection) {
            connection.disconnect();
            this.connections.delete(connectionId);
            this.lastUsed.delete(connectionId);
          }
        }
      }
    }, 60 * 1000); // 每分钟检查一次
  }
}
```

### 方案四：动态缓冲区调整（优先级：低）

#### 4.1 自适应块大小
```typescript
class AdaptiveBufferManager {
  private speedHistory: number[] = [];
  private currentChunkSize = 256 * 1024; // 初始256KB
  private readonly minChunkSize = 64 * 1024;   // 最小64KB
  private readonly maxChunkSize = 2 * 1024 * 1024; // 最大2MB
  
  updateSpeed(bytesTransferred: number, timeElapsed: number): void {
    const speed = bytesTransferred / (timeElapsed / 1000); // bytes/second
    this.speedHistory.push(speed);
    
    // 只保留最近10次的速度记录
    if (this.speedHistory.length > 10) {
      this.speedHistory.shift();
    }
    
    this.adjustChunkSize();
  }
  
  private adjustChunkSize(): void {
    if (this.speedHistory.length < 3) return;
    
    const avgSpeed = this.speedHistory.reduce((a, b) => a + b) / this.speedHistory.length;
    const recentSpeed = this.speedHistory[this.speedHistory.length - 1];
    
    // 如果最近速度比平均速度快，增加块大小
    if (recentSpeed > avgSpeed * 1.2) {
      this.currentChunkSize = Math.min(
        this.currentChunkSize * 1.5, 
        this.maxChunkSize
      );
    }
    // 如果最近速度比平均速度慢，减少块大小
    else if (recentSpeed < avgSpeed * 0.8) {
      this.currentChunkSize = Math.max(
        this.currentChunkSize * 0.7, 
        this.minChunkSize
      );
    }
  }
  
  getCurrentChunkSize(): number {
    return Math.floor(this.currentChunkSize);
  }
}
```

## 📊 性能预期

### 优化前后对比

| 文件类型 | 文件大小 | 当前速度 | 优化后速度 | 提升倍数 | 主要优化手段 |
|---------|---------|---------|-----------|---------|-------------|
| 源代码项目 | 100MB | 2MB/s | 12-16MB/s | 6-8x | 智能压缩 |
| 日志文件 | 50MB | 2MB/s | 10-15MB/s | 5-7.5x | 智能压缩 |
| 配置文件 | 10MB | 2MB/s | 8-12MB/s | 4-6x | 智能压缩 |
| 大型二进制 | 500MB | 2MB/s | 6-8MB/s | 3-4x | 并行分块 |
| 小型二进制 | 5MB | 2MB/s | 3-4MB/s | 1.5-2x | 连接复用 |
| 图片/视频 | 100MB | 2MB/s | 3-4MB/s | 1.5-2x | 并行分块 |

### 网络环境适应性

| 网络条件 | 延迟 | 带宽 | 推荐策略 | 预期提升 |
|---------|------|------|---------|---------|
| 局域网 | <5ms | >100Mbps | 大块+并行 | 3-5x |
| 高速互联网 | 20-50ms | 10-100Mbps | 压缩+中块 | 4-8x |
| 普通宽带 | 50-100ms | 1-10Mbps | 压缩优先 | 5-10x |
| 移动网络 | 100-300ms | 1-5Mbps | 压缩+小块 | 3-6x |

## 🚀 实施计划

### Phase 1: 智能压缩传输（Week 1-2）
- [x] 设计压缩策略选择算法
- [x] 实现远程压缩命令执行
- [x] 实现本地解压功能
- [x] 添加降级机制
- [x] 集成到现有下载流程

### Phase 2: 用户界面优化（Week 2）
- [x] 下载对话框添加压缩选项
- [x] 进度显示优化（显示压缩进度）

### Phase 3: 并行分块下载（Week 3）
- [ ] 实现文件分块算法
- [ ] 实现并行下载逻辑
- [ ] 实现块合并功能
- [x] 添加断点续传支持（之前已实现）


### Phase 5: 性能调优（Week 4）
- [ ] 实现自适应缓冲区


## 🔧 技术依赖

### 新增依赖
```json
{
  "tar": "^6.1.11",           // tar文件处理
  "node-stream-zip": "^1.15.0" // 备用解压方案
}
```

### 系统要求
- **远程服务器**: 支持tar命令（几乎所有Linux发行版都支持）
- **本地系统**: Node.js 16+，支持child_process
- **网络**: 稳定的SSH连接

## 📋 测试计划

### 功能测试
- [ ] 各种文件类型的压缩下载测试
- [ ] 大文件并行下载测试
- [ ] 网络中断恢复测试
- [ ] 错误降级测试

### 性能测试
- [ ] 不同文件大小的速度对比
- [ ] 不同网络环境的适应性测试
- [ ] 内存和CPU使用率测试
- [ ] 并发下载压力测试

### 兼容性测试
- [ ] 不同Linux发行版兼容性
- [ ] 不同SSH服务器兼容性
- [ ] Windows/macOS客户端兼容性

## 🎛️ 用户界面设计

### 下载对话框增强
```typescript
// DownloadDialog.tsx 新增选项
interface DownloadDialogState {
  // 现有选项
  savePath: string;
  fileName: string;
  overwrite: boolean;
  openFolder: boolean;

  // 新增优化选项
  useCompression: boolean;
  compressionMethod: 'auto' | 'gzip' | 'bzip2' | 'xz' | 'none';
  useParallelDownload: boolean;
  maxParallelChunks: number;
  showAdvancedOptions: boolean;
}

// UI组件
<Collapse>
  <Panel header="下载优化选项" key="optimization">
    <Space direction="vertical" style={{ width: '100%' }}>
      <Checkbox
        checked={useCompression}
        onChange={(e) => setUseCompression(e.target.checked)}
      >
        <Tooltip title="自动压缩文件以提升传输速度，特别适合文本文件">
          智能压缩传输（推荐）
        </Tooltip>
      </Checkbox>

      {useCompression && (
        <Select
          value={compressionMethod}
          onChange={setCompressionMethod}
          style={{ width: 200 }}
        >
          <Option value="auto">自动选择最佳压缩</Option>
          <Option value="gzip">快速压缩 (gzip)</Option>
          <Option value="bzip2">平衡压缩 (bzip2)</Option>
          <Option value="xz">最高压缩 (xz)</Option>
          <Option value="none">不压缩</Option>
        </Select>
      )}

      <Checkbox
        checked={useParallelDownload}
        onChange={(e) => setUseParallelDownload(e.target.checked)}
        disabled={file.size < 10 * 1024 * 1024} // 小于10MB禁用
      >
        <Tooltip title="大文件分块并行下载，提升传输速度">
          并行分块下载（大文件推荐）
        </Tooltip>
      </Checkbox>
    </Space>
  </Panel>
</Collapse>
```

### 进度显示增强
```typescript
// DownloadProgress.tsx 增强版本
interface EnhancedDownloadProgress {
  // 基础进度信息
  transferred: number;
  total: number;
  percentage: number;
  speed: number;
  remainingTime: number;

  // 优化相关信息
  compressionEnabled: boolean;
  compressionRatio?: number; // 压缩比
  originalSize?: number;     // 原始文件大小
  parallelChunks?: number;   // 并行块数
  activeChunks?: number;     // 活跃块数

  // 性能统计
  averageSpeed: number;
  peakSpeed: number;
  networkEfficiency: number; // 网络利用率
}

// 进度显示组件
<div className="enhanced-progress">
  <Progress
    percent={percentage}
    status={status}
    strokeColor={{
      '0%': '#108ee9',
      '100%': '#87d068',
    }}
  />

  <div className="progress-details">
    <Row gutter={16}>
      <Col span={8}>
        <Statistic
          title="当前速度"
          value={speed}
          formatter={(value) => `${formatSpeed(value)}`}
          prefix={<CloudDownloadOutlined />}
        />
      </Col>
      <Col span={8}>
        <Statistic
          title="剩余时间"
          value={remainingTime}
          formatter={(value) => formatTime(value)}
          prefix={<ClockCircleOutlined />}
        />
      </Col>
      <Col span={8}>
        <Statistic
          title="网络效率"
          value={networkEfficiency}
          suffix="%"
          prefix={<WifiOutlined />}
        />
      </Col>
    </Row>

    {compressionEnabled && compressionRatio && (
      <div className="compression-info">
        <Tag color="green">
          压缩节省 {((1 - compressionRatio) * 100).toFixed(1)}% 传输量
        </Tag>
      </div>
    )}

    {parallelChunks && parallelChunks > 1 && (
      <div className="parallel-info">
        <Tag color="blue">
          {activeChunks}/{parallelChunks} 个分块并行下载
        </Tag>
      </div>
    )}
  </div>
</div>
```

## 🔍 监控和诊断

### 性能监控
```typescript
class DownloadPerformanceMonitor {
  private metrics = new Map<string, PerformanceMetrics>();

  interface PerformanceMetrics {
    taskId: string;
    startTime: number;
    endTime?: number;

    // 文件信息
    originalSize: number;
    compressedSize?: number;
    finalSize: number;

    // 传输统计
    totalBytesTransferred: number;
    averageSpeed: number;
    peakSpeed: number;

    // 优化效果
    compressionRatio?: number;
    timeWithoutOptimization: number; // 估算的未优化传输时间
    timeSaved: number;

    // 错误统计
    retryCount: number;
    errorCount: number;
    fallbackUsed: boolean;
  }

  startMonitoring(taskId: string, file: FileEntry): void {
    this.metrics.set(taskId, {
      taskId,
      startTime: Date.now(),
      originalSize: file.size,
      finalSize: file.size,
      totalBytesTransferred: 0,
      averageSpeed: 0,
      peakSpeed: 0,
      timeWithoutOptimization: file.size / (2 * 1024 * 1024), // 假设2MB/s基准速度
      timeSaved: 0,
      retryCount: 0,
      errorCount: 0,
      fallbackUsed: false
    });
  }

  updateProgress(taskId: string, transferred: number, speed: number): void {
    const metrics = this.metrics.get(taskId);
    if (!metrics) return;

    metrics.totalBytesTransferred = transferred;
    metrics.peakSpeed = Math.max(metrics.peakSpeed, speed);

    const elapsed = (Date.now() - metrics.startTime) / 1000;
    metrics.averageSpeed = transferred / elapsed;
  }

  recordCompressionEffect(taskId: string, originalSize: number, compressedSize: number): void {
    const metrics = this.metrics.get(taskId);
    if (!metrics) return;

    metrics.compressedSize = compressedSize;
    metrics.compressionRatio = compressedSize / originalSize;

    // 计算节省的时间
    const baseTransferTime = originalSize / (2 * 1024 * 1024); // 2MB/s基准
    const actualTransferTime = compressedSize / metrics.averageSpeed;
    metrics.timeSaved = Math.max(0, baseTransferTime - actualTransferTime);
  }

  finishMonitoring(taskId: string): PerformanceMetrics | null {
    const metrics = this.metrics.get(taskId);
    if (!metrics) return null;

    metrics.endTime = Date.now();

    // 生成性能报告
    this.generatePerformanceReport(metrics);

    return metrics;
  }

  private generatePerformanceReport(metrics: PerformanceMetrics): void {
    const report = {
      taskId: metrics.taskId,
      duration: (metrics.endTime! - metrics.startTime) / 1000,
      averageSpeed: metrics.averageSpeed,
      peakSpeed: metrics.peakSpeed,
      compressionSavings: metrics.compressionRatio ?
        `${((1 - metrics.compressionRatio) * 100).toFixed(1)}%` : 'N/A',
      timeSaved: `${metrics.timeSaved.toFixed(1)}s`,
      efficiency: `${((metrics.averageSpeed / (2 * 1024 * 1024)) * 100).toFixed(1)}%`
    };

    console.log('下载性能报告:', report);

    // 可选：发送到分析服务
    // this.sendToAnalytics(report);
  }
}
```

## 🛠️ 配置管理

### 用户偏好设置
```typescript
interface DownloadOptimizationSettings {
  // 压缩设置
  compressionEnabled: boolean;
  autoCompressionDetection: boolean;
  preferredCompressionMethod: 'auto' | 'gzip' | 'bzip2' | 'xz';
  compressionThreshold: number; // 最小文件大小

  // 并行下载设置
  parallelDownloadEnabled: boolean;
  maxParallelChunks: number;
  parallelThreshold: number; // 启用并行的最小文件大小

  // 网络设置
  adaptiveChunkSize: boolean;
  initialChunkSize: number;
  maxChunkSize: number;
  minChunkSize: number;

  // 连接设置
  connectionPoolEnabled: boolean;
  maxIdleTime: number;
  connectionTimeout: number;

  // 高级设置
  enablePerformanceMonitoring: boolean;
  enableFallbackMechanisms: boolean;
  aggressiveOptimization: boolean;
}

// 默认配置
const defaultSettings: DownloadOptimizationSettings = {
  compressionEnabled: true,
  autoCompressionDetection: true,
  preferredCompressionMethod: 'auto',
  compressionThreshold: 1024, // 1KB

  parallelDownloadEnabled: true,
  maxParallelChunks: 4,
  parallelThreshold: 10 * 1024 * 1024, // 10MB

  adaptiveChunkSize: true,
  initialChunkSize: 256 * 1024, // 256KB
  maxChunkSize: 2 * 1024 * 1024, // 2MB
  minChunkSize: 64 * 1024, // 64KB

  connectionPoolEnabled: true,
  maxIdleTime: 5 * 60 * 1000, // 5分钟
  connectionTimeout: 30 * 1000, // 30秒

  enablePerformanceMonitoring: true,
  enableFallbackMechanisms: true,
  aggressiveOptimization: false
};
```

## 📈 A/B测试框架

### 优化效果验证
```typescript
class OptimizationABTesting {
  private testGroups = ['control', 'compression', 'parallel', 'full'];
  private currentGroup: string;

  constructor() {
    // 随机分配测试组或根据用户设置
    this.currentGroup = this.assignTestGroup();
  }

  private assignTestGroup(): string {
    const random = Math.random();
    if (random < 0.25) return 'control';      // 25% 不优化
    if (random < 0.5) return 'compression';   // 25% 仅压缩
    if (random < 0.75) return 'parallel';     // 25% 仅并行
    return 'full';                            // 25% 全部优化
  }

  getOptimizationConfig(file: FileEntry): OptimizationConfig {
    switch (this.currentGroup) {
      case 'control':
        return { compression: false, parallel: false, adaptive: false };
      case 'compression':
        return { compression: true, parallel: false, adaptive: false };
      case 'parallel':
        return { compression: false, parallel: true, adaptive: true };
      case 'full':
        return { compression: true, parallel: true, adaptive: true };
      default:
        return { compression: true, parallel: true, adaptive: true };
    }
  }

  recordTestResult(taskId: string, metrics: PerformanceMetrics): void {
    const result = {
      testGroup: this.currentGroup,
      taskId,
      fileSize: metrics.originalSize,
      duration: (metrics.endTime! - metrics.startTime) / 1000,
      averageSpeed: metrics.averageSpeed,
      compressionRatio: metrics.compressionRatio,
      timeSaved: metrics.timeSaved
    };

    // 存储测试结果用于分析
    this.storeTestResult(result);
  }

  private storeTestResult(result: any): void {
    // 存储到本地或发送到分析服务
    const results = JSON.parse(localStorage.getItem('abTestResults') || '[]');
    results.push(result);
    localStorage.setItem('abTestResults', JSON.stringify(results));
  }
}
```

---

**创建时间**: 2024-12-22
**预计完成**: 2025-01-26
**负责人**: AI Assistant
**优先级**: 高
