# 第二阶段：命令解析与本地补全优化

## 1. Tree-sitter 集成（4天）

### 1.1 WASM 环境配置
- [x] 配置 Webpack/Vite 支持
  ```javascript
  // webpack.config.js
  module.exports = {
    // ...
    module: {
      rules: [
        {
          test: /\.wasm$/,
          type: 'webassembly/async'
        }
      ]
    },
    experiments: {
      asyncWebAssembly: true
    }
  };
  ```

### 1.2 Shell 语法解析器集成
- [x] 安装必要依赖
  ```bash
  npm install tree-sitter tree-sitter-bash
  ```

- [x] 初始化解析器
  ```typescript
  import Parser from 'tree-sitter';
  import Bash from 'tree-sitter-bash';

  export class ShellParser {
    private parser: Parser;

    constructor() {
      this.parser = new Parser();
      this.parser.setLanguage(Bash);
    }

    parse(command: string) {
      return this.parser.parse(command);
    }
  }
  ```

### 1.3 语法树分析工具
- [x] 实现节点遍历器
  ```typescript
  class SyntaxTreeWalker {
    visit(node: Parser.SyntaxNode) {
      // 遍历语法树节点
      this.visitNode(node);
      for (const child of node.children) {
        this.visit(child);
      }
    }

    private visitNode(node: Parser.SyntaxNode) {
      switch (node.type) {
        case 'command':
          this.handleCommand(node);
          break;
        case 'argument':
          this.handleArgument(node);
          break;
        // ...其他节点类型处理
      }
    }
  }
  ```

### 1.4 上下文感知补全
- [x] 实现基于位置的补全
  ```typescript
  class ContextAwareCompletion {
    async getSuggestions(node: Parser.SyntaxNode, position: number) {
      const context = this.getContextAtPosition(node, position);
      switch (context.type) {
        case 'command':
          return this.getCommandSuggestions();
        case 'argument':
          return this.getArgumentSuggestions(context);
        case 'option':
          return this.getOptionSuggestions(context);
      }
    }
  }
  ```

### 1.5 特定命令补全
- [x] Git 命令补全
  - 子命令补全（status, add, commit 等）
  - 分支名补全（checkout, merge 等）
  - 未暂存文件补全（add 命令）
  - 远程仓库补全（push, pull 等）

- [x] Docker 命令补全
  - 子命令补全（run, start, stop 等）
  - 容器ID/名称补全（exec, logs 等）
  - 镜像名补全（pull, run 等）
  - 网络/卷补全（network, volume 等）

- [x] 系统命令补全
  - 服务名补全（systemctl）
  - 进程补全（kill, pkill）
  - 用户补全（chown, su）
  - 组补全（chgrp, usermod）

## 2. 补全算法优化（5天）

### 2.1 Fish-shell 风格算法实现
- [x] 实现基本的上下文感知补全
  - 命令名补全
  - 参数补全
  - 选项补全
  - SSH会话补全
  - 历史命令补全

- [x] 目录同步机制
  ```typescript
  // 在 CompletionSSHManager 中维护目录映射
  class CompletionSSHManager {
    private currentDirectories: Map<string, string> = new Map(); // tabId -> currentDirectory
    
    // 更新目录（由终端 cd 命令触发）
    public async updateDirectory(tabId: string, command: string) {
      if (command.startsWith('cd ')) {
        // 在补全连接中执行相同的 cd 命令
        await this.executeCommand(tabId, command);
        // 获取新目录
        const result = await this.executeCommand(tabId, 'pwd');
        const newDirectory = result.stdout.trim();
        // 更新目录映射
        this.currentDirectories.set(tabId, newDirectory);
      }
    }
    
    // 获取当前目录（用于补全）
    public getCurrentDirectory(tabId: string): string {
      return this.currentDirectories.get(tabId) || '~';
    }
  }

  // 终端事件处理
  class Terminal {
    private async handleCommand(command: string) {
      if (command.startsWith('cd ')) {
        // 发送目录变更事件到补全服务
        eventBus.emit('terminal:directory-change', {
          tabId: this.tabId,
          command: command
        });
      }
    }
  }
  ```

- [x] 增强上下文感知补全
  ```typescript
  class ContextAwareCompletion {
    async getSuggestions(input: string, context: CompletionContext) {
      // 1. 命令执行历史分析
      // 2. 用户行为模式分析
      // 3. 环境上下文分析
      // 4. 命令语义分析
    }
  }
  ```

### 2.2 命令关系分析优化
- [x] 实现命令链分析
  ```typescript
  class CommandChainAnalyzer {
    analyzeChain(node: Parser.SyntaxNode) {
      // 分析管道命令
      // 分析重定向
      // 分析复合命令
      // 分析命令依赖关系
      // 预测下一个可能的命令
    }
  }
  ```

### 2.3 排序策略改进
- [x] 实现多因素排序
  ```typescript
  interface ScoringFactors {
    frequency: number;    // 使用频率
    recency: number;     // 最近使用时间
    contextMatch: number; // 上下文匹配度
    prefixMatch: number; // 前缀匹配度
    syntaxMatch: number; // 语法匹配度
    commandChain: number; // 命令链关联度
  }
  ```

## 3. 性能优化（3天）

### 3.1 多级缓存实现
- [ ] 实现内存缓存
  ```typescript
  interface CacheEntry<T> {
    data: T;
    timestamp: number;
    hits: number;
  }

  class MultiLevelCache {
    private memoryCache: Map<string, CacheEntry<any>>;
    private readonly CACHE_DURATION = {
      COMPLETION: 2000,    // 补全结果缓存 2s
      PARSE: 5000,        // 解析结果缓存 5s
      FILESYSTEM: 10000,  // 文件系统缓存 10s
    };
    
    // 智能缓存策略
    private shouldCache(key: string, type: CacheType): boolean {
      const entry = this.memoryCache.get(key);
      if (!entry) return true;
      
      // 基于访问频率和时间的智能缓存决策
      const age = Date.now() - entry.timestamp;
      const frequency = entry.hits / (age / 1000);
      return frequency > 0.1; // 每秒至少0.1次访问才值得缓存
    }
    
    // 缓存清理策略
    private cleanup(): void {
      const now = Date.now();
      for (const [key, entry] of this.memoryCache.entries()) {
        const age = now - entry.timestamp;
        if (age > this.CACHE_DURATION.FILESYSTEM) {
          this.memoryCache.delete(key);
        }
      }
    }
  }
  ```

### 3.2 查询性能优化
- [ ] 实现增量更新
  ```typescript
  class IncrementalParser {
    private lastParse: {
      command: string;
      tree: Parser.Tree;
      timestamp: number;
    };
    
    // 增量解析
    public parse(command: string): Parser.Tree {
      if (this.canReuseLastParse(command)) {
        return this.incrementalUpdate(command);
      }
      return this.fullParse(command);
    }
    
    // 判断是否可以复用上次解析结果
    private canReuseLastParse(command: string): boolean {
      if (!this.lastParse) return false;
      
      const timeDiff = Date.now() - this.lastParse.timestamp;
      const similarity = this.calculateSimilarity(command, this.lastParse.command);
      return timeDiff < 1000 && similarity > 0.8;
    }
  }

  class IncrementalCompletion {
    private lastCompletion: {
      input: string;
      suggestions: CompletionSuggestion[];
      context: CompletionContext;
      timestamp: number;
    };
    
    // 增量补全
    public async getSuggestions(
      input: string, 
      context: CompletionContext
    ): Promise<CompletionSuggestion[]> {
      if (this.canReuseLastCompletion(input, context)) {
        return this.incrementalUpdate(input, context);
      }
      return this.fullCompletion(input, context);
    }
    
    // 结果复用策略
    private canReuseLastCompletion(
      input: string, 
      context: CompletionContext
    ): boolean {
      if (!this.lastCompletion) return false;
      
      const timeDiff = Date.now() - this.lastCompletion.timestamp;
      const inputSimilarity = this.calculateSimilarity(
        input, 
        this.lastCompletion.input
      );
      const contextSimilarity = this.compareContext(
        context, 
        this.lastCompletion.context
      );
      
      return timeDiff < 500 && 
             inputSimilarity > 0.9 && 
             contextSimilarity > 0.95;
    }
  }
  ```

### 3.3 预加载机制
- [ ] 实现智能预加载
  ```typescript
  class PreloadManager {
    private preloadedCommands: Map<string, CommandData>;
    private userPatterns: UserPatternAnalyzer;
    private contextAnalyzer: ContextAnalyzer;
    
    // 常用命令预加载
    public async preloadCommonCommands(): Promise<void> {
      const commonCommands = await this.userPatterns.getTopCommands(10);
      for (const cmd of commonCommands) {
        await this.preloadCommand(cmd);
      }
    }
    
    // 上下文相关预加载
    public async preloadContextual(
      currentContext: CompletionContext
    ): Promise<void> {
      const relatedCommands = 
        await this.contextAnalyzer.getPredictedCommands(currentContext);
      for (const cmd of relatedCommands) {
        await this.preloadCommand(cmd);
      }
    }
    
    // 用户模式预测
    private async predictNextCommands(
      currentCommand: string
    ): Promise<string[]> {
      const userPattern = await this.userPatterns.analyze(currentCommand);
      const timeContext = this.getTimeContext();
      const workspaceContext = await this.getWorkspaceContext();
      
      return this.userPatterns.predictNext({
        pattern: userPattern,
        time: timeContext,
        workspace: workspaceContext
      });
    }
    
    // 智能预加载调度
    private async schedulePreload(): Promise<void> {
      // 1. 系统空闲时预加载
      if (this.isSystemIdle()) {
        await this.preloadCommonCommands();
      }
      
      // 2. 用户输入停顿时预加载
      this.onUserInputPause(async () => {
        const predictions = await this.predictNextCommands(
          this.getCurrentCommand()
        );
        await this.preloadPredicted(predictions);
      });
      
      // 3. 定期更新预加载数据
      setInterval(async () => {
        await this.updatePreloadedData();
      }, 60000); // 每分钟更新
    }
  }
  ```

这些优化实现将显著提升系统性能：

1. 多级缓存可以减少重复计算，特别是对于频繁访问的数据
2. 增量更新避免了完整重新计算的开销
3. 智能预加载可以提前准备可能需要的数据

预期性能提升：
- 补全响应时间从 300ms 降至 50ms 以内
- 缓存命中率提升至 80% 以上
- 内存占用控制在 50MB 以内
- CPU使用率降低 30%

## 4. 测试与调优（2天）

### 4.1 解析器测试
- [x] 语法解析测试
  - 基本命令解析
  - 复杂命令解析（管道、重定向、变量）
  - 特殊字符处理（引号、转义）
  - 错误处理测试

- [ ] 性能基准测试
  - 解析速度测试（大量命令）
  - 内存使用测试（长命令）
  - 并发处理测试（多会话）

### 4.2 补全算法测试
- [ ] 准确性测试
  - 命令名补全准确性
  - 参数补全准确性
  - 路径补全准确性
  - 变量补全准确性
  - 特定命令补全准确性（git、docker等）
  - 命令链预测准确性

- [ ] 性能测试
  - 响应时间测试（不同长度输入）
  - 资源占用测试（内存、CPU）
  - 缓存效率测试
  - 预加载效果测试

### 4.3 系统调优
- [ ] 性能调优
  - 解析器性能优化
  - 补全算法优化
  - 缓存策略优化
  - 内存使用优化

- [ ] 用户体验优化
  - 补全响应速度
  - 补全准确度
  - 上下文相关性
  - 排序合理性

## 5. 验收标准

### 5.1 功能验收
- [ ] 语法解析准确性 > 95%
- [ ] 补全算法准确率 > 85%
- [ ] 上下文感知正确率 > 80%
- [ ] 特定命令补全准确率 > 90%
- [ ] 命令链预测准确率 > 75%

### 5.2 性能验收
- [ ] 解析响应时间 < 10ms
- [ ] 补全响应时间 < 50ms
- [ ] 内存增长 < 50MB
- [ ] 缓存命中率 > 80%
- [ ] 预加载命中率 > 60%

### 5.3 代码质量
- [ ] 代码覆盖率 > 85%
- [ ] 文档完整性 100%
- [ ] 无关键性能问题
- [ ] 测试用例覆盖所有主要功能 