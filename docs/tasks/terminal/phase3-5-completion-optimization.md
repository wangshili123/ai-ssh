# 补全系统优化实现计划

## 1. 现有系统分析

### 1.1 核心组件
```typescript
// 补全服务主类
class CompletionService {
  private contextAnalyzer: EnhancedContextAnalyzer;  // 上下文分析
  private scoringService: ScoringService;            // 评分服务
  private ruleCache: RuleCache;                      // 规则缓存
  private fishCompletion: FishStyleCompletion;       // Fish风格补全
}
```

### 1.2 补全流程
1. 获取增强上下文（EnhancedContextAnalyzer）
2. 获取历史记录补全
3. 获取Fish风格补全
4. 使用ScoringService评分和排序
5. 去重和限制数量

## 2. 优化方案

### 2.1 目录结构
```
src/services/completion/
  ├── CompletionService.ts              # 已存在，需优化
  ├── core/
  │   └── types/
  │       └── rule-completion.types.ts   # 规则补全相关类型定义
  ├── rules/                            # 新增：规则相关
  │   ├── matchers/                     
  │   │   ├── ParameterRuleMatcher.ts   # 参数规则匹配
  │   │   ├── ContextRuleMatcher.ts     # 上下文规则匹配
  │   │   └── SequenceRuleMatcher.ts    # 序列规则匹配
  │   └── RuleEvaluator.ts              # 规则评估器
  └── cache/
      ├── SuggestionCache.ts            # 补全结果缓存
      └── RuleMatchCache.ts             # 规则匹配结果缓存
```

### 2.2 缓存优化
```typescript
// LRU 缓存基类
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private keyTimestamps: Map<K, number>;
  private readonly capacity: number;
  private readonly ttl: number;  // 缓存生存时间（毫秒）

  constructor(capacity: number = 1000, ttl: number = 5 * 60 * 1000) {
    this.cache = new Map();
    this.keyTimestamps = new Map();
    this.capacity = capacity;
    this.ttl = ttl;
  }

  protected set(key: K, value: V): void {
    if (this.cache.size >= this.capacity) {
      this.removeLeastRecentlyUsed();
    }
    this.cache.set(key, value);
    this.keyTimestamps.set(key, Date.now());
  }

  protected get(key: K): V | null {
    const value = this.cache.get(key);
    const timestamp = this.keyTimestamps.get(key);
    
    if (!value || !timestamp) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - timestamp > this.ttl) {
      this.cache.delete(key);
      this.keyTimestamps.delete(key);
      return null;
    }

    // 更新访问时间
    this.keyTimestamps.set(key, Date.now());
    return value;
  }

  private removeLeastRecentlyUsed(): void {
    let oldestKey: K | null = null;
    let oldestTime = Date.now();

    for (const [key, timestamp] of this.keyTimestamps.entries()) {
      if (timestamp < oldestTime) {
        oldestTime = timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.keyTimestamps.delete(oldestKey);
    }
  }

  protected cleanup(): void {
    const now = Date.now();
    for (const [key, timestamp] of this.keyTimestamps.entries()) {
      if (now - timestamp > this.ttl) {
        this.cache.delete(key);
        this.keyTimestamps.delete(key);
      }
    }
  }
}

// 补全结果缓存
class SuggestionCache extends LRUCache<string, CacheItem> {
  private static instance: SuggestionCache;

  private constructor() {
    super(1000, 5 * 60 * 1000); // 1000条缓存，5分钟过期
    this.startCleanupInterval();
  }

  public static getInstance(): SuggestionCache {
    if (!SuggestionCache.instance) {
      SuggestionCache.instance = new SuggestionCache();
    }
    return SuggestionCache.instance;
  }

  // 生成缓存键
  private getCacheKey(input: string, context: EnhancedContext): string {
    const contextKey = this.serializeContext(context);
    return `${input}:${contextKey}`;
  }

  // 序列化上下文
  private serializeContext(context: EnhancedContext): string {
    return JSON.stringify({
      currentDirectory: context.currentDirectory,
      lastCommand: context.commandHistory?.recent[0]?.command,
      shellType: context.shellType
    });
  }

  // 获取建议
  public getSuggestions(
    input: string,
    context: EnhancedContext
  ): CompletionSuggestion[] | null {
    const key = this.getCacheKey(input, context);
    const item = this.get(key);
    
    if (item && this.isContextValid(item.context, context)) {
      return item.suggestions;
    }
    return null;
  }

  // 设置建议
  public setSuggestions(
    input: string,
    context: EnhancedContext,
    suggestions: CompletionSuggestion[]
  ): void {
    const key = this.getCacheKey(input, context);
    const item: CacheItem = {
      suggestions,
      context: this.serializeContext(context),
      timestamp: Date.now()
    };
    this.set(key, item);
  }

  // 验证上下文是否仍然有效
  private isContextValid(
    cachedContext: string,
    currentContext: EnhancedContext
  ): boolean {
    const cached = JSON.parse(cachedContext);
    return (
      cached.currentDirectory === currentContext.currentDirectory &&
      cached.shellType === currentContext.shellType
    );
  }

  // 启动定期清理
  private startCleanupInterval(): void {
    setInterval(() => this.cleanup(), 60 * 1000); // 每分钟清理一次
  }
}

// 规则匹配缓存
class RuleMatchCache extends LRUCache<string, RuleMatchResult> {
  private static instance: RuleMatchCache;

  private constructor() {
    super(500, 10 * 60 * 1000); // 500条缓存，10分钟过期
    this.startCleanupInterval();
  }

  public static getInstance(): RuleMatchCache {
    if (!RuleMatchCache.instance) {
      RuleMatchCache.instance = new RuleMatchCache();
    }
    return RuleMatchCache.instance;
  }

  // 获取规则匹配结果
  public getMatch(input: string): RuleMatchResult | null {
    return this.get(input);
  }

  // 缓存规则匹配结果
  public setMatch(
    input: string,
    matchedRules: CompletionRule[],
    scores: Map<string, number>
  ): void {
    const result: RuleMatchResult = {
      matchedRules,
      scores,
      timestamp: Date.now()
    };
    this.set(input, result);
  }

  // 启动定期清理
  private startCleanupInterval(): void {
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // 每5分钟清理一次
  }
}
```

### 2.3 核心优化
```typescript
class CompletionService {
  private ruleCache: RuleCache;
  private contextAnalyzer: EnhancedContextAnalyzer;
  private scoringService: ScoringService;
  private ruleEvaluator: RuleEvaluator;
  private suggestionCache: SuggestionCache;
  private ruleMatchCache: RuleMatchCache;

  async getSuggestions(params: {
    input: string;
    cursorPosition: number;
    sessionState: SessionState;
    tabId: string;
  }): Promise<CompletionSuggestion[]> {
    // 1. 检查补全结果缓存
    const cachedSuggestions = this.suggestionCache.get(
      params.input,
      params.sessionState
    );
    if (cachedSuggestions) {
      return cachedSuggestions;
    }

    // 2. 获取增强上下文
    const enhancedContext = await this.contextAnalyzer.getEnhancedContext(
      params.input,
      params.cursorPosition,
      params.sessionState
    );

    // 3. 并行获取补全建议
    const [historySuggestions, syntaxSuggestions, ruleSuggestions] = await Promise.all([
      this.getHistorySuggestions(params.input),
      this.getSyntaxSuggestions(params.input, enhancedContext),
      this.getIntelligentSuggestions(params.input, enhancedContext)
    ]);

    // 4. 使用现有的 ScoringService 评分和排序
    const allSuggestions = [
      ...historySuggestions,
      ...syntaxSuggestions,
      ...ruleSuggestions
    ];

    const rankedSuggestions = await this.scoringService.adjustSuggestionScores(
      allSuggestions,
      params.input,
      enhancedContext
    );

    const finalSuggestions = this.scoringService.deduplicateAndLimit(rankedSuggestions, 3);
    
    // 5. 缓存结果
    this.suggestionCache.set(
      params.input,
      params.sessionState,
      finalSuggestions
    );
    
    return finalSuggestions;
  }

  private async getIntelligentSuggestions(
    input: string,
    context: EnhancedContext
  ): Promise<CompletionRule[]> {
    // 1. 检查规则匹配缓存
    const cachedMatch = this.ruleMatchCache.getMatch(input);
    if (cachedMatch) {
      return cachedMatch.matchedRules;
    }

    // 2. 获取规则并评估
    const rules = this.ruleCache.getRules();
    const matchedRules = rules.filter(rule => {
      const score = this.ruleEvaluator.evaluateRule(rule, input, context);
      return score > MATCH_THRESHOLD;
    });

    // 3. 缓存匹配结果
    this.ruleMatchCache.setMatch(input, matchedRules, new Map());
    
    return matchedRules;
  }
}
```

### 2.4 规则评估
```typescript
class RuleEvaluator {
  private parameterMatcher: ParameterRuleMatcher;
  private contextMatcher: ContextRuleMatcher;
  private sequenceMatcher: SequenceRuleMatcher;

  evaluateRule(
    rule: CompletionRule,
    input: string,
    context: EnhancedContext
  ): number {
    // 1. 根据规则类型选择匹配器
    const matcher = this.getMatcherForRule(rule);
    
    // 2. 计算匹配分数
    const matchScore = matcher.match(rule, input, context);
    
    // 3. 应用规则权重和置信度
    return matchScore * rule.weight * rule.confidence;
  }
}
```

## 3. 实现步骤

### 3.1 第一阶段：缓存实现
- [ ] 实现补全结果缓存
- [ ] 实现规则匹配缓存
- [ ] 优化缓存策略

### 3.2 第二阶段：规则匹配
- [ ] 实现参数规则匹配器
- [ ] 实现上下文规则匹配器
- [ ] 实现序列规则匹配器

### 3.3 第三阶段：评估优化
- [ ] 实现规则评估器
- [ ] 优化评分策略
- [ ] 集成现有评分系统

### 3.4 第四阶段：性能优化
- [ ] 优化缓存命中率
- [ ] 优化规则匹配性能
- [ ] 添加性能监控

## 4. 性能目标

### 4.1 响应时间
- 缓存命中：< 10ms
- 完整补全：< 200ms
- 规则匹配：< 30ms

### 4.2 资源使用
- 内存占用：< 50MB
- CPU使用：< 5%
- 缓存条目：< 1000

### 4.3 准确率
- 首选项命中率：> 80%
- 相关性：> 90%
- 缓存命中率：> 60%

## 5. 注意事项

### 5.1 性能优化
- 优化缓存策略
- 并行处理补全请求
- 避免阻塞主线程
- 定期清理过期缓存

### 5.2 代码质量
- 复用现有组件
- 保持接口一致
- 添加完整测试
- 规范错误处理

### 5.3 可维护性
- 清晰的缓存策略
- 完整的文档
- 详细的日志
- 性能监控 

## 6. 缓存策略说明

### 6.1 LRU缓存机制
- 采用 Map 存储缓存数据，保证 O(1) 的访问性能
- 使用时间戳记录每个缓存项的访问时间
- 当缓存达到容量上限时，自动淘汰最久未使用的项
- 支持 TTL (Time To Live) 机制，自动过期清理

### 6.2 缓存键设计
- 补全建议缓存：结合输入和关键上下文信息（目录、shell类型等）
- 规则匹配缓存：主要基于输入内容，减少上下文依赖
- 序列化上下文时只保留必要信息，避免缓存键过大

### 6.3 缓存清理策略
- 定时清理：每隔固定时间（1-5分钟）清理过期数据
- 容量控制：设置合理的缓存容量上限，超出时自动淘汰
- 分级缓存：不同类型缓存采用不同的容量和过期时间

### 6.4 性能考虑
- 缓存操作（读写、清理）都在后台进行，不影响主线程
- 缓存键的生成和序列化尽量简单高效
- 合理设置缓存容量，避免占用过多内存 