# 文件编辑器重构 - 第一阶段：基础架构设计

## 当前进度

**状态**: 规划中

## 现有代码分析

通过对现有代码的分析，我们发现当前的文件编辑器实现已经包含了以下组件：

1. **核心模块**:
   - `FileEditorManager.ts`: 编辑器核心管理类
   - `FileLoaderManager.ts`: 文件加载管理
   - `EditorManager.ts`: Monaco编辑器集成
   - `FilterManager.ts`: 过滤功能
   - `SearchManager.ts`: 搜索功能
   - `FileWatchManager.ts`: 文件监控
   - `VirtualScroller.ts`: 虚拟滚动
   - `ErrorManager.ts`: 错误处理

2. **UI组件**:
   - `EditorWindow`: 编辑器窗口
   - `EditorTabs`: 标签管理
   - `FileEditorMain`: 主编辑区域
   - `FileEditorToolbar`: 工具栏
   - `FileStatusBar`: 状态栏
   - `FileFilterPanel`: 过滤面板
   - `FileSearchPanel`: 搜索面板

3. **状态管理**:
   - `EditorTabStore.ts`: 标签状态管理

## 重构计划

### 1. 双模式架构设计

我们将在现有代码基础上实现双模式架构，主要包括：

#### 1.1 模式定义

- **浏览模式（默认）**:
  - 基于现有的`FileLoaderManager`和`VirtualScroller`
  - 增强命令行工具集成
  - 优化分块加载策略

- **编辑模式**:
  - 基于现有的`EditorManager`
  - 增加完整加载文件的功能
  - 优化内存管理

#### 1.2 核心类修改

1. **修改 `FileEditorManager.ts`**:
   - 添加模式状态管理
   - 实现模式切换逻辑
   - 协调不同模式下的组件交互

2. **创建/修改 `BrowseMode.ts`**:
   - 封装系统命令执行
   - 实现高效的分块加载
   - 集成过滤和搜索功能

3. **修改 `EditorManager.ts` 为 `EditMode.ts`**:
   - 优化完整文件加载
   - 增强编辑器性能
   - 实现编辑状态管理

#### 1.3 状态管理修改

1. **增强 `EditorTabStore.ts`**:
   - 添加模式状态
   - 支持模式切换事件
   - 优化标签生命周期管理

2. **创建 `TabSyncManager.ts`**:
   - 实现标签状态同步
   - 处理窗口间通信
   - 解决冲突问题

### 2. 类型定义更新

1. **修改 `FileEditorTypes.ts`**:
   - 添加模式相关类型
   - 更新事件类型
   - 完善状态接口定义

## 下一步行动

1. 修改 `FileEditorTypes.ts` 添加双模式相关的类型定义
2. 修改 `FileEditorManager.ts` 实现模式状态管理和切换逻辑
3. 创建/修改 `BrowseMode.ts` 实现浏览模式核心功能
4. 修改 `EditorTabStore.ts` 支持模式状态管理

## 注意事项

- 保持向后兼容性，确保现有功能不受影响
- 遵循项目的代码组织和命名规范
- 每个文件不超过200行，超过时拆分功能
- 添加详细注释说明实现逻辑 