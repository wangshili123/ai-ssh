# SFTP连接优化方案

## 问题分析

### 当前问题
1. **重复连接创建**: SFTP每次都创建新的SSH连接，没有复用现有连接
2. **连接池预热不完善**: SSH连接池异步预热，SFTP请求时可能还没准备好
3. **缺乏连接复用**: SFTP和终端使用不同的连接管理策略
4. **连接验证开销**: 每次获取连接都要验证，造成延迟

### 根本原因
- SFTP服务独立创建SSH连接，没有利用SSH服务的连接池
- 缺乏统一的SSH连接管理机制
- 连接池配置和预热策略需要优化

## 优化方案

### 方案1: SFTP复用SSH连接池（推荐）

#### 1.1 修改SFTP服务使用SSH连接池
```typescript
// src/main/services/sftp.ts
class SFTPClient {
  constructor(private sessionInfo: SessionInfo, private connectionId: string, private sshService: SSHService) {
    // 不再创建独立的SSH客户端
    // this.client = new Client();
  }

  async connect(): Promise<void> {
    // 使用SSH服务的连接池获取SFTP连接
    const sftpConnection = await this.sshService.getSFTPConnection(this.sessionInfo.id);
    this.sftp = sftpConnection.sftp;
    this.poolConnection = sftpConnection.poolConn;
    this.pool = sftpConnection.pool;
  }
}
```

#### 1.2 优化SSH连接池配置
```typescript
// src/main/services/ssh.ts
private readonly DEFAULT_POOL_CONFIG: PoolConfig = {
  min: 5,                    // 增加核心连接数
  max: 15,                   // 增加最大连接数
  idleTimeoutMillis: 900000, // 15分钟空闲超时
  acquireTimeoutMillis: 10000, // 减少获取超时时间
  priorityRange: 5,          // 增加优先级范围
};
```

#### 1.3 实现连接预热策略
```typescript
// 在应用启动时预热常用连接
async warmupFrequentConnections() {
  const recentSessions = await this.getRecentSessions(); // 获取最近使用的会话
  const warmupPromises = recentSessions.slice(0, 3).map(async (session) => {
    try {
      await this.connect(session);
      console.log(`预热连接成功: ${session.id}`);
    } catch (error) {
      console.warn(`预热连接失败: ${session.id}`, error);
    }
  });
  await Promise.allSettled(warmupPromises);
}
```

### 方案2: 统一SSH连接管理器

#### 2.1 创建全局SSH连接管理器
```typescript
// src/main/services/GlobalSSHManager.ts
class GlobalSSHManager {
  private static instance: GlobalSSHManager;
  private connectionPools: Map<string, SSHConnectionPool> = new Map();
  
  // 为不同服务提供统一的连接获取接口
  async getConnectionForService(sessionId: string, serviceType: 'terminal' | 'sftp' | 'transfer'): Promise<Client> {
    const pool = await this.getOrCreatePool(sessionId);
    return pool.acquire(this.getServicePriority(serviceType));
  }
  
  private getServicePriority(serviceType: string): number {
    switch (serviceType) {
      case 'terminal': return 3; // 最高优先级
      case 'sftp': return 2;     // 中等优先级
      case 'transfer': return 1; // 最低优先级
      default: return 1;
    }
  }
}
```

#### 2.2 优化连接池策略
```typescript
// 智能连接池配置
private getPoolConfig(sessionId: string): PoolConfig {
  const usage = this.getSessionUsageStats(sessionId);
  return {
    min: usage.isFrequent ? 3 : 1,        // 根据使用频率调整
    max: usage.isFrequent ? 12 : 6,       // 动态最大连接数
    idleTimeoutMillis: usage.isFrequent ? 1800000 : 600000, // 30分钟 vs 10分钟
    acquireTimeoutMillis: 8000,           // 统一8秒超时
    priorityRange: 5,
  };
}
```

### 方案3: 连接缓存和预测

#### 3.1 实现连接预测机制
```typescript
// 基于用户行为预测连接需求
class ConnectionPredictor {
  // 当用户打开终端时，预测可能需要SFTP连接
  async onTerminalOpened(sessionId: string) {
    setTimeout(() => {
      this.globalSSHManager.warmupConnection(sessionId, 'sftp');
    }, 2000); // 2秒后预热SFTP连接
  }
  
  // 当用户浏览文件时，预测可能需要传输连接
  async onDirectoryChanged(sessionId: string) {
    this.globalSSHManager.warmupConnection(sessionId, 'transfer');
  }
}
```

#### 3.2 实现连接状态监控
```typescript
// 连接健康检查和自动恢复
class ConnectionHealthMonitor {
  async monitorConnections() {
    setInterval(async () => {
      for (const [sessionId, pool] of this.connectionPools) {
        const health = await this.checkPoolHealth(pool);
        if (health.needsRecovery) {
          await this.recoverPool(sessionId, pool);
        }
      }
    }, 30000); // 30秒检查一次
  }
}
```

## 实施计划

### 阶段1: 基础优化（立即实施）
1. 修改SFTP服务复用SSH连接池
2. 优化SSH连接池配置
3. 实现连接预热机制

### 阶段2: 深度优化（后续实施）
1. 创建全局SSH连接管理器
2. 实现连接预测机制
3. 添加连接健康监控

### 阶段3: 性能调优（持续优化）
1. 根据实际使用情况调整连接池参数
2. 优化连接验证策略
3. 实现连接使用统计和分析

## 实施完成情况

### ✅ 已完成的优化

#### 1. SSH连接并发控制
- 实现了 `connectionPromises` Map 来防止同一会话的多个服务同时创建连接
- 添加了连接状态检查，避免重复创建连接
- 确保文件列表和终端同时连接时的正确处理

#### 2. SFTP服务复用SSH连接池
- 重构了 `SFTPClient` 类，移除独立的SSH客户端创建
- 通过 `sshService.getSFTPConnection()` 获取SFTP连接
- 实现了连接池资源的正确释放机制

#### 3. SSH连接池配置优化
- 增加核心连接数：min: 3 → 5
- 增加最大连接数：max: 10 → 15
- 优化空闲超时：10分钟 → 15分钟
- 减少获取超时：30秒 → 10秒
- 禁用借用时检查，启用自动启动

#### 4. 连接预热策略优化
- 实现了 `aggressiveWarmupPool` 积极预热机制
- 并行创建连接池连接，不等待单个连接完成
- 使用 `setImmediate` 立即初始化连接池

### 🔧 关键技术改进

#### 并发控制机制
```typescript
// 防止并发连接竞争
const existingPromise = this.connectionPromises.get(id);
if (existingPromise) {
  console.log(`[SSH] 检测到并发连接请求，等待现有连接完成: ${id}`);
  await existingPromise;
  return;
}
```

#### SFTP连接复用
```typescript
// SFTP复用SSH连接池
async connect(): Promise<void> {
  if (!sshService.isConnected(this.sessionInfo.id)) {
    await sshService.connect(this.sessionInfo);
  }
  this.sftpConnection = await sshService.getSFTPConnection(this.sessionInfo.id);
  this.sftp = this.sftpConnection.sftp;
}
```

#### 连接池优化配置
```typescript
private readonly DEFAULT_POOL_CONFIG: PoolConfig = {
  min: 5,                    // 增加核心连接数
  max: 15,                   // 增加最大连接数
  idleTimeoutMillis: 900000, // 15分钟空闲超时
  acquireTimeoutMillis: 10000, // 10秒获取超时
  priorityRange: 5,          // 优先级范围
};
```

## 预期效果

- **首次连接速度**: 从当前的3-5秒减少到1-2秒
- **后续连接速度**: 从1-2秒减少到200-500ms
- **资源利用率**: 减少30-50%的SSH连接数
- **用户体验**: 显著提升文件浏览的响应速度
- **并发处理**: 文件列表和终端同时连接时，第二个请求等待第一个完成并复用连接

## 测试验证

### 关键日志监控
- `[SSH] 检测到并发连接请求，等待现有连接完成`
- `[SSH] 连接已存在，直接返回`
- `[SFTPClient] 开始连接SFTP（复用SSH连接）`
- `[SSH] 连接池连接创建成功`

### 性能指标
- 连接建立时间
- 连接池状态（size, available, borrowed）
- 内存使用情况

## 风险评估

### ✅ 低风险（已完成）
- 连接池配置调整
- 连接预热机制
- 并发控制实现

### ✅ 中风险（已完成）
- SFTP服务架构调整
- 连接复用机制实现
- 循环依赖问题解决

### ⚠️ 需要注意
- 长时间运行的稳定性测试
- 异常情况下的连接清理
- 连接池资源泄漏监控
