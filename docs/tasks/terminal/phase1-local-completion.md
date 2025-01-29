# 第一阶段：本地补全基础框架开发计划

## 1. 数据库设计和实现（3天）

### 1.1 SQLite 数据库集成
- [x] 在 Electron 主进程中集成 SQLite
  ```typescript
  // 示例代码：数据库初始化
  import sqlite3 from 'sqlite3';
  import { Database, open } from 'sqlite';

  export class DatabaseService {
    private db: Database | null = null;

    async init() {
      this.db = await open({
        filename: 'command-history.db',
        driver: sqlite3.Database
      });
      await this.createTables();
    }
  }
  ```

### 1.2 数据库表结构设计
- [x] 创建命令历史表
  ```sql
  CREATE TABLE IF NOT EXISTS command_history (
    id INTEGER PRIMARY KEY,
    command TEXT NOT NULL,
    context TEXT,
    frequency INTEGER DEFAULT 1,
    last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN DEFAULT true
  );
  CREATE INDEX idx_command ON command_history(command);
  CREATE INDEX idx_frequency ON command_history(frequency DESC);
  ```

- [x] 创建命令关系表
  ```sql
  CREATE TABLE IF NOT EXISTS command_relations (
    id INTEGER PRIMARY KEY,
    command1_id INTEGER,
    command2_id INTEGER,
    relation_type TEXT,
    frequency INTEGER DEFAULT 1,
    FOREIGN KEY (command1_id) REFERENCES command_history(id),
    FOREIGN KEY (command2_id) REFERENCES command_history(id)
  );
  CREATE INDEX idx_relations ON command_relations(command1_id, command2_id);
  ```

### 1.3 数据访问层实现
- [x] 实现命令历史记录管理
  - 添加新命令
  - 更新命令频率
  - 查询命令历史
  - 删除过期记录

- [x] 实现命令关系管理
  - 记录命令执行顺序
  - 分析命令关联性
  - 优化关系查询

## 2. 基础补全框架搭建（4天）

### 2.1 补全核心功能
- [x] 实现实时补全逻辑
  ```typescript
  interface ICompletionSuggestion {
    fullCommand: string;    // 完整的命令
    suggestion: string;     // 建议补全的部分
    source: CompletionSource;
    score: number;         // 建议的相关度得分
  }

  class CompletionService {
    // 获取实时补全建议（返回前3个最佳匹配）
    async getSuggestions(input: string): Promise<ICompletionSuggestion[]> {
      // 1. 从历史记录中查找匹配的命令
      // 2. 按得分排序
      // 3. 返回前3个建议
    }

    // 接受当前建议
    acceptSuggestion(suggestion: ICompletionSuggestion): string {
      // 返回完整的命令
    }
  }
  ```

### 2.2 交互设计
- [x] 实现智能补全交互
  ```typescript
  interface ICompletionDropdown {
    visible: boolean;
    suggestions: ICompletionSuggestion[];
    selectedIndex: number;
    position: {
      left: number;
      top: number;
    };
  }

  // 补全下拉框组件
  const CompletionDropdown: React.FC<ICompletionDropdownProps> = ({
    suggestions,
    selectedIndex,
    position,
    onSelect
  }) => {
    // 渲染补全建议列表
    // 处理选项高亮
    // 跟随光标定位
  }
  ```

- [x] 补全交互流程
  - 用户输入时隐藏下拉框
  - 停止输入1秒后显示下拉框，展示前3个最佳匹配建议
  - 下拉框跟随光标位置显示
  - 默认选中第一个建议
  - Alt+上/下键切换选中项
  - Tab键接受当前选中的建议
  - 继续输入时隐藏下拉框

### 2.3 终端集成
- [x] 实现终端输入处理
  ```typescript
  // 处理用户输入
  const handleInput = async (data: string) => {
    // 1. 处理特殊键(Tab, Alt+方向键)
    // 2. 更新当前输入
    // 3. 管理补全状态和下拉框显示
  }

  // 补全计时器
  const startSuggestionTimer = (input: string) => {
    // 1. 延迟1秒后获取建议
    // 2. 计算下拉框位置
    // 3. 显示下拉框
  }

  // 处理方向键
  const handleAltArrowKeys = (event: KeyboardEvent) => {
    // 1. 检查Alt+方向键
    // 2. 更新选中项索引
    // 3. 更新下拉框显示
  }
  ```

## 3. 补全显示实现（4天）

### 3.1 下拉框渲染
- [x] 实现补全下拉框
  - 使用绝对定位跟随光标
  - 半透明背景保持终端风格
  - 高亮显示当前选中项
  - 最多显示3个建议
  - 实现平滑的显示/隐藏动画

### 3.2 交互处理
- [x] 实现键盘事件
  - Tab键接受当前选中建议
  - Alt+上/下键切换选中项
  - 其他按键隐藏下拉框
  - ESC键关闭下拉框

### 3.3 状态管理
- [x] 实现补全状态
  - 跟踪当前输入
  - 管理建议列表
  - 跟踪选中项索引
  - 管理下拉框显示状态
  - 计算和更新下拉框位置

## 4. 集成测试（3天）

### 4.1 功能测试
- [x] 测试补全功能
  - 建议获取和排序
  - 下拉框显示和定位
  - 键盘交互响应
  - 建议选择和补全

### 4.2 性能测试
- [x] 测试系统性能
  - 补全响应时间
  - 下拉框渲染性能
  - 位置计算性能
  - 内存占用

### 4.3 稳定性测试
- [x] 测试系统稳定性
  - 异常处理
  - 边界情况
  - 并发操作
  - 快速输入处理

## 5. 验收标准

### 5.1 功能验收
- [x] 补全功能
  - 停止输入1秒后显示下拉框
  - 显示前3个最佳匹配建议
  - 下拉框正确跟随光标
  - Alt+方向键正确切换选项
  - Tab键正确补全选中项

### 5.2 性能验收
- [x] 补全响应时间 < 50ms
- [x] 显示延迟稳定在1秒
- [x] 下拉框位置计算延迟 < 16ms
- [x] 内存占用合理

### 5.3 代码质量
- [x] 代码结构清晰
- [x] 注释完整
- [x] 测试覆盖率 > 80% 