# 第三阶段：AI 学习与补全优化

## 1. 项目结构设计

```
src/
  ├── services/
  │   ├── completion/           # 现有的补全服务
  │   │   └── learning/        # 新增 AI 学习模块
  │   │       ├── collector/   # 数据收集
  │   │       │   ├── CommandUsageCollector.ts  # 命令使用收集
  │   │       │   └── CompletionUsageCollector.ts  # 补全使用收集
  │   │       │
  │   │       ├── analyzer/    # 学习分析
  │   │       │   ├── PatternAnalyzer.ts    # 模式分析器
  │   │       │   └── RuleOptimizer.ts      # 规则优化器
  │   │       │
  │   │       ├── cache/      # 缓存管理
  │   │       │   ├── WeightCache.ts       # 权重缓存
  │   │       │   └── UsageCache.ts        # 使用数据缓存
  │   │       │
  │   │       └── types/
  │   │           └── learning.types.ts
  │   │
  │   ├── database/           # 数据库服务
  │   │   ├── models/
  │   │   │   ├── CommandUsage.ts     # 命令使用记录
  │   │   │   └── CompletionUsage.ts  # 补全使用记录
  │   │   └── migrations/
  │   │       └── 002_learning_tables.ts
  │   │
  │   └── ai/
  │       └── AIService.ts    # 通用 AI 服务
```

## 2. 核心组件设计

### 2.1 数据收集系统

1. **命令使用收集器 (CommandUsageCollector)**
   - 功能：收集用户命令使用数据
   - 工作方式：
     * 内存缓冲：批量收集减少 IO
     * 定时保存：避免频繁写入
     * 异步处理：不影响主流程
   - 主要职责：
     * 记录命令使用
     * 统计使用频率
     * 管理数据缓冲
     * 定期持久化

2. **补全使用收集器 (CompletionUsageCollector)**
   - 功能：收集补全选择数据
   - 工作方式：
     * 内存缓冲：批量处理
     * 周期性存储：定时保存
     * 异步记录：不阻塞补全
   - 主要职责：
     * 记录补全选择
     * 跟踪采纳率
     * 管理缓冲区
     * 执行持久化

### 2.2 学习分析系统

1. **模式分析器 (PatternAnalyzer)**
   - 功能：分析命令使用模式
   - 工作方式：
     * 离线分析：不影响实时补全
     * 定期执行：固定周期分析
     * 增量处理：只分析新数据
     * AI 分析：利用大模型进行深度分析
   - 主要职责：
     * 分析使用频率
     * 识别使用模式
     * 生成优化建议
     * 评估分析结果
   - AI 模型应用：
     * 输入：批量的命令使用记录和补全选择数据
     * 分析维度：
       - 命令间的语义关联
       - 参数使用模式
       - 上下文相关性
       - 用户习惯特征
     * 输出：优化后的规则权重和新规则建议

2. **规则优化器 (RuleOptimizer)**
   - 功能：优化补全规则权重
   - 工作方式：
     * 定期优化：固定周期更新
     * 增量更新：最小化影响
     * 原子操作：确保一致性
   - 主要职责：
     * 更新规则权重
     * 添加新规则
     * 清理旧规则
     * 维护规则版本

### 2.3 缓存系统

1. **权重缓存 (WeightCache)**
   - 功能：缓存规则权重数据
   - 工作方式：
     * 内存缓存：快速访问
     * 双层缓存：热点和普通
     * LRU 策略：自动淘汰
   - 主要职责：
     * 缓存权重数据
     * 管理缓存生命周期
     * 处理缓存更新
     * 提供快速访问

2. **使用数据缓存 (UsageCache)**
   - 功能：缓存使用统计数据
   - 工作方式：
     * 内存缓冲：减少 IO
     * 批量处理：优化性能
     * 定期同步：保证可靠性
   - 主要职责：
     * 缓存使用数据
     * 管理数据生命周期
     * 执行批量同步
     * 提供统计接口

### 2.4 AI 分析系统

1. **AI 分析服务 (AIAnalysisService)**
   - 功能：利用 AI 大模型分析命令数据
   - 工作方式：
     * 定期分析：每日/每周执行
     * 批量处理：聚合分析多条数据
     * 异步执行：后台运行不影响实时业务
   - 主要职责：
     * 数据预处理：
       - 清洗原始命令数据
       - 提取关键特征
       - 构建分析上下文
     * AI 分析流程：
       - 构建分析 Prompt
       - 调用 AI 模型
       - 解析模型输出
     * 结果处理：
       - 验证分析结果
       - 转换为规则格式
       - 更新权重数据

2. **Prompt 管理器 (PromptManager)**
   - 功能：管理和优化 AI 分析的 Prompt
   - 工作方式：
     * 模板化：使用预定义模板
     * 动态组装：根据分析需求构建
     * 版本控制：跟踪 Prompt 效果
   - 主要职责：
     * 维护 Prompt 模板：
       - 命令关联分析模板
       - 参数模式分析模板
       - 上下文关联模板
     * 优化 Prompt 策略：
       - 根据分析效果调整
       - 控制 token 使用量
       - 确保输出格式规范

3. **分析调度器 (AnalysisScheduler)**
   - 功能：调度和管理 AI 分析任务
   - 工作方式：
     * 定时触发：按计划执行分析
     * 条件触发：达到阈值时触发
     * 资源控制：管理 API 调用配额
   - 主要职责：
     * 任务调度：
       - 安排分析时间
       - 控制并发数量
       - 处理失败重试
     * 资源管理：
       - 监控 API 用量
       - 控制成本开支
       - 优化调用效率

## 3. 数据库设计

### 3.1 命令使用表
```sql
CREATE TABLE command_usage (
    id INTEGER PRIMARY KEY,
    command TEXT NOT NULL,        -- 实际使用的命令
    frequency INTEGER DEFAULT 1,   -- 使用频率
    last_used_at TIMESTAMP,       -- 最后使用时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_command ON command_usage(command);
CREATE INDEX idx_frequency ON command_usage(frequency DESC);
```

### 3.2 补全使用表
```sql
CREATE TABLE completion_usage (
    id INTEGER PRIMARY KEY,
    input TEXT NOT NULL,          -- 用户输入
    selected TEXT NOT NULL,       -- 选中的补全
    frequency INTEGER DEFAULT 1,   -- 选中频率
    adoption_rate FLOAT,          -- 采纳率
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE INDEX idx_input ON completion_usage(input);
CREATE INDEX idx_selected ON completion_usage(selected);
```

### 3.3 规则权重表
```sql
CREATE TABLE rule_weights (
    id INTEGER PRIMARY KEY,
    rule_id INTEGER NOT NULL,     -- 关联到现有规则
    weight FLOAT NOT NULL,        -- 权重值
    confidence FLOAT NOT NULL,    -- 置信度
    last_updated TIMESTAMP,       -- 最后更新时间
    version INTEGER DEFAULT 1,    -- 权重版本
    FOREIGN KEY (rule_id) REFERENCES completion_rules(id)
);

CREATE INDEX idx_rule_weight ON rule_weights(rule_id, weight DESC);
```

## 4. 系统集成

### 4.1 与现有补全系统集成

1. **权重注入机制**
```typescript
class CompletionService {
  // 获取补全结果时注入学习权重
  async getCompletions(input: string): Promise<Completion[]> {
    // 1. 获取基础补全结果
    const baseCompletions = await this.getBaseCompletions(input);
    
    // 2. 注入学习权重
    const weightedCompletions = await this.injectWeights(baseCompletions);
    
    // 3. 重新排序
    return this.reorderCompletions(weightedCompletions);
  }
}
```

2. **结果合并策略**
```typescript
class CompletionMerger {
  // 合并基础结果和学习结果
  async mergeResults(
    baseResults: Completion[],
    weights: WeightMap
  ): Promise<Completion[]> {
    // 1. 应用权重
    // 2. 调整排序
    // 3. 确保稳定性
    return mergedResults;
  }
}
```

### 4.2 缓存策略

1. **多级缓存**
```typescript
class CacheManager {
  // 内存缓存（速度最快，容量最小）
  private memoryCache: LRUCache<string, Weight>;
  
  // 持久化缓存（速度中等，容量大）
  private diskCache: SQLiteCache<string, Weight>;
  
  async getWeight(ruleId: string): Promise<Weight> {
    // 1. 检查内存缓存
    // 2. 检查持久化缓存
    // 3. 加载数据库
    return weight;
  }
}
```

2. **缓存更新**
```typescript
class CacheUpdater {
  // 增量更新缓存
  async updateCache(weights: Weight[]) {
    // 1. 更新内存缓存
    // 2. 异步更新持久化缓存
    // 3. 清理过期数据
  }
}
```

## 5. 工作流程

### 5.1 数据收集流程
```
用户操作 → 内存缓冲 → 批量处理 → 持久化存储
```

### 5.2 学习优化流程
```
数据收集完成
    ↓
【AI 分析流程】
1. 数据预处理
   - 清洗数据
   - 提取特征
   - 构建上下文
    ↓
2. AI 模型分析
   - 生成分析 Prompt
   - 调用 AI 模型
   - 解析返回结果
    ↓
3. 结果处理
   - 验证分析结果
   - 转换规则格式
   - 更新权重数据
    ↓
规则优化完成
```

### 5.3 补全应用流程
```
用户输入 → 基础补全 → 注入权重 → 重排序 → 返回结果
```

## 6. 性能优化

### 6.1 关键指标
- 补全响应时间 < 50ms
- 缓存命中率 > 90%
- 内存占用 < 100MB
- 写入批量 > 100条/次

### 6.2 优化策略
1. **内存优化**
   - 使用 LRU 缓存
   - 限制缓存大小
   - 定期清理过期数据

2. **IO优化**
   - 批量写入
   - 异步处理
   - 增量更新

3. **计算优化**
   - 预计算权重
   - 索引优化
   - 并行处理

## 7. 开发计划

### 第一周：基础设施
1. 数据收集系统
2. 缓存框架
3. 数据库设计
4. AI 分析服务框架搭建

### 第二周：核心功能
1. Prompt 管理系统开发
2. AI 分析流程实现
3. 规则优化器开发
4. 系统集成

### 第三周：优化和测试
1. 性能优化
2. AI 分析效果测试
3. 监控完善
4. 成本优化 