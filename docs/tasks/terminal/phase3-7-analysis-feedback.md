# Phase 3.7: AI分析结果应用与反馈优化

## 目标
实现AI分析结果的实际应用机制和反馈收集系统,形成数据分析-应用-反馈的闭环,持续优化命令补全和用户体验。
下面只是给出代码框架和思路，具体实现之前要做完整的思考，并给出详细的文档。

## 系统架构

### 1. 分析结果存储层
```typescript
// 分析结果存储结构
interface AIAnalysisResult {
  // 命令模式
  commandPatterns: {
    id: string;
    pattern: string[];
    confidence: number;
    context: string[];
    usageCount: number;
    lastUsed: Date;
  }[];
  
  // 参数模式
  parameterPatterns: {
    id: string;
    command: string;
    parameters: Record<string, any>;
    context: string[];
    confidence: number;
  }[];
  
  // 用户偏好
  userPreferences: {
    preferredCommands: Record<string, number>;
    commonParameters: Record<string, any>;
    workingDirectories: Record<string, string[]>;
  };
}
```

### 2. 提示词模板设计
```typescript
// services/completion/learning/prompt/PromptTemplates.ts
export const ANALYSIS_PROMPTS = {
  // 命令模式分析
  COMMAND_PATTERN: `
分析以下命令序列,识别:
1. 常用命令组合
2. 参数使用模式
3. 上下文相关性

命令历史:
{{commandHistory}}

要求:
1. 只返回置信度>0.8的模式
2. 包含使用频率和上下文信息
3. JSON格式返回
`,

  // 参数优化
  PARAMETER_OPTIMIZATION: `
分析以下命令的参数使用:
{{command}}

历史参数:
{{parameterHistory}}

要求:
1. 识别最优参数组合
2. 考虑执行成功率
3. JSON格式返回
`,

  // 上下文关联
  CONTEXT_CORRELATION: `
分析命令执行上下文:
当前目录: {{pwd}}
最近命令: {{recentCommands}}
环境变量: {{env}}

要求:
1. 识别目录相关命令
2. 发现环境依赖
3. JSON格式返回
`
};

// 响应验证规则
export const RESPONSE_VALIDATORS = {
  pattern: (response: any) => {
    return (
      response.confidence >= 0.8 &&
      Array.isArray(response.commands) &&
      response.context != null
    );
  },
  parameter: (response: any) => {
    return (
      response.command &&
      response.parameters &&
      response.successRate >= 0.7
    );
  }
};
```

### 3. 反馈收集机制

#### 3.1 隐式反馈
```typescript
// services/completion/feedback/ImplicitFeedbackCollector.ts
export class ImplicitFeedbackCollector {
  constructor(
    private analysisManager: AnalysisResultManager,
    private dbService: DatabaseService
  ) {}

  // 1. 补全选择反馈
  async recordCompletionSelection(
    completion: Completion,
    position: number,
    timeToSelect: number
  ): Promise<void> {
    const feedback = {
      type: 'completion_selection',
      resultId: completion.id,
      metadata: {
        position,
        timeToSelect,
        wasModified: completion.value !== completion.originalValue
      }
    };
    await this.saveFeedback(feedback);
  }

  // 2. 命令执行结果反馈
  async recordCommandExecution(
    command: string,
    exitCode: number,
    duration: number
  ): Promise<void> {
    const feedback = {
      type: 'command_execution',
      resultId: command,
      metadata: {
        exitCode,
        duration,
        wasSuccessful: exitCode === 0
      }
    };
    await this.saveFeedback(feedback);
  }
}
```

#### 3.2 显式反馈
```typescript
// services/completion/feedback/ExplicitFeedbackCollector.ts
export class ExplicitFeedbackCollector {
  constructor(
    private analysisManager: AnalysisResultManager,
    private dbService: DatabaseService
  ) {}

  // 建议反馈按钮
  async recordSuggestionFeedback(
    suggestion: Suggestion,
    isHelpful: boolean
  ): Promise<void> {
    const feedback = {
      type: 'explicit_suggestion',
      resultId: suggestion.id,
      isPositive: isHelpful,
      metadata: {
        suggestionType: suggestion.type
      }
    };
    await this.saveFeedback(feedback);
  }
}
```

### 4. 补全服务增强
```typescript
// services/completion/CompletionService.ts
export class CompletionService {
  constructor(
    private analysisManager: AnalysisResultManager,
    private contextManager: ContextManager
  ) {}
  
  async getIntelligentSuggestions(
    input: string,
    context: CommandContext
  ): Promise<Completion[]> {
    // 1. 获取AI分析的模式
    const patterns = await this.analysisManager.getRelevantPatterns(context);
    
    // 2. 获取基础补全
    const baseCompletions = await this.getBaseCompletions(input);
    
    // 3. 整合并排序
    return this.rankCompletions(input, baseCompletions, patterns);
  }
  
  private async rankCompletions(
    input: string,
    baseCompletions: Completion[],
    patterns: CommandPattern[]
  ): Promise<Completion[]> {
    // 基于模式和上下文对补全进行排序
    const scored = baseCompletions.map(completion => ({
      completion,
      score: this.calculateScore(completion, patterns)
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .map(item => item.completion);
  }
}
```

## 数据库变更

### 1. 分析结果表
```sql
CREATE TABLE analysis_results (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  pattern_data JSONB NOT NULL,
  confidence REAL NOT NULL,
  usage_count INTEGER NOT NULL,
  last_used TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_analysis_results_type ON analysis_results(type);
CREATE INDEX idx_analysis_results_confidence ON analysis_results(confidence);
```

### 2. 用户反馈表
```sql
CREATE TABLE user_feedback (
  id TEXT PRIMARY KEY,
  result_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  is_positive BOOLEAN NOT NULL,
  context JSONB,
  created_at TIMESTAMP NOT NULL,
  FOREIGN KEY (result_id) REFERENCES analysis_results(id)
);

CREATE INDEX idx_user_feedback_result ON user_feedback(result_id);
```

## 实现步骤

### 1. 清理旧代码
- [ ] 删除 /src/services/completion/learning/analyzer/ai/ 目录
- [ ] 清理 optimizer 中的旧AI相关代码
- [ ] 删除相关测试文件

### 2. 实现新功能
- [ ] 实现提示词模板和验证器
- [ ] 实现反馈收集机制
- [ ] 更新补全服务逻辑
- [ ] 添加必要的单元测试

### 3. 数据迁移
- [ ] 创建新的数据表
- [ ] 实现数据迁移脚本
- [ ] 验证数据完整性

## 风险与应对

1. 性能风险
   - 实时分析开销大
   - 解决：实现高效缓存和增量更新

2. 准确度风险
   - 建议可能不够准确
   - 解决：建立严格的置信度机制

3. 用户体验风险
   - 建议可能打扰用户
   - 解决：智能控制建议频率和时机 