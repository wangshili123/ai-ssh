# SSH连接架构重新设计方案

## 问题背景

### 当前问题
- 连接池超时：软件运行久后出现 `ResourceRequest timed out` 错误
- 连接池被长期占用：每个终端Shell都占用一个连接池连接直到关闭
- 资源竞争：不同服务混用连接池导致资源不足
- 架构混乱：连接生命周期管理不清晰

### 连接使用分析
1. **终端Shell** - 长期连接，每个终端占用一个连接直到关闭
2. **监控服务** - 定期执行命令，短期连接使用
3. **补全服务** - 频繁的短期命令执行
4. **SFTP文件浏览** - 中期连接，用于目录浏览和文件操作
5. **文件传输** - 中期连接，用于上传下载

## 新架构设计

### 1. 分层连接管理架构

```
┌─────────────────────────────────────────────────────────────┐
│                    应用层服务                                │
├─────────────┬─────────────┬─────────────┬─────────────────────┤
│   终端Shell  │   监控服务   │   补全服务   │   文件传输/SFTP     │
├─────────────┼─────────────┼─────────────┼─────────────────────┤
│             │             │             │                     │
│   专用连接   │   连接池     │   连接池     │   专用连接池        │
│             │             │             │                     │
└─────────────┴─────────────┴─────────────┴─────────────────────┘
                              │
                    ┌─────────────────────┐
                    │  全局SSH连接管理器   │
                    │  - 连接生命周期管理  │
                    │  - 资源分配策略     │
                    │  - 健康检查        │
                    └─────────────────────┘
```

### 2. 连接类型重新分类

#### 2.1 专用长期连接 (Dedicated Long-term Connections)
- **用途：** 终端Shell会话
- **特点：** 
  - 一对一绑定，生命周期与终端相同
  - 不共享，不进入连接池
  - 支持交互式操作

#### 2.2 共享连接池 (Shared Connection Pool)
- **用途：** 监控、补全等短期命令执行
- **特点：**
  - 多服务共享
  - 快速获取和释放
  - 支持优先级

#### 2.3 专用连接池 (Dedicated Connection Pool)
- **用途：** 文件传输、SFTP操作
- **特点：**
  - 专门用于文件操作
  - 支持并发传输
  - 独立的生命周期管理

## 技术实现方案

### 1. 全局SSH连接管理器

```typescript
// src/main/services/GlobalSSHManager.ts
export class GlobalSSHManager {
  private static instance: GlobalSSHManager;
  
  // 不同类型的连接管理
  private dedicatedConnections: Map<string, Client> = new Map(); // 终端专用
  private sharedPool: Map<string, Pool<PooledConnection>> = new Map(); // 共享池
  private transferPools: Map<string, Pool<PooledConnection>> = new Map(); // 传输专用池
  
  // 连接类型枚举
  enum ConnectionType {
    TERMINAL = 'terminal',      // 终端专用连接
    COMMAND = 'command',        // 命令执行（监控、补全）
    TRANSFER = 'transfer'       // 文件传输
  }
  
  // 统一连接获取接口
  async getConnection(sessionId: string, type: ConnectionType): Promise<ConnectionHandle> {
    switch (type) {
      case ConnectionType.TERMINAL:
        return this.getDedicatedConnection(sessionId);
      case ConnectionType.COMMAND:
        return this.getSharedPoolConnection(sessionId);
      case ConnectionType.TRANSFER:
        return this.getTransferPoolConnection(sessionId);
    }
  }
}
```

### 2. 连接池配置优化

```typescript
// 不同用途的连接池配置
const POOL_CONFIGS = {
  // 共享池：用于短期命令执行
  SHARED: {
    min: 2,
    max: 8,
    acquireTimeoutMillis: 5000,
    idleTimeoutMillis: 300000, // 5分钟
  },
  
  // 传输池：用于文件操作
  TRANSFER: {
    min: 1,
    max: 5,
    acquireTimeoutMillis: 10000,
    idleTimeoutMillis: 600000, // 10分钟
  }
};
```

### 3. 服务层适配

```typescript
// 终端服务 - 使用专用连接
class TerminalService {
  async createShell(shellId: string) {
    const connection = await globalSSHManager.getConnection(
      sessionId, 
      ConnectionType.TERMINAL
    );
    // 直接使用专用连接，不需要释放
  }
}

// 监控服务 - 使用共享池
class MonitorService {
  async executeCommand(sessionId: string, command: string) {
    const handle = await globalSSHManager.getConnection(
      sessionId, 
      ConnectionType.COMMAND
    );
    try {
      return await handle.execute(command);
    } finally {
      await handle.release(); // 立即释放回池
    }
  }
}

// 传输服务 - 使用传输池
class TransferService {
  async uploadFile(sessionId: string, localPath: string, remotePath: string) {
    const handle = await globalSSHManager.getConnection(
      sessionId, 
      ConnectionType.TRANSFER
    );
    try {
      return await handle.uploadFile(localPath, remotePath);
    } finally {
      await handle.release(); // 传输完成后释放
    }
  }
}
```

## 迁移计划

### 阶段1：创建新的连接管理器 (第1周)
- [ ] 实现 `GlobalSSHManager` 基础框架
- [ ] 定义连接类型和接口
- [ ] 实现不同类型的连接池
- [ ] 添加连接健康检查机制

### 阶段2：迁移终端服务 (第2周)
- [ ] 修改终端Shell创建逻辑使用专用连接
- [ ] 确保终端重新加载功能正常
- [ ] 测试多终端并发创建
- [ ] 验证连接池不再被终端占用

### 阶段3：迁移其他服务 (第3周)
- [ ] 监控服务使用共享池
- [ ] 补全服务使用共享池
- [ ] 传输服务使用传输池
- [ ] SFTP服务使用传输池

### 阶段4：清理和优化 (第4周)
- [ ] 移除旧的连接管理代码
- [ ] 优化连接池配置参数
- [ ] 添加连接监控和诊断功能
- [ ] 性能测试和调优

## 预期效果

1. **消除连接池超时**：终端不再占用共享连接池
2. **提升性能**：不同服务使用专门优化的连接池
3. **更好的资源管理**：清晰的连接生命周期
4. **易于维护**：统一的连接管理接口
5. **可扩展性**：支持未来新功能的连接需求

## 风险评估

### 高风险
- 终端功能回归：需要充分测试终端的所有功能
- 数据一致性：确保连接切换不影响数据传输

### 中风险
- 性能影响：新架构可能带来短期性能波动
- 兼容性问题：需要确保所有现有功能正常工作

### 低风险
- 配置调优：连接池参数可能需要根据实际使用情况调整

## 成功标准

1. 软件长时间运行后新建终端连接时间 < 3秒
2. 不再出现连接池超时错误
3. 所有现有功能正常工作
4. 内存使用量不增加超过10%
5. 连接数量可控且可监控
