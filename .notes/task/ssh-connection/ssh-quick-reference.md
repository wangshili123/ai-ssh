# SSH连接问题快速参考

## 当前问题症状

### 问题描述
软件运行久后，新建终端连接变慢，出现以下错误：
```
[SSH] 连接池获取失败，回退到专用连接: TimeoutError: ResourceRequest timed out
```

### 问题原因
1. **连接池被长期占用**：每个终端Shell都占用一个连接池连接
2. **资源耗尽**：连接池最大连接数被用完
3. **获取超时**：新连接请求无法在超时时间内获取到连接

## 临时解决方案 (已实施)

### 1. 终端加载动画
- ✅ 添加了连接状态的加载动画覆盖层
- ✅ 标签页显示连接状态（蓝色动画=连接中，绿色=已连接，红色=失败）
- ✅ 移除了终端中的文字提示

### 2. 重连接修复
- ✅ 修复了重新连接时的重复终端问题
- ✅ 正确清理旧的事件监听器
- ✅ 使用相同的instanceId保持连接ID一致性

## 根本解决方案 (计划中)

### 架构重新设计
参见：`.notes/task/ssh-connection-architecture-redesign.md`

**核心思路：**
- 终端Shell使用专用连接（不占用连接池）
- 监控、补全等短期操作使用共享连接池
- 文件传输使用专用传输连接池

## 代码位置参考

### 关键文件
- `src/main/services/ssh.ts` - SSH服务主要逻辑
- `src/renderer/components/Terminal/index.tsx` - 终端组件（加载动画）
- `src/renderer/components/Terminal/hooks/useContextMenu.tsx` - 重新加载逻辑
- `src/renderer/components/Terminal/TerminalTabsManager/TerminalTabsManager.tsx` - 标签页管理

### 关键方法
- `SSHService.createShell()` - 创建终端Shell（问题源头）
- `SSHService.getPoolConnection()` - 获取连接池连接
- `useContextMenu.handleReload()` - 终端重新加载

## 监控和诊断

### 连接监控界面
1. **打开连接监控**：
   - 点击左侧工具栏的设置按钮（齿轮图标）
   - 在弹出的基础配置窗口中，点击左侧菜单的"连接监控"
   - 选择要监控的已连接会话

2. **监控信息说明**：
   - **专用连接状态**：显示终端是否有专用连接
   - **共享连接池**：显示监控、补全服务的连接池状态
   - **传输连接池**：显示文件传输的连接池状态

### 日志关键词
- `[SSH] 连接池状态` - 查看连接池使用情况
- `ResourceRequest timed out` - 连接池超时错误
- `连接池获取失败` - 连接池问题
- `[GlobalSSHManager]` - 新架构的连接管理日志

### 调试命令
```javascript
// 在开发者工具中查看连接池状态
// 现在可以通过连接监控界面直接查看
```

## 应急处理

### 用户遇到连接慢的问题时
1. **重启应用** - 最直接的解决方案
2. **关闭不用的终端** - 释放连接池资源
3. **等待连接** - 通常30秒内会回退到专用连接

### 开发调试时
1. 查看控制台日志中的连接池状态
2. 监控连接池的 `size`, `available`, `borrowed`, `pending` 数值
3. 如果 `available` 为0且 `borrowed` 达到最大值，说明连接池耗尽

## 配置参考

### 当前连接池配置
```typescript
// src/main/services/ssh.ts
private readonly DEFAULT_POOL_CONFIG: PoolConfig = {
  min: 5,                    // 最小连接数
  max: 15,                   // 最大连接数
  idleTimeoutMillis: 900000, // 15分钟空闲超时
  acquireTimeoutMillis: 10000, // 10秒获取超时
  priorityRange: 5,          // 优先级范围
};
```

### 建议的临时调整（如果问题严重）
```typescript
// 可以临时增加连接池大小
max: 25,  // 增加最大连接数
acquireTimeoutMillis: 30000, // 增加获取超时时间
```

## 相关Issue和讨论

### 已知问题
- 连接池超时导致终端创建慢
- 重新连接时出现重复终端
- 长时间运行后性能下降

### 已修复问题
- ✅ 重新连接时的重复终端问题
- ✅ 连接状态显示不更新问题
- ✅ 加载状态用户体验问题

## 下一步计划

1. **短期 (本周)**：开始实施新的连接架构
2. **中期 (2-3周)**：完成所有服务的连接迁移
3. **长期 (1个月)**：性能优化和监控完善

## 联系信息

如有问题或需要协助，请参考：
- 设计文档：`.notes/task/ssh-connection-architecture-redesign.md`
- 进度跟踪：`.notes/task/ssh-redesign-progress.md`
