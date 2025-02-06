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
   - 主要职责：
     * 分析使用频率
     * 识别使用模式
     * 计算基础指标
     * 生成分析结果
   - 基础分析：
     * 输入：批量的命令使用记录和补全选择数据
     * 分析维度：
       - 命令使用频率
       - 参数使用模式
       - 上下文相关性
       - 执行成功率
     * 输出：基础分析结果

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

1. **AI 分析服务 (AIAnalyzer)**
   - 功能：利用 AI 大模型对 PatternAnalyzer 的分析结果进行深度分析
   - 工作方式：
     * 被动触发：由 PatternAnalyzer 分析完成后触发
     * 批量处理：聚合分析多条数据
     * 异步执行：后台运行不影响实时业务
   - 主要职责：
     * 接收基础分析结果：
       - 从 PatternAnalyzer 获取基础分析结果
       - 提取关键特征和模式
       - 准备 AI 分析上下文
     * AI 分析流程：
       - 构建分析 Prompt
       - 调用 AI 模型
       - 解析模型输出
     * 结果生成：
       - 深度分析模式关联
       - 生成高级优化建议
       - 提供智能化改进方案
     * 结果验证：
       - 验证分析结果
       - 过滤无效建议
       - 确保建议可行性

2. **Prompt 管理器 (PromptManager)**
   - 功能：管理和优化 AI 分析的 Prompt
   - 工作方式：
     * 模板化：使用预定义模板
     * 动态组装：根据分析需求构建
     * 版本控制：跟踪 Prompt 效果
   - 主要职责：
     * 维护 Prompt 模板：
       - 模式关联分析模板
       - 优化建议生成模板
       - 智能改进方案模板
     * 优化 Prompt 策略：
       - 根据分析效果调整
       - 控制 token 使用量
       - 确保输出格式规范

3. **规则优化器 (RuleOptimizer)**
   - 功能：根据 PatternAnalyzer 和 AIAnalyzer 的结果更新系统规则
   - 工作方式：
     * 增量更新：合并新的分析结果
     * 原子操作：确保规则一致性
     * 版本控制：管理规则版本
   - 主要职责：
     * 规则生成：
       - 基于基础分析结果生成规则
       - 整合 AI 分析建议
       - 处理规则冲突
     * 规则优化：
       - 更新规则权重
       - 清理过期规则
       - 维护规则版本
     * 规则应用：
       - 更新补全规则
       - 更新关联规则
       - 生成优化报告

### 2.5 分析流程

```
AnalysisScheduler (定时触发)
        ↓
加载分析状态 (从数据库)
        ↓
数据量检查 (检查阈值)
        ↓
PatternAnalyzer (基础分析)
        ↓
AIAnalyzer (AI深度分析)
        ↓
RuleOptimizer (规则更新)
        ↓
保存分析状态 (到数据库)
```

1. `AnalysisScheduler` 定时触发分析任务：
   - 从数据库加载上次分析状态（最后处理的ID、时间等）
   - 检查增量数据是否满足分析条件：
     * 新增命令数量是否达到最小阈值
     * 数据时间跨度是否合理
     * 命令多样性是否满足要求
   - 如果数据不满足要求，记录原因并跳过本次分析

2. 数据满足要求时，`PatternAnalyzer` 执行基础模式分析：
   - 只分析上次分析位置之后的新数据
   - 记录分析进度和指标
   - 完成后更新分析状态

3. 分析完成后触发 `AIAnalyzer` 进行深度分析
4. `AIAnalyzer` 完成后触发 `RuleOptimizer` 更新规则
5. 整个过程是串行的，每个步骤都依赖前一个步骤的结果

### 2.6 分析状态管理

1. **状态存储表**
```sql
CREATE TABLE analysis_state (
    id INTEGER PRIMARY KEY,
    component TEXT NOT NULL,        -- 组件名称
    last_processed_id INTEGER,      -- 上次处理的最后ID
    last_analysis_time TIMESTAMP,   -- 上次分析时间
    processed_count INTEGER,        -- 处理的记录数
    analysis_metrics TEXT,          -- 分析指标（JSON）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(component)
);

CREATE INDEX idx_analysis_state_component ON analysis_state(component);
```

2. **分析阈值配置**
```typescript
interface AnalysisThreshold {
  // 数据量阈值
  minNewCommandCount: number;     // 最小新增命令数
  minUniqueCommands: number;      // 最小不同命令数
  minCompletionUsage: number;     // 最小补全使用次数
  
  // 时间维度阈值
  minTimeSinceLastAnalysis: number; // 距离上次分析的最小时间间隔
  maxAnalysisInterval: number;      // 最大分析间隔
  
  // 质量维度阈值
  minSuccessRate: number;          // 最小成功率
  maxErrorRate: number;            // 最大错误率
  minCompletionAdoption: number;   // 最小补全采纳率
}

const defaultThresholds: AnalysisThreshold = {
  // 数据量阈值
  minNewCommandCount: 50,          // 至少50条新命令
  minUniqueCommands: 10,           // 至少10种不同命令
  minCompletionUsage: 20,          // 至少20次补全使用
  
  // 时间维度阈值（毫秒）
  minTimeSinceLastAnalysis: 300000,  // 至少5分钟
  maxAnalysisInterval: 86400000,     // 最长1天
  
  // 质量维度阈值
  minSuccessRate: 0.6,              // 至少60%成功率
  maxErrorRate: 0.3,                // 最多30%错误率
  minCompletionAdoption: 0.4        // 至少40%采纳率
};
```

3. **状态管理接口**
```typescript
interface AnalysisState {
  lastProcessedId: number;
  lastAnalysisTime: Date;
  processedCount: number;
  metrics: {
    commandCount: number;
    uniqueCommands: number;
    successRate: number;
    errorRate: number;
    completionAdoption: number;
  };
}

interface StateManager {
  loadState(component: string): Promise<AnalysisState>;
  saveState(component: string, state: AnalysisState): Promise<void>;
  shouldPerformAnalysis(state: AnalysisState): boolean;
}
```

4. **分析决策逻辑**
```typescript
class AnalysisScheduler {
  async checkAnalysisConditions(): Promise<{
    shouldProceed: boolean;
    reason?: string;
  }> {
    // 1. 加载状态
    const state = await this.stateManager.loadState('PatternAnalyzer');
    
    // 2. 检查时间间隔
    const timeSinceLastAnalysis = Date.now() - state.lastAnalysisTime.getTime();
    if (timeSinceLastAnalysis < this.thresholds.minTimeSinceLastAnalysis) {
      return {
        shouldProceed: false,
        reason: '距离上次分析时间过短'
      };
    }
    
    // 3. 检查新数据量
    const newDataCount = await this.getNewDataCount(state.lastProcessedId);
    if (newDataCount < this.thresholds.minNewCommandCount) {
      return {
        shouldProceed: false,
        reason: '新增数据量不足'
      };
    }
    
    // 4. 检查数据质量
    const dataQuality = await this.checkDataQuality(state.lastProcessedId);
    if (!this.meetsQualityThresholds(dataQuality)) {
      return {
        shouldProceed: false,
        reason: '数据质量不满足要求'
      };
    }
    
    return { shouldProceed: true };
  }
}
```

### 2.7 监控和日志

1. **分析日志表**
```sql
CREATE TABLE analysis_log (
    id INTEGER PRIMARY KEY,
    component TEXT NOT NULL,
    analysis_type TEXT NOT NULL,    -- 'scheduled' 或 'manual'
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    status TEXT,                    -- 'success', 'skipped', 'failed'
    skip_reason TEXT,              -- 如果被跳过，记录原因
    error_message TEXT,            -- 如果失败，记录错误
    metrics TEXT,                  -- 分析指标（JSON）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_analysis_log_component ON analysis_log(component);
CREATE INDEX idx_analysis_log_status ON analysis_log(status);
```

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

### 3.4 分析状态表
```sql
CREATE TABLE analysis_state (
    id INTEGER PRIMARY KEY,
    component TEXT NOT NULL,        -- 组件名称
    last_processed_id INTEGER,      -- 上次处理的最后ID
    last_analysis_time TIMESTAMP,   -- 上次分析时间
    processed_count INTEGER,        -- 处理的记录数
    analysis_metrics TEXT,          -- 分析指标（JSON）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP,
    UNIQUE(component)
);

CREATE INDEX idx_analysis_state_component ON analysis_state(component);
```