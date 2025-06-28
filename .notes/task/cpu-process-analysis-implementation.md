# CPU进程分析功能实现完成

## 功能概述

已成功为CPU详情页面添加了"进程分析"标签页，提供以下功能：

### 核心功能
- ✅ **实时进程CPU占用排行**：显示CPU占用最高的前15个进程
- ✅ **进程详细信息展示**：点击进程可查看详细信息和线程列表
- ✅ **智能排序和过滤**：支持按CPU、内存、PID等维度排序
- ✅ **进程状态监控**：实时显示进程运行状态
- ✅ **响应式界面设计**：适配不同屏幕尺寸

## 实现的文件

### 1. 数据类型定义
- `src/renderer/types/monitor/monitor.ts`
  - 新增 `CpuProcessInfo` 接口
  - 新增 `CpuThreadInfo` 接口  
  - 新增 `CpuProcessAnalysis` 接口
  - 扩展 `CpuDetailInfo` 接口，添加 `processAnalysis` 字段

### 2. 数据采集服务
- `src/renderer/services/monitor/performance/cpuProcessService.ts`
  - 实现进程CPU使用率数据采集
  - 实现线程信息获取
  - 实现进程详细信息查询
  - 使用 `ps aux`、`ps -T` 等Linux命令

### 3. 集成到现有服务
- `src/renderer/services/monitor/performance/cpuService.ts`
  - 集成 `CpuProcessService`
  - 修改 `collectDetailMetrics` 方法支持 `processes` 标签页
  - 按需加载进程数据，优化性能

- `src/renderer/services/monitor/monitorManager.ts`
  - 添加 `getCpuProcessService()` 方法
  - 统一数据获取管理

### 4. 用户界面组件
- `src/renderer/components/Monitor/Performance/Cards/CpuDetail/CpuProcessAnalysis.tsx`
  - 主要的进程分析组件
  - 进程列表表格展示
  - 实时刷新和设置功能

- `src/renderer/components/Monitor/Performance/Cards/CpuDetail/ProcessDetailView.tsx`
  - 进程详情展示组件
  - 基本信息和线程列表
  - 进程操作功能

- `src/renderer/components/Monitor/Performance/Cards/CpuDetail/CpuProcessAnalysis.css`
  - 专门的样式文件
  - 响应式设计
  - 优化的表格和布局样式

### 5. 集成到现有页面
- `src/renderer/components/Monitor/Performance/Cards/CpuDetail/CpuDetailTab.tsx`
  - 添加"进程分析"标签页
  - 集成到现有的标签页切换逻辑

## 技术特点

### 1. 统一数据获取方式
- 遵循现有的 `monitorManager` 统一数据获取模式
- 通过 `activeTab` 参数按需加载数据
- 复用现有的刷新和缓存机制

### 2. 性能优化
- 只在"进程分析"标签页激活时采集进程数据
- 数据缓存避免重复请求
- 合理的刷新间隔（3秒）

### 3. 用户体验
- 响应式布局适配不同屏幕
- 加载状态和错误处理
- 直观的进度条和状态标签
- 工具提示和详细信息展示

### 4. 扩展性设计
- 模块化的服务架构
- 清晰的接口定义
- 易于添加新功能（如进程终止、文件查看等）

## 界面展示

```
┌─────────────────────────────────────────────────────────┐
│ [基础信息] [逻辑处理器] [进程分析] ← 新增标签              │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────────────────────┐ │
│ │   TOP进程列表    │ │        进程详情面板              │ │
│ │                │ │                                │ │
│ │ PID | 进程名     │ │  ┌─────────────────────────┐   │ │
│ │ CPU | 内存      │ │  │     进程基本信息         │   │ │
│ │ 状态| 启动时间   │ │  └─────────────────────────┘   │ │
│ │                │ │  ┌─────────────────────────┐   │ │
│ │ [刷新] [设置]   │ │  │     线程CPU占用列表      │   │ │
│ └─────────────────┘ │  └─────────────────────────┘   │ │
│                    └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

## 使用方法

1. 打开监控页面，选择"性能"标签
2. 在CPU卡片中点击进入详情页面
3. 切换到"进程分析"标签页
4. 查看CPU占用最高的进程列表
5. 点击任意进程查看详细信息和线程列表
6. 使用刷新按钮手动更新数据

## 后续可扩展功能

- 进程终止功能
- 进程文件查看
- 进程优先级调整
- 进程搜索和过滤
- 历史趋势分析
- 导出功能

## 注意事项

- 需要目标系统安装 `ps` 命令（大部分Linux系统默认安装）
- 某些进程信息可能需要特殊权限才能获取
- 刷新频率可根据需要调整，避免过度消耗系统资源
