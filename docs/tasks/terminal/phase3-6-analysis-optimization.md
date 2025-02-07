# Phase 3-6: 分析服务优化

## 1. 问题分析

### 1.1 当前问题
- 没有检查数据量是否足够
- 分析结果质量不高
- AI 调用成本浪费

### 1.2 优化目标
- 减少不必要的分析调用
- 提高分析质量
- 降低 AI API 调用成本
- 优化数据收集策略

## 2. 具体任务

### 2.1 数据量检查机制
```typescript
interface DataCheckResult {
  hasEnoughData: boolean;
  metrics: {
    newCommandCount: number;    // 新增命令数
    newCompletionCount: number; // 新增补全数
    lastAnalysisTime: Date;     // 上次分析时间
    dataChangeRate: number;     // 数据变化率
  };
}

class AnalysisStateManager {
  /**
   * 检查是否有足够的新数据进行分析
   */
  async checkDataSufficiency(): Promise<DataCheckResult> {
    // 1. 获取上次分析状态
    // 2. 检查新增数据量
    // 3. 计算数据变化率
    // 4. 返回检查结果
  }
}
```

### 2.2 分析触发策略优化
```typescript
class AnalysisScheduler {
  // 配置参数
  private config = {
    minCommandCount: 10,        // 最小命令数
    minCompletionCount: 20,     // 最小补全数
    minDataChangeRate: 0.2,     // 最小数据变化率
    minAnalysisInterval: 5 * 60 * 1000,  // 最小分析间隔（5分钟）
    optimalAnalysisInterval: 30 * 60 * 1000  // 最佳分析间隔（30分钟）
  };

  /**
   * 优化的分析调度逻辑
   */
  private async scheduleAnalysis(): Promise<void> {
    if (this.isAnalyzing) {
      return;
    }

    try {
      // 1. 检查数据充分性
      const checkResult = await this.stateManager.checkDataSufficiency();
      
      if (!this.shouldRunAnalysis(checkResult)) {
        console.log('[AnalysisScheduler] 数据量不足，跳过分析');
        return;
      }

      // 2. 执行分析流程
      // ...
    } catch (error) {
      console.error('[AnalysisScheduler] 分析失败:', error);
    }
  }

  /**
   * 判断是否应该执行分析
   */
  private shouldRunAnalysis(checkResult: DataCheckResult): boolean {
    const {
      newCommandCount,
      newCompletionCount,
      lastAnalysisTime,
      dataChangeRate
    } = checkResult.metrics;

    // 检查数据量
    if (newCommandCount < this.config.minCommandCount ||
        newCompletionCount < this.config.minCompletionCount) {
      return false;
    }

    // 检查时间间隔
    const timeSinceLastAnalysis = Date.now() - lastAnalysisTime.getTime();
    if (timeSinceLastAnalysis < this.config.minAnalysisInterval) {
      return false;
    }

    // 检查数据变化率
    if (dataChangeRate < this.config.minDataChangeRate) {
      return false;
    }

    return true;
  }
}
```

### 2.3 数据收集优化
```typescript
class CollectorService {
  private config = {
    batchThreshold: 50,        // 批处理阈值
    flushInterval: 60 * 1000,  // 刷新间隔（1分钟）
    maxBatchSize: 100         // 最大批量大小
  };

  /**
   * 优化的数据收集逻辑
   */
  private async collectData(data: any): Promise<void> {
    // 1. 添加到批处理队列
    // 2. 检查是否达到阈值
    // 3. 必要时执行批量插入
  }
}
```

### 2.4 分析质量优化
```typescript
class PatternAnalyzer {
  /**
   * 优化的模式识别逻辑
   */
  private async identifyPatterns(data: any): Promise<CommandPattern[]> {
    // 1. 根据数据量动态调整阈值
    // 2. 使用更智能的模式识别算法
    // 3. 考虑历史分析结果
  }
}
```

## 3. 实现步骤

### 3.1 第一阶段：基础优化
- [x] 实现数据充分性检查
- [x] 优化分析触发策略
- [x] 调整分析间隔配置
- [x] 添加数据变化率计算

### 3.2 第二阶段：数据收集优化
- [ ] 实现批量数据收集
- [ ] 优化数据存储结构
- [ ] 添加数据质量检查
- [ ] 实现增量数据处理

### 3.3 第三阶段：分析质量优化
- [ ] 优化模式识别算法
- [ ] 添加历史结果参考
- [ ] 实现动态阈值调整
- [ ] 优化 AI 提示词

## 4. 性能目标

### 4.1 调用频率
- 分析间隔：至少 5 分钟
- 最佳间隔：30 分钟
- 每天最多调用次数：48 次

### 4.2 数据要求
- 最小命令数：10 条
- 最小补全数：20 条
- 最小数据变化率：20%

### 4.3 分析质量
- 模式识别准确率：> 80%
- 无效分析率：< 10%
- AI 建议采纳率：> 60%

## 5. 注意事项

### 5.1 数据安全
- 定期清理过期数据
- 避免敏感信息泄露
- 确保数据一致性

### 5.2 性能影响
- 控制内存使用
- 避免阻塞主线程
- 优化数据库操作

### 5.3 成本控制
- 减少不必要的 AI 调用
- 优化数据传输大小
- 合理使用缓存 