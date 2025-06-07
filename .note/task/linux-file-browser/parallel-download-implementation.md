# 并行下载和自适应缓冲区实现

## 实现概述

为了提升下载速度，我们实现了以下优化功能：

1. **文件分块算法** - 将大文件分割成多个块并行下载
2. **并行下载逻辑** - 多线程同时下载不同的文件块
3. **块合并功能** - 将下载的块合并成完整文件
4. **自适应缓冲区** - 根据网络速度动态调整块大小

## 核心组件

### 1. ParallelDownloadService (`src/main/services/parallelDownloadService.ts`)

**主要功能：**
- 文件分块策略
- 并行下载管理
- 自适应缓冲区调整
- 下载完整性验证

**关键特性：**
```typescript
// 自适应缓冲区配置
const DEFAULT_BUFFER_CONFIG = {
  initialChunkSize: 1024 * 1024, // 1MB 起始块大小
  minChunkSize: 256 * 1024,      // 256KB 最小块大小
  maxChunkSize: 8 * 1024 * 1024, // 8MB 最大块大小
  speedThreshold: 1024 * 1024,   // 1MB/s 速度阈值
  adjustmentFactor: 1.5          // 调整因子
};

// 最优并行数计算
static getOptimalParallelChunks(fileSize: number): number {
  if (fileSize < 10 * 1024 * 1024) return 1;  // <10MB: 单线程
  if (fileSize < 100 * 1024 * 1024) return 4; // <100MB: 4线程
  if (fileSize < 500 * 1024 * 1024) return 6; // <500MB: 6线程
  return 8; // 大文件: 8线程
}
```

### 2. 下载管理器集成 (`src/main/ipc/download.ts`)

**优化策略选择：**
1. **压缩下载** - 适用于文本文件和可压缩文件
2. **并行下载** - 适用于大文件（>10MB）
3. **自适应单线程** - 适用于小文件，动态调整块大小

**下载流程：**
```
开始下载
    ↓
检查压缩支持 → 压缩下载
    ↓
检查并行支持 → 并行下载
    ↓
自适应单线程下载
```

## 性能优化特性

### 1. 文件分块算法

**分块策略：**
- 根据文件大小和并行数计算块大小
- 每个块独立下载，支持断点续传
- 预分配文件空间，避免文件碎片

**实现细节：**
```typescript
private static createDownloadChunks(fileSize: number, maxChunks: number): DownloadChunk[] {
  const chunks: DownloadChunk[] = [];
  const chunkSize = Math.ceil(fileSize / maxChunks);

  for (let i = 0; i < maxChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize - 1, fileSize - 1);
    
    chunks.push({
      id: i,
      start,
      end,
      size: end - start + 1,
      downloaded: 0,
      status: 'pending',
      retryCount: 0
    });
  }
  return chunks;
}
```

### 2. 自适应缓冲区

**动态调整逻辑：**
- 监控下载速度
- 速度快时增加块大小（提高吞吐量）
- 速度慢时减少块大小（减少延迟）
- 在最小和最大块大小之间调整

**调整算法：**
```typescript
if (speed > speedThreshold) {
  // 速度快，增加块大小
  newChunkSize = Math.min(maxChunkSize, currentChunkSize * adjustmentFactor);
} else if (speed < speedThreshold / 2) {
  // 速度慢，减少块大小
  newChunkSize = Math.max(minChunkSize, currentChunkSize / adjustmentFactor);
}
```

### 3. 并行下载管理

**并发控制：**
- 每个块独立的下载线程
- 错误重试机制（最多3次）
- 进度聚合和报告
- 优雅的错误处理和降级

**错误处理：**
- 单个块失败时自动重试
- 多次失败后降级到单线程下载
- 网络中断时保持已下载的块

## 预期性能提升

### 1. 下载速度对比

**优化前：**
- 固定64KB块大小
- 单线程下载
- 速度：几百KB/s

**优化后：**
- 自适应1MB-8MB块大小
- 最多8线程并行
- 预期速度：2MB/s+

### 2. 适用场景

**并行下载最佳场景：**
- 大文件（>10MB）
- 高带宽网络
- 低延迟连接
- 支持随机访问的服务器

**自适应缓冲区最佳场景：**
- 网络状况变化的环境
- 不同大小的文件
- 需要平衡吞吐量和响应性

## 测试验证

### 1. 功能测试

**测试用例：**
1. 小文件下载（<10MB）- 验证自适应单线程
2. 中等文件下载（10-100MB）- 验证4线程并行
3. 大文件下载（>100MB）- 验证8线程并行
4. 网络中断恢复 - 验证断点续传
5. 服务器不支持并行 - 验证降级机制

### 2. 性能测试

**测试指标：**
- 下载速度（MB/s）
- CPU使用率
- 内存占用
- 网络利用率
- 错误率

**测试环境：**
- 不同网络条件（1Mbps, 10Mbps, 100Mbps）
- 不同文件大小（1MB, 10MB, 100MB, 1GB）
- 不同服务器配置

### 3. 对比测试

**与FinalShell对比：**
- 相同文件，相同网络环境
- 记录下载时间和速度
- 分析性能差异原因

## 使用方法

### 1. 启用并行下载

在下载对话框中：
1. 勾选"并行分块下载"
2. 选择并行块数（2-8块）
3. 系统会自动检测服务器支持

### 2. 自动优化

系统会自动：
1. 检测文件大小选择最优策略
2. 检测网络速度调整块大小
3. 检测服务器能力选择下载方式

### 3. 监控下载

下载过程中可以看到：
1. 当前下载速度
2. 并行块状态
3. 自适应调整信息
4. 优化效果统计

## 技术细节

### 1. 内存管理

- 使用流式写入，避免大文件占用过多内存
- 预分配文件空间，提高写入效率
- 及时释放已完成块的资源

### 2. 错误恢复

- 每个块独立重试，不影响其他块
- 保存下载进度，支持断点续传
- 自动降级机制，确保下载成功

### 3. 兼容性

- 自动检测服务器能力
- 向后兼容原有下载方式
- 支持各种文件类型和大小

这些优化应该能显著提升下载速度，特别是对于大文件的下载。
