# AI 命令补全功能技术方案

## 1. 方案概述

本方案旨在为终端提供智能的命令补全功能，采用多层次补全策略，结合本地快速补全和 AI 智能补全，在保证响应速度的同时提供高质量的补全建议。补全采用实时智能提示的方式，在用户停止输入后自动显示建议，提供流畅的输入体验。

## 2. 技术选型

### 2.1 本地补全引擎
- **SQLite**
  - 用途：
    - 存储历史命令及其使用频率
    - 记录命令的上下文关系
    - 构建命令索引
  - 实现方式：
    ```sql
    -- 命令历史表
    CREATE TABLE command_history (
      id INTEGER PRIMARY KEY,
      command TEXT NOT NULL,
      context TEXT,          -- 命令上下文（前后命令）
      frequency INTEGER,     -- 使用频率
      last_used TIMESTAMP,   -- 最后使用时间
      success BOOLEAN        -- 命令是否执行成功
    );

    -- 命令关系表
    CREATE TABLE command_relations (
      id INTEGER PRIMARY KEY,
      command1_id INTEGER,
      command2_id INTEGER,
      relation_type TEXT,    -- 关系类型（前置、后置等）
      frequency INTEGER      -- 关系出现频率
    );
    ```

### 2.2 命令补全框架
- **实时补全引擎**
  - 用途：
    - 提供实时命令补全
    - 管理补全状态
    - 处理用户交互
  - 实现方式：
    ```typescript
    class CompletionService {
      // 获取实时补全建议
      async getSuggestion(input: string): Promise<ICompletionSuggestion | null> {
        // 1. 获取本地补全结果
        const localSuggestions = await getLocalSuggestions(input);
        
        // 2. 异步获取 AI 补全结果
        getAISuggestions(input).then(aiSuggestions => {
          // 更新补全建议
          this.updateSuggestion(aiSuggestions);
        });

        // 3. 立即返回最佳建议
        return this.getBestSuggestion(localSuggestions);
      }

      // 更新补全建议
      private updateSuggestion(suggestion: ICompletionSuggestion) {
        if (this.shouldUpdateSuggestion(suggestion)) {
          // 使用ANSI转义序列更新显示
          this.terminal.updateSuggestion(suggestion);
        }
      }
    }
    ```

### 2.3 交互设计
- **实时补全交互**
  - 用户输入时清除当前建议
  - 停止输入1秒后显示建议
  - 使用暗淡颜色显示建议内容
  - 按Tab键接受建议
  - 继续输入时清除建议

- **终端集成**
  ```typescript
  class TerminalIntegration {
    // 处理用户输入
    handleInput(data: string) {
      if (isTabKey(data)) {
        // 接受当前建议
        this.acceptSuggestion();
      } else if (isBackspace(data)) {
        // 清除建议并更新输入
        this.clearSuggestionAndUpdateInput();
      } else if (isEnter(data)) {
        // 执行命令并记录
        this.executeAndRecordCommand();
      } else {
        // 普通字符输入
        this.handleCharacterInput(data);
      }
    }

    // 开始补全计时器
    startSuggestionTimer(input: string) {
      // 清除之前的计时器
      this.clearSuggestionTimer();
      
      // 设置新的计时器
      this.suggestionTimer = setTimeout(() => {
        this.showSuggestion(input);
      }, 1000);
    }

    // 显示建议
    private showSuggestion(suggestion: string) {
      // 使用暗淡颜色显示
      this.terminal.write('\x1b[2m' + suggestion + '\x1b[0m');
      // 将光标移回原位
      this.terminal.write('\b'.repeat(suggestion.length));
    }
  }
  ```

### 2.4 AI 补全服务
- **分层补全策略**
  1. **本地快速补全**
     - 基于 SQLite 的历史记录
     - 使用 omelette 的补全框架
     - 参考 fish-shell 的补全算法
     ```typescript
     async function getLocalSuggestions(input: string) {
       // 1. 查询历史记录
       const history = await db.query(`
         SELECT command, frequency 
         FROM command_history 
         WHERE command LIKE ? 
         ORDER BY frequency DESC
         LIMIT 5
       `, [`${input}%`]);

       // 2. 分析命令关系
       const relations = await db.query(`
         SELECT c2.command
         FROM command_relations r
         JOIN command_history c1 ON r.command1_id = c1.id
         JOIN command_history c2 ON r.command2_id = c2.id
         WHERE c1.command = ?
         ORDER BY r.frequency DESC
         LIMIT 3
       `, [getCurrentCommand()]);

       // 3. 合并结果
       return [...history, ...relations];
     }
     ```

  2. **AI 智能补全**
     - 使用现有的 AI 接口
     - 实现补全缓存
     - 异步更新建议
     ```typescript
     const completionCache = new Map();

     async function getAISuggestions(input: string) {
       // 1. 检查缓存
       const cached = completionCache.get(input);
       if (cached && !isCacheExpired(cached)) {
         return cached.suggestions;
       }

       // 2. 准备上下文
       const context = {
         recentCommands: await getRecentCommands(),
         currentDirectory: await getCurrentDirectory(),
         terminalOutput: await getRecentOutput()
       };

       // 3. 调用 AI 接口
       const aiResponse = await aiService.getCompletions(input, context);

       // 4. 更新缓存
       completionCache.set(input, {
         suggestions: aiResponse,
         timestamp: Date.now()
       });

       return aiResponse;
     }
     ```

### 2.5 补全结果聚合
```typescript
interface Suggestion {
  text: string;           // 补全文本
  description?: string;   // 补全描述
  source: 'local' | 'ai'; // 补全来源
  score: number;         // 相关度评分
}

async function getSuggestions(input: string): Promise<Suggestion[]> {
  // 1. 获取本地补全
  const localSuggestions = await getLocalSuggestions(input);
  
  // 2. 转换格式
  const suggestions = localSuggestions.map(s => ({
    text: s.command,
    source: 'local',
    score: calculateScore(s)
  }));

  // 3. 异步获取 AI 补全
  getAISuggestions(input).then(aiSuggestions => {
    // 4. 合并结果
    const merged = mergeSuggestions(suggestions, aiSuggestions);
    // 5. 更新 UI
    updateCompletionUI(merged);
  });

  // 6. 立即返回本地结果
  return suggestions;
}
```

## 3. 实现步骤

### 3.1 第一阶段：基础框架
1. **SQLite 集成**
   - 创建数据库表结构
   - 实现命令历史记录功能
   - 添加命令关系分析

2. **补全引擎开发**
   - 实现实时补全逻辑
   - 集成终端交互
   - 实现建议显示

3. **交互实现**
   - 实现输入处理
   - 实现补全计时器
   - 实现建议显示

### 3.2 第二阶段：本地能力
1. **Tree-sitter 集成**
   - 配置 WASM 环境
   - 加载 Bash 语法
   - 实现命令解析

2. **补全算法优化**
   - 实现 fish-shell 风格算法
   - 优化命令关系分析
   - 改进排序策略

3. **性能优化**
   - 实现多级缓存
   - 优化查询性能
   - 添加预加载机制

### 3.3 第三阶段：AI 能力
1. **AI 接口集成**
   - 设计 AI 提示模板
   - 实现上下文收集
   - 添加错误处理

2. **缓存系统**
   - 实现补全缓存
   - 设计过期策略
   - 优化缓存命中率

3. **结果聚合**
   - 实现结果合并算法
   - 优化排序策略
   - 改进展示方式

## 4. 具体实现示例

### 4.1 命令历史记录
```typescript
class CommandHistoryManager {
  private db: Database;

  async addCommand(command: string, context: CommandContext) {
    await this.db.run(`
      INSERT INTO command_history (command, context, frequency)
      VALUES (?, ?, 1)
      ON CONFLICT(command) DO UPDATE
      SET frequency = frequency + 1,
          last_used = CURRENT_TIMESTAMP
    `, [command, JSON.stringify(context)]);
  }

  async updateRelations(command1: string, command2: string) {
    // 更新命令关系
    await this.db.run(`
      INSERT INTO command_relations (command1_id, command2_id, frequency)
      VALUES (
        (SELECT id FROM command_history WHERE command = ?),
        (SELECT id FROM command_history WHERE command = ?),
        1
      )
      ON CONFLICT(command1_id, command2_id) DO UPDATE
      SET frequency = frequency + 1
    `, [command1, command2]);
  }
}
```

### 4.2 补全提供者
```typescript
interface CompletionProvider {
  getCompletions(
    input: string,
    context: CompletionContext
  ): Promise<Suggestion[]>;
}

class LocalCompletionProvider implements CompletionProvider {
  private historyManager: CommandHistoryManager;
  private parser: Parser;

  async getCompletions(input: string, context: CompletionContext) {
    // 1. 解析输入
    const parsed = this.parser.parse(input);
    
    // 2. 获取历史建议
    const historySuggestions = await this.historyManager
      .getSuggestions(parsed);
    
    // 3. 获取语法建议
    const syntaxSuggestions = this.getSyntaxSuggestions(parsed);
    
    // 4. 合并结果
    return this.mergeSuggestions([
      historySuggestions,
      syntaxSuggestions
    ]);
  }
}

class AICompletionProvider implements CompletionProvider {
  private cache: CompletionCache;
  private aiService: AIService;

  async getCompletions(input: string, context: CompletionContext) {
    // 1. 检查缓存
    const cached = this.cache.get(input);
    if (cached) return cached;

    // 2. 调用 AI
    const suggestions = await this.aiService
      .getCompletions(input, context);

    // 3. 更新缓存
    this.cache.set(input, suggestions);

    return suggestions;
  }
}
```

### 4.3 补全管理器
```typescript
class CompletionManager {
  private providers: CompletionProvider[];
  private ui: CompletionUI;

  async handleInput(input: string) {
    // 1. 收集上下文
    const context = this.getContext();

    // 2. 获取本地补全
    const localSuggestions = await this.getLocalCompletions(
      input,
      context
    );

    // 3. 更新 UI
    this.ui.updateSuggestions(localSuggestions);

    // 4. 异步获取 AI 补全
    this.getAICompletions(input, context)
      .then(aiSuggestions => {
        // 5. 合并结果
        const merged = this.mergeSuggestions(
          localSuggestions,
          aiSuggestions
        );
        // 6. 更新 UI
        this.ui.updateSuggestions(merged);
      });
  }
}
```

## 5. 开发计划

### 5.1 第一周期（2周）
1. 数据库设计和实现（3天）
2. 基础补全框架搭建（4天）
3. UI 组件开发（4天）
4. 集成测试（3天）

### 5.2 第二周期（2周）
1. Tree-sitter 集成（4天）
2. 补全算法实现（5天）
3. 性能优化（3天）
4. 测试和调优（2天）

### 5.3 第三周期（2周）
1. AI 接口集成（3天）
2. 缓存系统实现（4天）
3. 结果聚合优化（4天）
4. 最终测试（3天）

## 6. 评估指标

### 6.1 性能指标
- 本地补全响应 < 50ms
- 建议显示延迟 = 1000ms
- 缓存命中率 > 60%
- 内存占用 < 50MB

### 6.2 质量指标
- 补全准确率 > 90%
- 建议采纳率 > 60%
- 系统稳定性 99.9%
- 用户满意度 > 85% 