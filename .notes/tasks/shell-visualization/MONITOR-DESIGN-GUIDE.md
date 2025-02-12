# 系统监控功能设计指导文档

## 1. 文档结构

### 1.1 设计文档目录
```
.notes/tasks/shell-visualization/
├── 1-base-framework.md              # 基础框架搭建步骤
├── 2-core-metrics/                  # 核心监控指标
│   ├── 2.1-cpu-memory.md           # CPU和内存监控
│   ├── 2.2-disk.md                 # 磁盘监控
│   ├── 2.3-network.md              # 网络监控
│   └── 2.4-charts.md               # 图表组件封装
├── 3-process-management/            # 进程管理功能
│   ├── 3.1-process-list.md         # 进程列表
│   ├── 3.2-process-detail.md       # 进程详情
│   └── 3.3-process-operation.md    # 进程操作
├── 4-service-management/            # 服务管理功能
│   ├── 4.1-service-list.md         # 服务列表
│   └── 4.2-service-operation.md    # 服务操作
├── 5-user-management/              # 用户管理功能
│   ├── 5.1-user-list.md           # 用户列表
│   └── 5.2-user-operation.md      # 用户操作
└── 6-data-export.md               # 数据导出功能
```

### 1.2 代码目录结构
```
src/renderer/
├── components/
│   └── Monitor/                    # 监控相关组件
│       ├── Process/                # 进程管理
│       │   ├── List/              # 进程列表
│       │   ├── Details/           # 进程详情
│       │   └── ProcessPage.tsx    # 进程页面
│       ├── Performance/           # 性能监控
│       │   ├── Cards/            # 资源卡片
│       │   ├── Details/          # 资源详情
│       │   └── PerformancePage.tsx # 性能页面
│       ├── AppHistory/           # 应用历史
│       │   └── HistoryPage.tsx   # 历史页面
│       ├── Startup/              # 启动项
│       │   └── StartupPage.tsx   # 启动页面
│       ├── Users/                # 用户管理
│       │   └── UserPage.tsx      # 用户页面
│       ├── Services/             # 服务管理
│       │   └── ServicePage.tsx   # 服务页面
│       ├── Common/               # 公共组件
│       │   ├── StatusBar/       # 状态栏
│       │   ├── ControlPanel/    # 控制面板
│       │   └── Layout/          # 布局组件
│       └── MonitorPage.tsx       # 监控主页面
├── services/
│   └── monitor/                  # 监控相关服务
│       ├── metrics/              # 指标采集服务
│       │   ├── cpu/             # CPU监控
│       │   ├── memory/          # 内存监控
│       │   ├── disk/            # 磁盘监控
│       │   └── network/         # 网络监控
│       ├── process/             # 进程管理服务
│       ├── service/             # 服务管理服务
│       ├── user/                # 用户管理服务
│       └── history/             # 历史记录服务
└── types/
    └── monitor/                 # 监控相关类型定义
        ├── metrics.ts          # 监控指标类型
        ├── process.ts         # 进程相关类型
        ├── service.ts         # 服务相关类型
        └── user.ts           # 用户相关类型
```

## 2. 开发规范

### 2.1 命名规范
- **文件命名**：
  * 组件文件：使用 PascalCase，如 `ProcessList.tsx`
  * 服务文件：使用 camelCase，如 `processService.ts`
  * 类型文件：使用 camelCase，如 `processTypes.ts`
  * 样式文件：与组件同名，如 `ProcessList.css`

- **目录命名**：
  * 功能模块目录：使用 PascalCase，如 `Monitor/`
  * 服务目录：使用 camelCase，如 `monitor/`

- **组件命名**：
  * 所有监控相关组件必须以 `Monitor` 开头
  * 使用有意义的功能名称，如 `MonitorProcessList`

### 2.2 代码组织
- **组件结构**：
  ```typescript
  // MonitorProcessList.tsx
  import './MonitorProcessList.css';
  
  interface MonitorProcessListProps {
    // props 定义
  }
  
  export const MonitorProcessList: React.FC<MonitorProcessListProps> = () => {
    // 组件实现
  };
  ```

- **服务结构**：
  ```typescript
  // processService.ts
  export class MonitorProcessService {
    // 服务实现
  }
  ```

### 2.3 技术规范

#### 2.3.1 前端技术栈
- React 18+
- TypeScript 4+
- Ant Design 5+
- ECharts 5+ (图表可视化，关键)

#### 2.3.2 数据流
- 使用 React Context 管理监控状态
- 使用 Service 层处理数据逻辑
- 使用 WebSocket 实现实时数据更新

#### 2.3.3 性能优化
- 使用 React.memo 优化组件重渲染
- 使用虚拟滚动处理大量数据
- 实现数据缓存和增量更新

## 3. 开发流程

### 3.1 功能开发步骤
1. 创建功能设计文档
2. 实现数据类型定义
3. 实现服务层功能
4. 实现组件层功能
5. 进行性能优化
6. 编写单元测试

### 3.2 代码提交规范
- feat: 新功能
- fix: 修复问题
- docs: 文档修改
- style: 代码格式修改
- refactor: 代码重构
- perf: 性能优化
- test: 测试相关
- chore: 其他修改

## 4. 注意事项

### 4.1 性能考虑
- 控制数据刷新频率
- 实现数据缓存机制
- 优化组件渲染
- 合理使用懒加载

### 4.2 安全考虑
- 实现权限控制
- 加密敏感数据
- 记录操作日志
- 防止XSS攻击

### 4.3 兼容性考虑
- 支持不同Linux发行版
- 处理不同命令输出格式
- 适配不同屏幕尺寸
- 支持不同语言环境

## 5. 技术依赖

### 5.1 核心依赖
```json
{
  "dependencies": {
    "@ant-design/icons": "^5.0.0",
    "antd": "^5.0.0",
    "echarts": "^5.4.0",
    "react": "^18.0.0",
    "react-virtualized": "^9.22.0",
    "dayjs": "^1.11.0"
  }
}
```

### 5.2 开发依赖
```json
{
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@typescript-eslint/eslint-plugin": "^5.0.0",
    "@typescript-eslint/parser": "^5.0.0",
    "eslint": "^8.0.0",
    "typescript": "^4.9.0"
  }
}
``` 