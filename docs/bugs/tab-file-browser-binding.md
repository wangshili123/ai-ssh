# 标签页与文件浏览器绑定问题

## 问题描述
当前在创建新连接时,标签页ID(tabId)的生成存在重复创建的问题,导致文件浏览器实例无法正确绑定到对应的标签页。具体表现为:
- 同一个会话配置第一次连接时文件浏览器正常显示
- 再次连接同一会话时不会创建新的文件浏览器实例

## 问题原因
1. TabId 重复创建:
- `TerminalTabs/index.tsx` 中创建了 tabId
- `SessionList/index.tsx` 的连接按钮中又重复创建了一次
这导致了 tabId 的不一致性。

2. 标签管理混乱:
- `TerminalTabs` 组件是真正管理标签的地方
- `SessionList` 不应该创建新的 tabId

## 修改方案

### 1. SessionList 修改
```typescript
// 在 SessionList/index.tsx 中
<Button
  type="primary"
  size="small"
  onClick={(e) => {
    e.stopPropagation();
    // 只需要触发选择事件,不需要创建 tabId
    onSelect?.(session);
  }}
>
  连接
</Button>
```

### 2. TerminalTabs 保持现有逻辑
```typescript
const instanceId = Date.now().toString();
const tabId = `tab-${instanceId}`;
const newTab = {
  key: String(tabs.length + 1),
  title: sessionInfo.name || `终端 ${tabs.length + 1}`,
  sessionInfo,
  instanceId,
  tabId,
  connected: false
};
```

### 3. 文件浏览器修改

#### NewFileBrowser.tsx 修改:
```typescript
// 1. 简化 getStateKey 函数
function getStateKey(tabId: string) {
  return tabId;  // 直接使用 tabId
}

// 2. 修改状态初始化逻辑
const getTabState = useCallback(() => {
  if (!sessionInfo) return null;
  
  if (!tabStates.has(tabId)) {
    const initialState = {
      currentPath: '/',
      treeData: [],
      expandedKeys: [],
      fileList: [],
      isInitialized: false,
      isConnected: false,
      sessionId: sessionInfo.id
    };
    tabStates.set(tabId, initialState);
  }

  return tabStates.get(tabId)!;
}, [tabId, sessionInfo]);

// 3. 添加组件卸载时的清理逻辑
useEffect(() => {
  mountedRef.current = true;
  connectionAttemptRef.current = 0;

  return () => {
    mountedRef.current = false;
    // 清理当前标签页的状态
    tabStates.delete(tabId);
    // 清理 SFTP 连接
    sftpConnectionManager.closeConnection(tabId);
  };
}, [tabId]);
```

#### sftpConnectionManager 修改:
```typescript
class SftpConnectionManager {
  private connections = new Map<string, SftpConnection>();

  async createConnection(sessionInfo: SessionInfo, tabId: string) {
    // 如果已存在连接,先关闭
    if (this.connections.has(tabId)) {
      await this.closeConnection(tabId);
    }
    
    // 创建新连接
    const connection = new SftpConnection(sessionInfo);
    await connection.connect();
    this.connections.set(tabId, connection);
    return connection;
  }

  getConnection(tabId: string) {
    return this.connections.get(tabId);
  }

  async closeConnection(tabId: string) {
    const connection = this.connections.get(tabId);
    if (connection) {
      await connection.close();
      this.connections.delete(tabId);
    }
  }
}
```

## 预期效果
1. 每次连接都会创建新的标签页
2. 每个标签页都有独立的文件浏览器实例
3. 切换标签时可以正确切换对应的文件浏览器
4. 不同标签页之间的文件浏览互不影响
5. 标签页关闭时会清理相关资源

## 修改步骤
1. 修改 `SessionList/index.tsx`,移除 tabId 创建逻辑
2. 修改 `TerminalTabs/index.tsx` 中的事件处理
3. 更新 `NewFileBrowser.tsx` 中的状态管理逻辑
4. 修改 `sftpConnectionManager` 的连接管理逻辑 