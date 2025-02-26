# 文件监控功能集成计划

## 一、集成概述

我们已经实现了增强版的 `FileWatchManager`，下一步需要将其集成到浏览模式 (`BrowseMode`) 中，以替代当前基于命令行的简单文件监控方式，提供更可靠和更高效的文件变更监控。

## 二、当前状态分析

### 1. 现有监控机制

目前的浏览模式使用以下方式监控文件变化：
- Windows 上使用 PowerShell 的 `Get-Content -Wait` 命令
- Linux/Mac 上使用 `tail -f` 命令
- 通过 `spawn` 创建子进程监听文件变化
- 简单的事件通知机制：`WATCH_STARTED` 和 `WATCH_STOPPED`

### 2. 问题和局限性

现有方案存在以下问题：
- 依赖于系统命令，跨平台兼容性差
- 缺乏增量内容获取机制
- 无法处理文件重命名或删除情况
- 错误处理机制简单
- 不支持高级功能（如暂停/恢复监控、智能轮询等）

## 三、集成方案

### 1. 替换现有的监控功能

将把现有的 `startRealtime()` 和 `stopRealtime()` 方法改造为使用 `FileWatchManager` 的实现：

1. 在 `BrowseMode` 类中添加 `FileWatchManager` 实例
2. 修改 `startRealtime()` 使用 `FileWatchManager.startWatch()`
3. 修改 `stopRealtime()` 使用 `FileWatchManager.stopWatch()`
4. 在 `BrowseMode` 的 `dispose()` 方法中添加 `FileWatchManager` 的清理

### 2. 事件处理集成

`FileWatchManager` 使用自定义事件，需要与 `BrowseMode` 的事件系统集成：

1. 监听 `FileWatchManager` 的 `watch-event` 事件
2. 根据事件类型转换为对应的 `EditorEvents` 事件
3. 处理新内容的添加和显示

### 3. 自动滚动功能集成

将 `FileWatchManager` 与自动滚动功能集成：

1. 当收到更新事件时，检查自动滚动状态
2. 如果启用自动滚动，调用 `scrollToBottom()`
3. 优化滚动体验，避免频繁滚动造成的性能问题

## 四、实现步骤

### 第一步：添加 FileWatchManager 实例
```typescript
// 在 BrowseMode 类中添加
private fileWatcher: FileWatchManager | null = null;
```

### 第二步：修改 startRealtime 和 stopRealtime 方法
```typescript
/**
 * 启动实时监控模式
 */
public startRealtime(): void {
  if (this.state.isRealtime) return;
  
  try {
    if (!this.fileWatcher) {
      this.fileWatcher = new FileWatchManager(this.sessionId, this.filePath);
      this.setupWatcherEvents();
    }
    
    this.fileWatcher.startWatch();
    this.state.isRealtime = true;
    this.emit(EditorEvents.WATCH_STARTED);
  } catch (error: any) {
    this.errorManager.handleError(
      EditorErrorType.OPERATION_TIMEOUT,
      `启动实时监控失败: ${error.message}`
    );
  }
}

/**
 * 停止实时监控模式
 */
public stopRealtime(): void {
  if (this.fileWatcher) {
    this.fileWatcher.stopWatch();
    this.state.isRealtime = false;
    this.emit(EditorEvents.WATCH_STOPPED);
  }
}
```

### 第三步：添加事件处理
```typescript
/**
 * 设置文件监控事件
 */
private setupWatcherEvents(): void {
  if (!this.fileWatcher) return;

  this.fileWatcher.on('watch-event', (eventData: FileWatchEventData) => {
    switch (eventData.type) {
      case 'update':
        if (eventData.content) {
          // 处理新内容
          this.handleNewContent(eventData.content);
        }
        break;
      
      case 'error':
        this.errorManager.handleError(
          EditorErrorType.UNKNOWN_ERROR,
          `文件监控错误: ${eventData.error?.message || '未知错误'}`
        );
        break;
      
      case 'warning':
        // 处理警告
        console.warn('文件监控警告:', eventData.warning);
        break;
      
      case 'info':
        // 处理信息
        console.info('文件监控信息:', eventData.info);
        break;
    }
  });
}

/**
 * 处理新内容
 */
private handleNewContent(lines: string[]): void {
  // 更新缓存
  const visibleEnd = this.state.visibleRange[1];
  const lastChunkKey = `${visibleEnd - (visibleEnd % DEFAULT_CHUNK_SIZE)}`;
  const lastChunk = this.state.loadedChunks[lastChunkKey];
  
  if (lastChunk) {
    // 添加到最后一个块
    lastChunk.content = [...lastChunk.content, ...lines];
    lastChunk.endLine += lines.length;
    lastChunk.lastAccessed = Date.now();
  }
  
  // 触发内容变更事件
  this.emit(EditorEvents.CONTENT_CHANGED, {
    lines,
    startLine: visibleEnd,
    endLine: visibleEnd + lines.length
  });
  
  // 如果启用自动滚动，滚动到底部
  if (this.state.isAutoScroll) {
    this.scrollToBottom();
  }
}
```

### 第四步：修改 dispose 方法
```typescript
/**
 * 清理资源
 */
public dispose(): void {
  this.stopRealtime();
  
  if (this.fileWatcher) {
    this.fileWatcher.destroy();
    this.fileWatcher = null;
  }
  
  if (this.realtimeProcess) {
    this.realtimeProcess.kill();
    this.realtimeProcess = null;
  }
  
  this.removeAllListeners();
  this.state.loadedChunks = {};
}
```

## 五、测试计划

### 1. 功能测试
- 测试启动和停止监控
- 测试文件更新检测
- 测试增量内容获取
- 测试自动滚动功能

### 2. 边缘情况测试
- 测试文件被删除的情况
- 测试文件被重命名的情况
- 测试网络断开重连的情况
- 测试大文件和高频更新的情况

### 3. 性能测试
- 测试内存占用
- 测试CPU使用率
- 测试响应时间

## 六、回退计划

如果新的文件监控实现出现问题，可以通过配置切换回原有的基于命令行的实现：

```typescript
public startRealtime(useWatcher: boolean = true): void {
  if (useWatcher) {
    // 使用新的 FileWatchManager
    // ...现有代码...
  } else {
    // 使用旧的基于命令行的实现
    // ...旧代码...
  }
}
```

## 七、提升计划

完成基本集成后，可以考虑以下提升：

1. 添加监控状态指示器：显示当前监控状态和统计信息
2. 添加监控设置面板：允许用户调整轮询间隔、缓冲区大小等
3. 优化大文件处理：实现高效的内存管理和渲染策略
4. 添加差异高亮：突出显示新添加的内容

## 八、时间估计

1. 基本集成：1天
2. 测试和调优：1天
3. UI改进：1天

总计：3个工作日 