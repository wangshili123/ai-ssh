# Phase 3.7: AI分析结果应用与反馈优化

## 目标
实现基于AI的命令补全优化系统，通过定时增量分析历史命令数据，生成高质量的补全建议。

## 系统架构

### 1. 数据库表结构
```sql
-- AI分析结果表
CREATE TABLE ai_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  command TEXT NOT NULL,           -- 完整命令
  parts TEXT,                      -- 命令组成部分
  frequency INTEGER NOT NULL,      -- 使用频率
  confidence REAL NOT NULL,        -- 置信度
  context TEXT,                    -- 使用场景(JSON)
  created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_ai_completions_command ON ai_completions(command);
CREATE INDEX idx_ai_completions_confidence ON ai_completions(confidence);
```

### 2. 分析结果存储
```typescript
// AI分析结果接口
interface AIAnalysisResult {
  // 命令补全建议
  completions: {
    command: string;        // 完整命令
    parts?: string[];      // 命令的组成部分
    frequency: number;     // 使用频率
    confidence: number;    // 置信度
    context?: {           // 使用场景
      pwd?: string;       // 常用工作目录
      relatedCommands?: string[];  // 相关命令
    };
  }[];
  
  // 元数据
  metadata: {
    totalCommands: number;  // 分析的总命令数
    lastProcessedId: number; // 最后处理的命令ID
    timestamp: string;      // 分析时间
  };
}

// 分析状态接口
interface AnalysisState {
  lastProcessedId: number;  // 最后处理的命令ID
  lastAnalysisTime: Date;   // 上次分析时间
  processedCount: number;   // 已处理命令数
  metrics: {               // 分析指标
    totalCommands: number;
    uniquePatterns: number;
    averageConfidence: number;
  };
}
```

### 3. AI分析器实现
```typescript
export class AIAnalyzer {
  // 默认每6小时执行一次分析
  private static readonly ANALYSIS_INTERVAL = 6 * 60 * 60 * 1000;
  
  async startAnalysisTask() {
    // 1. 立即执行一次
    await this.runAnalysis();
    
    // 2. 设置定时任务
    setInterval(async () => {
      await this.runAnalysis();
    }, AIAnalyzer.ANALYSIS_INTERVAL);
  }

  private async runAnalysis() {
    try {
      // 1. 获取上次分析状态
      const lastState = await this.getAnalysisState();
      
      // 2. 获取新的命令历史(增量)
      const newCommands = await this.dbService.query(`
        SELECT c.*, COUNT(*) as frequency
        FROM common_usage c
        WHERE c.id > ?
        GROUP BY c.command
        ORDER BY frequency DESC, c.created_at DESC
      `, [lastState.lastProcessedId]);

      if (newCommands.length === 0) {
        return;
      }

      // 3. 生成分析提示词
      const prompt = this.generatePrompt(newCommands);

      // 4. 调用AI分析
      const result = await this.callAI(prompt);

      // 5. 保存分析结果
      await this.saveResults(result);

      // 6. 更新分析状态
      await this.updateAnalysisState({
        lastProcessedId: newCommands[newCommands.length - 1].id,
        lastAnalysisTime: new Date(),
        processedCount: newCommands.length,
        metrics: {
          totalCommands: result.metadata.totalCommands,
          uniquePatterns: result.completions.length,
          averageConfidence: this.calculateAverageConfidence(result)
        }
      });

    } catch (error) {
      console.error('[AIAnalyzer] Analysis failed:', error);
    }
  }

  private generatePrompt(commands: any[]): string {
    return `分析以下命令使用历史，识别最有价值的命令补全建议。
对每个建议命令，需要提供:
1. 完整命令
2. 使用频率
3. 置信度
4. 使用场景

命令历史:
${commands.map(cmd => `
命令: ${cmd.command}
频率: ${cmd.frequency}
目录: ${cmd.pwd}
最后使用: ${cmd.created_at}
`).join('\n')}

请以JSON格式返回分析结果，格式如下:
{
  "completions": [
    {
      "command": "完整命令",
      "parts": ["命令", "参数"],
      "frequency": 数字,
      "confidence": 0-1之间的数字,
      "context": {
        "pwd": "常用目录",
        "relatedCommands": ["相关命令1", "相关命令2"]
      }
    }
  ],
  "metadata": {
    "totalCommands": 总命令数,
    "lastProcessedId": 最后处理的命令ID,
    "timestamp": "分析时间"
  }
}`;
  }
}
```

### 4. 补全服务实现
```typescript
export class CompletionService {
  async getCompletions(
    input: string,
    context: CommandContext
  ): Promise<Completion[]> {
    // 从 AI 分析结果表中查询补全
    const completions = await this.dbService.query(`
      SELECT command, parts, confidence, context
      FROM ai_completions
      WHERE command LIKE ? OR parts LIKE ?
      ORDER BY confidence DESC, frequency DESC
      LIMIT 10
    `, [`${input}%`, `${input}%`]);

    return completions.map(c => ({
      value: c.command,
      parts: c.parts ? c.parts.split(' ') : [c.command],
      confidence: c.confidence,
      context: JSON.parse(c.context)
    }));
  }
}
```

## 实现步骤

### 1. 数据库迁移
- [x] 创建 ai_completions 表
- [x] 创建必要的索引
- [x] 确保 analysis_state 表存在

### 2. 核心功能实现
- [x] 实现 AIAnalyzer 类
  - [x] 定时分析任务
  - [x] 增量分析逻辑
  - [x] AI 调用集成
  - [x] 结果存储
- [x] 修改 CompletionService
  - [x] 移除旧的规则补全
  - [x] 实现基于 AI 分析结果的补全

### 3. 测试与优化
- [x] 单元测试
  - [x] 分析器测试
  - [x] 补全服务测试
- [x] 性能测试
  - [x] 分析耗时
  - [x] 补全响应时间

## 注意事项

1. 性能考虑
   - 使用增量分析避免重复处理
   - 合理设置分析间隔
   - 优化数据库查询

2. 可靠性
   - 处理 AI 调用失败
   - 保持分析状态一致性
   - 异常恢复机制 