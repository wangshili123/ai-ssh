# 终端和文件浏览器布局调整方案

## 重要说明：分阶段实施要求

为了确保调整的稳定性和可控性，本方案将分两个阶段实施：

### 第一阶段：纯布局调整
- 只调整组件的结构和样式
- 保持现有的数据流和props不变
- 每次改动后都需要确认布局效果
- 确保不影响现有功能的正常运行

### 第二阶段：数据流优化
- 在布局调整完全确认无误后进行
- 优化组件间的数据传递
- 实现状态管理的改造
- 完善组件间的通信机制

⚠️ 注意事项：
1. 严格遵循分阶段实施
2. 每个阶段完成后必须经过确认
3. 避免在布局调整时修改数据逻辑
4. 保持改动的最小化原则

## 一、现状分析

### 1.1 当前布局
- 终端区域在 TerminalTabs 组件中管理
- 文件浏览器在 App 组件中统一管理
- 布局上下分离，不利于关联操作

### 1.2 存在的问题
1. 文件浏览器是全局共享的，不能与具体 Tab 关联
2. 切换 Tab 时文件浏览器状态不能完全对应
3. 不符合用户使用直觉
4. 空间利用效率不高

## 二、调整目标

1. 将文件浏览器移入到 Tab 内部，实现终端和文件浏览器的一体化
2. 每个 Tab 采用上下分栏布局
3. 利用 React 组件的特性实现自然的状态隔离
4. 保持必要的状态共享机制

## 三、具体步骤

### 第一阶段：布局调整

#### 步骤1：创建 TabContent 组件基础结构
1. 创建新文件：`src/renderer/components/TerminalTabs/TabContent.tsx`
```typescript
import React, { useState } from 'react';
import { Resizable } from 're-resizable';
import Terminal from '../Terminal';
import FileBrowserMain from '../FileBrowser/FileBrowserMain/FileBrowserMain';
import type { SessionInfo } from '../../../main/services/storage';

interface TabContentProps {
  sessionInfo: SessionInfo;
  instanceId: string;
  tabId: string;
}

const TabContent: React.FC<TabContentProps> = ({ 
  sessionInfo, 
  instanceId, 
  tabId
}) => {
  // 仅用于布局的状态
  const [splitHeight, setSplitHeight] = useState(300);
  
  return (
    <div className="tab-content">
      {/* 终端区域 - 保持现有逻辑不变 */}
      <div className="terminal-area">
        <Terminal 
          sessionInfo={sessionInfo} 
          instanceId={instanceId}
        />
      </div>
      
      {/* 分隔条 */}
      <Resizable
        size={{ height: splitHeight, width: '100%' }}
        onResizeStop={(e, direction, ref, d) => {
          setSplitHeight(splitHeight + d.height);
        }}
        minHeight={100}
        maxHeight={800}
        enable={{ top: true }}
      >
        {/* 文件浏览器区域 - 保持现有props不变 */}
        <div className="file-browser-area">
          <FileBrowserMain
            sessionInfo={sessionInfo}
            tabId={tabId}
          />
        </div>
      </Resizable>
    </div>
  );
};

export default TabContent;
```

2. 创建样式文件：`src/renderer/components/TerminalTabs/TabContent.css`
```css
.tab-content {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.terminal-area {
  flex: 1;
  min-height: 200px;
  overflow: hidden;
}

.file-browser-area {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--background-color);
  border-top: 1px solid var(--border-color);
}
```

#### 步骤2：修改 TerminalTabs 组件布局
1. 更新 `src/renderer/components/TerminalTabs/index.tsx`
```typescript
import React from 'react';
import { Tabs, Badge } from 'antd';
import TabContent from './TabContent';
import type { SessionInfo } from '../../../main/services/storage';
import './index.css';

const TerminalTabs: React.FC<TerminalTabsProps> = ({ 
  sessionInfo, 
  triggerNewTab,
  onTabChange 
}) => {
  // 保持现有状态和逻辑不变
  
  return (
    <div className="terminal-tabs">
      <Tabs
        type="editable-card"
        onChange={handleTabChange}
        activeKey={activeKey}
        onEdit={onEdit}
        hideAdd={true}
        animated={false}
        items={tabs.map(tab => ({
          key: tab.key,
          label: (
            <Badge 
              status={tab.connected ? 'success' : 'error'} 
              text={tab.title} 
              className="tab-badge"
            />
          ),
          children: tab.sessionInfo && (
            <TabContent
              sessionInfo={tab.sessionInfo}
              instanceId={tab.instanceId}
              tabId={tab.tabId}
            />
          )
        }))}
      />
    </div>
  );
};
```

#### 步骤3：清理 App 组件布局
1. 修改 `src/renderer/App.tsx`，移除文件浏览器相关布局代码
```typescript
const App: React.FC = () => {
  // 保持现有状态不变
  const [activeSession, setActiveSession] = useState<SessionInfo | undefined>();
  const [triggerNewTab, setTriggerNewTab] = useState(0);
  const [aiSiderWidth, setAiSiderWidth] = useState(400);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <Layout className="app-container">
      <Layout>
        <Content className="main-content">
          <TerminalTabs 
            sessionInfo={activeSession}
            triggerNewTab={triggerNewTab}
            onTabChange={handleTabChange}
          />
        </Content>
        <Sider>
          {/* AI 助手部分保持不变 */}
        </Sider>
      </Layout>
      <AppStatusBar />
    </Layout>
  );
};
```

### 第二阶段：数据流优化

#### 步骤4：优化 TabContent 组件状态
1. 添加文件浏览器相关状态
```typescript
const TabContent: React.FC<TabContentProps> = ({ 
  sessionInfo, 
  instanceId, 
  tabId,
  globalConfig 
}) => {
  // 文件浏览器的局部状态
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // ... 其他代码
};
```

#### 步骤5：优化 FileBrowserMain 组件接口
1. 更新组件 Props 定义
```typescript
interface FileBrowserMainProps {
  sessionInfo: SessionInfo;
  currentPath: string;
  selectedFiles: string[];
  viewMode: 'list' | 'grid';
  onPathChange: (path: string) => void;
  onFileSelect: (files: string[]) => void;
  onViewModeChange: (mode: 'list' | 'grid') => void;
}
```

#### 步骤6：实现共享状态
1. 在 TerminalTabs 中添加共享配置
```typescript
const [globalConfig, setGlobalConfig] = useState({
  theme: 'dark',
  fontSize: 14
});
```

## 四、状态管理策略

1. **局部状态**
- 每个标签页内的状态（如当前路径、选中文件等）
- 使用组件内的 useState 管理
- 随标签页自动隔离

2. **共享状态**
- 需要在标签页间共享的状态（如主题设置）
- 提升到父组件 TerminalTabs
- 通过 props 传递给子组件

3. **全局状态**
- 应用级别的状态（如用户设置）
- 使用 Redux 或 Context 管理
- 所有组件都可访问

## 五、测试计划

### 第一阶段测试
1. 布局功能测试
   - 终端显示正常
   - 文件浏览器显示正常
   - 分隔条拖动正常
   - 布局自适应正常

### 第二阶段测试
1. 状态隔离测试
   - 切换标签页时各自状态保持独立
   - 共享状态正确同步
   - 全局状态正确更新

2. 性能测试
   - 内存占用合理
   - 标签切换流畅
   - 大量文件显示正常

## 六、注意事项

1. 组件职责单一，避免过度耦合
2. 正确区分局部状态和共享状态
3. 保持必要的性能优化
4. 做好错误处理和加载状态
5. 保持代码清晰和可维护性 