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
      └── SuggestionCache.ts            # 补全结果缓存
```

### 2.2 缓存优化

#### 2.2.1 LRU缓存基类
```typescript
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
```

#### 2.2.2 增强规则缓存
```typescript
class RuleCache {
  private rules: Map<string, CompletionRule>;
  private matchCache: Map<string, {
    matchedRules: CompletionRule[];
    scores: Map<string, number>;
    timestamp: number;
  }>;

  // 获取所有规则
  getRules(): CompletionRule[] {
    return Array.from(this.rules.values());
  }

  // 获取匹配的规则（带缓存）
  getMatchingRules(
    input: string,
    context: EnhancedContext
  ): { rules: CompletionRule[]; scores: Map<string, number> } {
    // 1. 检查缓存
    const cacheKey = this.getCacheKey(input, context);
    const cached = this.getFromMatchCache(cacheKey);
    if (cached) {
      return cached;
    }

    // 2. 计算匹配
    const { matchedRules, scores } = this.computeMatchingRules(input, context);

    // 3. 更新缓存
    this.updateMatchCache(cacheKey, matchedRules, scores);

    return { rules: matchedRules, scores };
  }

  // 缓存相关方法...
}
```

#### 2.2.3 补全结果缓存
```typescript
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
```

### 2.3 核心优化
```typescript
class CompletionService {
  private ruleCache: RuleCache;
  private contextAnalyzer: EnhancedContextAnalyzer;
  private scoringService: ScoringService;
  private ruleEvaluator: RuleEvaluator;
  private suggestionCache: SuggestionCache;

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
  ): Promise<CompletionSuggestion[]> {
    // 使用增强的 RuleCache 获取匹配规则
    const { rules, scores } = this.ruleCache.getMatchingRules(input, context);
    
    // 转换为补全建议
    return this.transformRulesToSuggestions(rules, scores);
  }
}
```

## 3. 实现步骤

### 3.1 第一阶段：缓存优化
- [ ] 实现 LRUCache 基类
- [ ] 增强 RuleCache，添加规则匹配缓存
- [ ] 实现 SuggestionCache

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

### 6.1 规则缓存策略
- 规则本体存储：使用 Map 存储规则对象
- 匹配结果缓存：缓存规则匹配的结果和分数
- 缓存键设计：基于输入和简化的上下文信息
- 定期清理：自动清理过期的匹配结果

### 6.2 补全结果缓存策略
- LRU 缓存机制：最近最少使用淘汰策略
- 上下文相关：缓存键包含必要的上下文信息
- 有效期控制：设置合理的缓存过期时间
- 容量限制：控制缓存大小，避免内存占用过大

### 6.3 性能优化策略
- 异步清理：缓存清理在后台进行
- 延迟加载：按需加载和计算规则匹配
- 并行处理：并行获取各类补全建议
- 增量更新：支持规则的增量更新 