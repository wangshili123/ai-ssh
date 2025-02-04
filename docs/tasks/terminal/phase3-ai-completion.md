# 第三阶段：AI 学习与补全优化

## 1. 项目结构设计

```
src/
  ├── services/
  │   ├── completion/              # 补全相关服务
  │   │   ├── engine/             # 补全引擎
  │   │   │   ├── CompletionEngine.ts     # 补全核心引擎
  │   │   │   ├── LocalRuleEngine.ts      # 本地规则引擎
  │   │   │   └── types/
  │   │   │       └── engine.types.ts     # 引擎相关类型
  │   │   │
  │   │   ├── collector/          # 数据收集
  │   │   │   ├── CommandCollector.ts     # 命令数据收集
  │   │   │   ├── UsageCollector.ts       # 使用数据收集
  │   │   │   └── types/
  │   │   │       └── collector.types.ts  # 收集器类型
  │   │   │
  │   │   └── learning/           # AI 学习系统
  │   │       ├── CommandLearner.ts       # 命令学习器
  │   │       ├── RuleGenerator.ts        # 规则生成器
  │   │       └── types/
  │   │           └── learning.types.ts   # 学习相关类型
  │   │
  │   ├── database/               # 数据库服务
  │   │   ├── models/
  │   │   │   ├── CommandHistory.ts       # 已有的命令历史
  │   │   │   ├── CommandRelation.ts      # 命令关系
  │   │   │   ├── CompletionRules.ts      # 补全规则
  │   │   │   └── LearningData.ts         # 学习数据
  │   │   └── migrations/
  │   │       └── 002_learning_tables.ts  # 学习相关表结构
  │   │
  │   └── ai/
  │       └── AIService.ts        # 通用 AI 服务（已存在）
```

## 2. 核心组件设计

### 2.1 补全引擎 (CompletionEngine)

1. **补全核心引擎**
   - 功能：提供实时的命令补全服务
   - 工作方式：
     * 同步处理：基于本地规则快速响应
     * 规则驱动：使用学习生成的规则
     * 上下文感知：考虑当前环境
   - 主要职责：
     * 处理用户输入
     * 匹配补全规则
     * 生成补全建议
     * 排序补全结果

2. **本地规则引擎**
   - 功能：管理和应用补全规则
   - 工作方式：
     * 内存缓存：常用规则常驻内存
     * 索引优化：快速规则查找
     * 规则更新：定期同步数据库
   - 主要职责：
     * 规则加载和缓存
     * 规则匹配和应用
     * 规则优先级管理
     * 规则有效性验证

### 2.2 数据收集系统

1. **命令收集器**
   - 功能：收集用户命令数据
   - 工作方式：
     * 实时记录：捕获命令执行
     * 批量处理：定期数据清洗
     * 增量存储：优化存储效率
   - 主要职责：
     * 记录命令内容
     * 收集执行上下文
     * 跟踪执行结果
     * 关联相关命令

2. **使用数据收集器**
   - 功能：收集补全使用数据
   - 工作方式：
     * 行为跟踪：记录用户选择
     * 效果分析：统计采纳率
     * 问题诊断：记录异常情况
   - 主要职责：
     * 跟踪补全使用
     * 记录用户选择
     * 统计使用效果
     * 收集反馈数据

### 2.3 AI 学习系统

1. **命令学习器**
   - 功能：分析命令使用模式
   - 工作方式：
     * 离线分析：定期处理数据
     * 模式识别：发现使用规律
     * 渐进学习：持续优化结果
   - 主要职责：
     * 分析命令模式
     * 识别参数规律
     * 发现命令关联
     * 生成学习结果

2. **规则生成器**
   - 功能：基于学习结果生成规则
   - 工作方式：
     * 定期更新：固定周期生成
     * 增量更新：持续优化规则
     * 质量控制：验证规则有效性
   - 主要职责：
     * 转换学习结果
     * 生成补全规则
     * 评估规则质量
     * 优化规则结构

## 3. 数据库设计

### 3.1 学习数据表
```sql
CREATE TABLE learning_data (
    id INTEGER PRIMARY KEY,
    command_pattern TEXT NOT NULL,     -- 命令模式
    parameter_pattern TEXT,            -- 参数模式
    context_pattern TEXT,              -- 上下文模式
    frequency INTEGER DEFAULT 1,        -- 出现频率
    last_used_at TIMESTAMP,            -- 最后使用时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_command_pattern ON learning_data(command_pattern);
CREATE INDEX idx_last_used ON learning_data(last_used_at);
```

### 3.2 补全规则表
```sql
CREATE TABLE completion_rules (
    id INTEGER PRIMARY KEY,
    pattern TEXT NOT NULL,             -- 匹配模式
    suggestions JSON NOT NULL,         -- 补全建议
    source TEXT NOT NULL,              -- 规则来源：learning/manual
    confidence FLOAT NOT NULL,         -- 置信度
    usage_count INTEGER DEFAULT 0,     -- 使用次数
    hit_rate FLOAT DEFAULT 0,         -- 命中率
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    last_used_at TIMESTAMP,           -- 最后使用时间
    is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_pattern ON completion_rules(pattern);
CREATE INDEX idx_usage ON completion_rules(usage_count DESC);
```

### 3.3 规则评估表
```sql
CREATE TABLE rule_evaluations (
    id INTEGER PRIMARY KEY,
    rule_id INTEGER NOT NULL,
    evaluation_type TEXT NOT NULL,     -- 评估类型：accuracy/adoption
    score FLOAT NOT NULL,             -- 评估分数
    sample_size INTEGER NOT NULL,      -- 样本数量
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rule_id) REFERENCES completion_rules(id)
);

CREATE INDEX idx_rule_eval ON rule_evaluations(rule_id, evaluation_type);
```

## 4. 工作流程

### 4.1 数据收集流程
```
用户操作 → 命令收集器 → 原始数据存储 → 数据清洗 → 学习数据表
```

### 4.2 学习流程
```
学习数据 → 命令学习器 → 学习结果 → 规则生成器 → 补全规则表
```

### 4.3 补全流程
```
用户输入 → 补全引擎 → 规则匹配 → 生成建议 → 返回结果
```

## 5. 监控和维护

### 5.1 性能监控
- 补全响应时间
- 规则匹配效率
- 学习任务耗时
- 存储空间使用

### 5.2 质量监控
- 规则准确率
- 补全采纳率
- 学习效果
- 数据质量

## 6. 开发计划

### 第一周：基础设施
1. 补全引擎框架
2. 数据收集系统
3. 数据库表设计

### 第二周：学习系统
1. 命令学习器
2. 规则生成器
3. 规则管理

### 第三周：优化和测试
1. 性能优化
2. 单元测试
3. 集成测试 