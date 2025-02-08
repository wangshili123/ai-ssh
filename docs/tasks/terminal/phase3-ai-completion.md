# 第三阶段：AI 学习与补全优化

## 1. 项目结构设计

```
src/
  ├── services/
  │   ├── completion/           # 补全服务
  │   │   ├── types/           # 类型定义
  │   │   │   ├── completion.types.ts
  │   │   │   └── ai-analysis.types.ts
  │   │   │
  │   │   ├── scoring/         # 评分系统
  │   │   │   ├── ScoringService.ts
  │   │   │   └── factors/     # 评分因子
  │   │   │       ├── FrequencyScoring.ts
  │   │   │       ├── ContextScoring.ts
  │   │   │       └── ...
  │   │   │
  │   │   └── learning/        # AI 学习模块
  │   │       ├── analyzer/    # 分析系统
  │   │       │   ├── AnalysisScheduler.ts    # 分析调度器
  │   │       │   ├── AnalysisStateManager.ts  # 状态管理器
  │   │       │   └── ai/                      # AI 分析
  │   │       │       ├── AIAnalyzer.ts        # AI 分析器
  │   │       │       ├── PromptManager.ts     # Prompt 管理
  │   │       │       └── types/               # AI 分析类型
  │   │       │
  │   │       └── collector/   # 数据收集
  │   │           └── CollectorService.ts  # 收集服务
  │   │
  │   └── database/           # 数据库服务
  │       ├── DatabaseService.ts
  │       └── migrations/
  │           ├── 001_initial_schema.ts
  │           ├── 002_learning_tables.ts
  │           └── 003_analysis_tables.ts
```

## 2. 核心组件设计

### 2.1 AI分析系统

1. **AI分析器 (AIAnalyzer)**
   - 功能：利用AI大模型分析命令使用模式
   - 工作方式：
     * 增量分析：只分析新数据
     * 批量处理：聚合分析
     * 异步执行：不影响实时业务
   - 主要职责：
     * 分析命令模式
     * 生成补全建议
     * 计算置信度
     * 提供上下文信息

2. **分析调度器 (AnalysisScheduler)**
   - 功能：管理分析任务的调度
   - 工作方式：
     * 定时触发：默认6小时
     * 条件检查：数据充分性
     * 失败重试：最多3次
   - 主要职责：
     * 调度分析任务
     * 管理分析状态
     * 处理失败重试
     * 更新分析结果

3. **状态管理器 (AnalysisStateManager)**
   - 功能：管理分析状态和结果
   - 工作方式：
     * 状态追踪：记录进度
     * 结果存储：保存分析
     * 增量更新：优化性能
   - 主要职责：
     * 管理分析状态
     * 存储分析结果
     * 提供数据查询
     * 维护数据一致性

4. **Prompt管理器 (PromptManager)**
   - 功能：管理AI分析的prompt
   - 工作方式：
     * 模板管理：固定格式
     * 动态组装：根据数据
     * 结果解析：标准化
   - 主要职责：
     * 生成分析prompt
     * 格式化命令数据
     * 解析AI响应
     * 验证结果格式

### 2.2 补全服务实现

```typescript
export class CompletionService {
  async getSuggestions(params: {
    input: string;
    cursorPosition: number;
    sessionState: SessionState;
    tabId: string;
  }): Promise<CompletionSuggestion[]> {
    // 1. 并行获取各类补全建议
    const [historySuggestions, syntaxSuggestions, aiSuggestions] = await Promise.all([
      this.getHistorySuggestions(params.input),
      this.getSyntaxSuggestions(params.input, simplifiedContext),
      this.getAICompletions(params.input, simplifiedContext)
    ]);

    // 2. 合并所有建议
    const allSuggestions = [
      ...historySuggestions.map(s => ({ ...s, source: CompletionSource.HISTORY })),
      ...syntaxSuggestions.map(s => ({ ...s, source: CompletionSource.SYNTAX })),
      ...aiSuggestions.map(s => ({ ...s, source: CompletionSource.AI }))
    ];

    // 3. 使用评分服务进行评分和排序
    const rankedSuggestions = await this.scoringService.adjustSuggestionScores(
      allSuggestions,
      params.input,
      simplifiedContext
    );

    // 4. 去重和限制数量
    return this.scoringService.deduplicateAndLimit(rankedSuggestions, 3);
  }
}
```

### 2.3 评分系统

```typescript
export class ScoringService {
  private readonly weights = {
    base: 0.05,      // 基础得分权重
    frequency: 0.20, // 使用频率权重
    recency: 0.15,   // 最近使用权重
    prefix: 0.15,    // 前缀匹配权重
    syntax: 0.15,    // 语法匹配权重
    context: 0.10,   // 上下文相关度权重
    chain: 0.10,     // 命令链权重
    time: 0.05,      // 时间模式权重
    env: 0.05,       // 环境状态权重
    ai: 0.20         // AI建议权重
  };

  public async adjustSuggestionScores(
    suggestions: CompletionSuggestion[],
    input: string,
    context: EnhancedContext
  ): Promise<CompletionSuggestion[]> {
    const scoredSuggestions = await Promise.all(
      suggestions.map(async suggestion => {
        // AI建议使用特殊评分逻辑
        if (suggestion.source === CompletionSource.AI) {
          return {
            ...suggestion,
            score: this.weights.ai * suggestion.score +
                   this.weights.prefix * this.prefixScoring.calculateScore(suggestion, input) +
                   this.weights.context * this.contextScoring.calculateScore(suggestion, context)
          };
        }
        
        // 其他建议使用常规评分
        const scores = {
          frequency: this.frequencyScoring.calculateScore(suggestion, context),
          recency: this.recencyScoring.calculateScore(suggestion, context),
          prefix: this.prefixScoring.calculateScore(suggestion, input),
          syntax: this.syntaxScoring.calculateScore(suggestion, input),
          context: this.contextScoring.calculateScore(suggestion, context),
          chain: this.chainScoring.calculateScore(suggestion, context),
          time: this.timeScoring.calculateScore(suggestion, context),
          env: this.environmentScoring.calculateScore(suggestion, context)
        };

        return {
          ...suggestion,
          score: this.calculateTotalScore(scores),
          details: scores
        };
      })
    );

    return scoredSuggestions.sort((a, b) => b.score - a.score);
  }
}
```

## 3. 数据库设计

### 3.1 AI分析结果表
```sql
CREATE TABLE ai_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,           -- 完整命令
  parts TEXT,                      -- 命令组成部分(JSON)
  frequency INTEGER NOT NULL,      -- 使用频率
  confidence REAL NOT NULL,        -- 置信度
  context TEXT,                    -- 使用场景(JSON)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ai_completions_command ON ai_completions(command);
CREATE INDEX idx_ai_completions_confidence ON ai_completions(confidence);
```

### 3.2 分析状态表
```sql
CREATE TABLE analysis_state (
  id INTEGER PRIMARY KEY,
  component TEXT NOT NULL,        -- 组件名称
  last_processed_id INTEGER,      -- 上次处理的最后ID
  last_analysis_time TIMESTAMP,   -- 上次分析时间
  processed_count INTEGER,        -- 处理的记录数
  analysis_metrics TEXT,          -- 分析指标(JSON)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(component)
);

CREATE INDEX idx_analysis_state_component ON analysis_state(component);
```

## 4. 注意事项

1. 性能优化
   - 使用增量分析避免重复处理
   - 合理设置分析间隔(默认6小时)
   - 优化数据库查询效率
   - 使用缓存减少IO操作

2. 可靠性保证
   - 完善的错误处理机制
   - 分析失败自动重试(最多3次)
   - 保持数据状态一致性
   - 异常情况自动恢复

3. AI分析优化
   - 合理设置置信度阈值
   - 优化prompt模板
   - 控制token使用量
   - 确保输出格式规范

4. 补全质量
   - 多维度评分机制
   - 合理的权重分配
   - 上下文相关性考虑
   - 用户反馈收集