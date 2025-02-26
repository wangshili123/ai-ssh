# 文件编辑器重构设计文档

## 一、双模式架构设计

### 1. 模式定义

#### 浏览模式（默认）
- **核心特点**：高效处理大文件，按需加载内容
- **适用场景**：查看大型日志文件、只读操作、需要过滤的场景
- **技术实现**：基于系统命令的分块加载，虚拟滚动渲染
- **内存占用**：最小化，仅加载可视区域内容

#### 编辑模式
- **核心特点**：完整加载文件，支持全文编辑
- **适用场景**：需要修改文件内容、查找替换操作
- **技术实现**：完整加载文件到内存，使用编辑器组件
- **内存占用**：较高，需要完整加载文件

### 2. 模式切换机制

#### 从浏览模式到编辑模式
- **触发方式**：点击"编辑"按钮
- **确认流程**：
  ```
  +------------------------------------------+
  | ⚠️ 切换到编辑模式                        |
  | 将完整加载文件(10MB)到内存中，可能需要一些时间 |
  | [确认] [取消]                            |
  +------------------------------------------+
  ```
- **大文件警告**：文件大于10MB时显示警告
- **加载过程**：显示进度条，可取消操作

#### 从编辑模式到浏览模式
- **触发方式**：点击"浏览模式"按钮
- **确认流程**：如有未保存更改，提示保存
- **资源释放**：释放编辑器占用的内存

## 二、功能实现对比

### 1. 内容加载

| 功能 | 浏览模式 | 编辑模式 |
|------|---------|---------|
| **加载方式** | 分块按需加载 | 完整加载 |
| **实现技术** | 系统命令(head/tail) | 文件读取API |
| **内存占用** | 低 | 高 |
| **加载速度** | 快 | 慢(大文件) |
| **适用文件大小** | 不限 | 建议<100MB |

### 2. 过滤功能

| 功能 | 浏览模式 | 编辑模式 |
|------|---------|---------|
| **实现方式** | grep命令 | 内存中过滤 |
| **过滤范围** | 整个文件 | 已加载内容 |
| **过滤速度** | 快 | 受文件大小影响 |
| **结果展示** | 仅显示匹配行 | 高亮显示匹配行 |
| **上下文行** | 可选显示 | 始终可见 |

### 3. 搜索功能

| 功能 | 浏览模式 | 编辑模式 |
|------|---------|---------|
| **实现方式** | grep命令 | 编辑器内置搜索 |
| **搜索范围** | 整个文件 | 已加载内容 |
| **搜索速度** | 快 | 受文件大小影响 |
| **结果导航** | 基于行号跳转 | 编辑器内置导航 |
| **替换功能** | 不支持 | 支持 |

### 4. 实时更新

| 功能 | 浏览模式 | 编辑模式 |
|------|---------|---------|
| **实现方式** | tail -f命令 | 文件监控+重新加载 |
| **更新效率** | 高 | 低(需重新加载) |
| **内存影响** | 最小 | 可能增加 |
| **UI更新** | 增量添加 | 完全刷新 |

## 三、多标签状态管理设计

### 1. 标签数据结构

```typescript
interface EditorTab {
  id: string;                 // 唯一标识
  filePath: string;           // 文件路径
  sessionId: string;          // 会话ID
  title: string;              // 显示标题
  mode: 'browse' | 'edit';    // 当前模式
  isActive: boolean;          // 是否激活
  isModified: boolean;        // 是否已修改
  viewState: {                // 视图状态
    scrollPosition: number;   // 滚动位置
    filterText?: string;      // 过滤文本
    searchText?: string;      // 搜索文本
    isRealtime: boolean;      // 是否实时模式
  };
  fileState: {                // 文件状态
    size: number;             // 文件大小
    lastModified: number;     // 最后修改时间
    encoding: string;         // 文件编码
    totalLines?: number;      // 总行数(可能未知)
  };
  editorState?: {             // 编辑模式状态
    content?: string;         // 文件内容
    selections?: any[];       // 选区信息
    undoStack?: any[];        // 撤销栈
  };
  browseState?: {             // 浏览模式状态
    visibleRange: [number, number]; // 可见行范围
    loadedChunks: {           // 已加载块
      [key: string]: {
        range: [number, number];
        content: string[];
      }
    };
  };
}
```

### 2. 标签管理器设计

```typescript
interface ITabManager {
  // 标签基本操作
  addTab(options: TabOptions): string;
  closeTab(tabId: string): Promise<boolean>;
  activateTab(tabId: string): void;
  
  // 标签状态管理
  getTabState(tabId: string): EditorTab;
  updateTabState(tabId: string, updates: Partial<EditorTab>): void;
  
  // 模式切换
  switchTabMode(tabId: string, mode: 'browse' | 'edit'): Promise<boolean>;
  
  // 标签内容操作
  saveTabContent(tabId: string): Promise<boolean>;
  reloadTabContent(tabId: string): Promise<boolean>;
  
  // 标签事件
  onTabActivated(callback: (tab: EditorTab) => void): void;
  onTabClosed(callback: (tabId: string) => void): void;
  onTabModeChanged(callback: (tab: EditorTab, prevMode: string) => void): void;
  onTabStateChanged(callback: (tab: EditorTab, changes: object) => void): void;
}
```

### 3. 标签状态同步机制

#### 本地状态同步
- **内存中状态**：使用MobX管理可观察状态
- **持久化状态**：定期保存到本地存储
- **会话恢复**：应用启动时恢复上次会话

#### 窗口间状态同步
- **IPC通信**：使用Electron IPC在主进程和渲染进程间同步
- **事件广播**：标签状态变更时广播到所有相关窗口
- **冲突处理**：基于时间戳和版本号解决冲突

### 4. 标签生命周期管理

```
+-------------------+
| 创建标签(浏览模式) |
+-------------------+
         |
         v
+-------------------+     +-------------------+
| 浏览模式状态      | --> | 切换到编辑模式    |
+-------------------+     +-------------------+
         |                        |
         v                        v
+-------------------+     +-------------------+
| 更新浏览状态      |     | 编辑模式状态      |
+-------------------+     +-------------------+
         |                        |
         v                        v
+-------------------+     +-------------------+
| 关闭标签(浏览)    |     | 保存文件          |
+-------------------+     +-------------------+
                                  |
                                  v
                          +-------------------+
                          | 关闭标签(编辑)    |
                          +-------------------+
```

## 四、UI设计更新

### 1. 模式切换控件

```
+------------------------------------------+
| [👁️ 浏览] | [✏️ 编辑] | [🔄 刷新] | [💾 保存] |
+------------------------------------------+
```

### 2. 标签栏设计

```
+-----+-----+-----+-----+-----+
| T1  | T2* | T3  | T4E | +   |
+-----+-----+-----+-----+-----+
```

- **标签状态指示**：
  - `*` - 已修改
  - `E` - 编辑模式
  - 默认 - 浏览模式

### 3. 模式指示器

```
+------------------------------------------+
| 📄 浏览模式 - 已加载: 2MB/10MB (20%)     |
+------------------------------------------+

+------------------------------------------+
| ✏️ 编辑模式 - 已加载: 10MB/10MB (100%)    |
+------------------------------------------+
```

## 五、技术实现细节

### 1. 浏览模式核心实现

```typescript
class BrowseMode {
  // 分块加载
  async loadChunk(start: number, end: number): Promise<string[]> {
    // 使用系统命令获取指定范围的行
    return this.executeCommand(`sed -n '${start},${end}p' "${this.filePath}"`);
  }
  
  // 过滤实现
  async applyFilter(pattern: string): Promise<FilterResult> {
    // 使用grep命令过滤
    return this.executeCommand(`grep -n "${pattern}" "${this.filePath}"`);
  }
  
  // 搜索实现
  async search(pattern: string): Promise<SearchResult[]> {
    // 使用grep命令搜索
    return this.executeCommand(`grep -n "${pattern}" "${this.filePath}"`);
  }
  
  // 实时更新
  startRealtime(): void {
    // 使用tail -f命令监控文件变化
    this.realtimeProcess = this.executeCommand(`tail -f "${this.filePath}"`, true);
  }
}
```

### 2. 编辑模式核心实现

```typescript
class EditMode {
  // 完整加载文件
  async loadFile(): Promise<string> {
    return fs.promises.readFile(this.filePath, this.encoding);
  }
  
  // 初始化编辑器
  initEditor(container: HTMLElement, content: string): void {
    this.editor = monaco.editor.create(container, {
      value: content,
      language: this.detectLanguage(),
      theme: 'vs-dark'
    });
  }
  
  // 保存文件
  async saveFile(): Promise<boolean> {
    const content = this.editor.getValue();
    await fs.promises.writeFile(this.filePath, content, this.encoding);
    return true;
  }
}
```

### 3. 模式切换实现

```typescript
class FileEditorManager {
  // 切换到编辑模式
  async switchToEditMode(): Promise<boolean> {
    // 显示确认对话框
    if (this.fileState.size > 10 * 1024 * 1024) { // 10MB
      const confirm = await this.showConfirmDialog(
        `切换到编辑模式将加载整个文件(${this.formatSize(this.fileState.size)})到内存中，可能需要一些时间。是否继续？`
      );
      if (!confirm) return false;
    }
    
    // 显示加载进度
    this.showProgress();
    
    try {
      // 加载整个文件
      const content = await this.editMode.loadFile();
      
      // 初始化编辑器
      this.editMode.initEditor(this.container, content);
      
      // 更新状态
      this.currentMode = 'edit';
      this.updateTabState({ mode: 'edit' });
      
      return true;
    } catch (error) {
      this.showError(`加载文件失败: ${error.message}`);
      return false;
    } finally {
      this.hideProgress();
    }
  }
  
  // 切换到浏览模式
  async switchToBrowseMode(): Promise<boolean> {
    // 检查是否有未保存的更改
    if (this.editMode.isDirty()) {
      const action = await this.showSaveDialog();
      if (action === 'cancel') return false;
      if (action === 'save') {
        await this.editMode.saveFile();
      }
    }
    
    // 释放编辑器资源
    this.editMode.dispose();
    
    // 初始化浏览模式
    await this.browseMode.initialize();
    
    // 更新状态
    this.currentMode = 'browse';
    this.updateTabState({ mode: 'browse' });
    
    return true;
  }
}
```

## 六、多标签状态管理实现

### 1. 标签存储实现

```typescript
class TabStore {
  @observable tabs: Map<string, EditorTab> = new Map();
  @observable activeTabId: string | null = null;
  
  @action
  addTab(tab: EditorTab): void {
    this.tabs.set(tab.id, tab);
    this.setActiveTab(tab.id);
  }
  
  @action
  updateTab(tabId: string, updates: Partial<EditorTab>): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      this.tabs.set(tabId, { ...tab, ...updates });
      this.notifyTabChanged(tabId, updates);
    }
  }
  
  @action
  setActiveTab(tabId: string): void {
    // 将当前活跃标签设为非活跃
    if (this.activeTabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        this.tabs.set(this.activeTabId, { ...currentTab, isActive: false });
      }
    }
    
    // 设置新的活跃标签
    const newActiveTab = this.tabs.get(tabId);
    if (newActiveTab) {
      this.tabs.set(tabId, { ...newActiveTab, isActive: true });
      this.activeTabId = tabId;
      this.notifyTabActivated(tabId);
    }
  }
  
  @action
  removeTab(tabId: string): void {
    this.tabs.delete(tabId);
    
    // 如果关闭的是当前活跃标签，则激活下一个标签
    if (this.activeTabId === tabId) {
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.setActiveTab(remainingTabs[0]);
      } else {
        this.activeTabId = null;
      }
    }
    
    this.notifyTabClosed(tabId);
  }
  
  // 事件通知
  private notifyTabChanged(tabId: string, changes: object): void {
    // 通过IPC通知其他窗口
    ipcRenderer.send('tab-state-changed', { tabId, changes });
  }
  
  private notifyTabActivated(tabId: string): void {
    ipcRenderer.send('tab-activated', { tabId });
  }
  
  private notifyTabClosed(tabId: string): void {
    ipcRenderer.send('tab-closed', { tabId });
  }
}
```

### 2. 标签同步机制

```typescript
// 主进程中的标签同步管理
class TabSyncManager {
  // 存储所有窗口的标签状态
  private tabStates: Map<string, EditorTab> = new Map();
  // 存储标签与窗口的关系
  private tabWindows: Map<string, BrowserWindow[]> = new Map();
  
  constructor() {
    // 监听标签状态变更
    ipcMain.on('tab-state-changed', (event, { tabId, changes }) => {
      this.updateTabState(tabId, changes);
      this.broadcastTabState(tabId, event.sender);
    });
    
    // 监听标签激活
    ipcMain.on('tab-activated', (event, { tabId }) => {
      this.broadcastTabActivation(tabId, event.sender);
    });
    
    // 监听标签关闭
    ipcMain.on('tab-closed', (event, { tabId }) => {
      this.removeTabState(tabId);
      this.broadcastTabClosure(tabId, event.sender);
    });
  }
  
  // 更新标签状态
  private updateTabState(tabId: string, changes: object): void {
    const currentState = this.tabStates.get(tabId) || {};
    this.tabStates.set(tabId, { ...currentState, ...changes });
  }
  
  // 移除标签状态
  private removeTabState(tabId: string): void {
    this.tabStates.delete(tabId);
    this.tabWindows.delete(tabId);
  }
  
  // 广播标签状态变更到其他窗口
  private broadcastTabState(tabId: string, sender: WebContents): void {
    const windows = this.tabWindows.get(tabId) || [];
    const state = this.tabStates.get(tabId);
    
    if (state) {
      for (const win of windows) {
        if (win.webContents !== sender) {
          win.webContents.send('tab-state-updated', { tabId, state });
        }
      }
    }
  }
  
  // 广播标签激活到其他窗口
  private broadcastTabActivation(tabId: string, sender: WebContents): void {
    const windows = this.tabWindows.get(tabId) || [];
    
    for (const win of windows) {
      if (win.webContents !== sender) {
        win.webContents.send('tab-activated', { tabId });
      }
    }
  }
  
  // 广播标签关闭到其他窗口
  private broadcastTabClosure(tabId: string, sender: WebContents): void {
    const windows = this.tabWindows.get(tabId) || [];
    
    for (const win of windows) {
      if (win.webContents !== sender) {
        win.webContents.send('tab-closed', { tabId });
      }
    }
  }
  
  // 注册窗口与标签的关系
  registerTabWindow(tabId: string, window: BrowserWindow): void {
    const windows = this.tabWindows.get(tabId) || [];
    if (!windows.includes(window)) {
      windows.push(window);
      this.tabWindows.set(tabId, windows);
    }
  }
  
  // 取消注册窗口与标签的关系
  unregisterTabWindow(tabId: string, window: BrowserWindow): void {
    const windows = this.tabWindows.get(tabId) || [];
    const index = windows.indexOf(window);
    
    if (index !== -1) {
      windows.splice(index, 1);
      if (windows.length === 0) {
        this.tabWindows.delete(tabId);
      } else {
        this.tabWindows.set(tabId, windows);
      }
    }
  }
}
```

## 七、性能优化策略

### 1. 浏览模式优化
- **命令执行优化**：使用流式处理减少内存占用
- **结果缓存**：缓存常用命令结果减少重复执行
- **虚拟滚动**：只渲染可视区域内容
- **后台预加载**：预测用户滚动方向，提前加载内容

### 2. 编辑模式优化
- **分块渲染**：大文件分块渲染减少DOM节点数量
- **延迟语法高亮**：优先渲染内容，延迟应用语法高亮
- **编辑器配置优化**：禁用不必要的特性提高性能
- **内存监控**：监控内存使用，必要时释放资源

### 3. 多标签优化
- **标签状态懒加载**：只加载活跃标签的完整状态
- **非活跃标签资源释放**：释放非活跃标签占用的资源
- **标签数量限制**：限制同时打开的标签数量
- **标签状态压缩存储**：压缩存储标签状态减少内存占用

## 八、实施路线图

### 第一阶段：基础架构重构
1. 实现双模式基础架构
2. 完善浏览模式命令执行
3. 实现基本的标签管理

### 第二阶段：功能完善
1. 实现编辑模式完整功能
2. 完善模式切换机制
3. 实现多标签状态同步

### 第三阶段：优化与增强
1. 性能优化
2. 用户界面优化
3. 错误处理与恢复机制
4. 用户体验改进

## 九、总结

本重构方案通过引入浏览模式和编辑模式的双模式设计，结合完善的多标签状态管理，可以有效解决大文件处理的性能问题，同时保持良好的用户体验。浏览模式专注于高效的文件查看和过滤，而编辑模式则提供完整的编辑功能。多标签状态管理确保了在复杂场景下的状态一致性和用户操作的可靠性。

该方案借鉴了主流编辑器的设计理念，同时针对远程文件编辑的特殊需求进行了优化，是一个平衡性能和功能的实用解决方案。 