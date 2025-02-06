import { CommandPattern } from '../../types';

/**
 * 指标计算器
 * 负责计算各种分析指标
 */
export class MetricsCalculator {
  /**
   * 计算置信度
   */
  public static calculateConfidence(frequency: number, totalSamples: number): number {
    return Math.min(frequency / Math.max(totalSamples, 1), 1.0);
  }

  /**
   * 计算平均置信度
   */
  public static calculateAverageConfidence(patterns: CommandPattern[]): number {
    if (patterns.length === 0) return 0;
    const sum = patterns.reduce((acc, pattern) => acc + pattern.confidence, 0);
    return sum / patterns.length;
  }

  /**
   * 计算平均指标
   */
  public static calculateAverageMetric(
    patterns: CommandPattern[], 
    metric: 'successRate' | 'avgExecutionTime'
  ): number {
    if (patterns.length === 0) return 0;
    
    const validPatterns = patterns.filter(p => p[metric] !== undefined);
    if (validPatterns.length === 0) return 0;
    
    const sum = validPatterns.reduce((acc, pattern) => acc + (pattern[metric] || 0), 0);
    return sum / validPatterns.length;
  }

  /**
   * 计算模式影响力
   * 基于频率、成功率和执行时间的加权计算
   */
  public static calculatePatternImpact(pattern: CommandPattern): number {
    const frequencyWeight = 0.4;
    const successRateWeight = 0.4;
    const executionTimeWeight = 0.2;

    const normalizedFrequency = Math.min(pattern.frequency / 100, 1); // 标准化频率
    const successRate = pattern.successRate || 1.0;
    const normalizedTime = pattern.avgExecutionTime 
      ? Math.max(0, 1 - pattern.avgExecutionTime / 10000) // 标准化执行时间，假设10秒为最大值
      : 1.0;

    return (
      normalizedFrequency * frequencyWeight +
      successRate * successRateWeight +
      normalizedTime * executionTimeWeight
    );
  }

  /**
   * 计算实现难度
   * 基于命令复杂度和依赖关系
   */
  public static calculateImplementationDifficulty(pattern: CommandPattern): number {
    // 基础难度因素
    const factors = {
      commandLength: pattern.pattern.length / 100, // 命令长度
      parameterCount: (pattern.pattern.match(/--?\w+/g) || []).length / 5, // 参数数量
      pipeCount: (pattern.pattern.match(/\|/g) || []).length / 2, // 管道数量
      redirectCount: (pattern.pattern.match(/[<>]/g) || []).length / 2 // 重定向数量
    };

    // 计算总难度（0-1范围）
    const difficulty = Object.values(factors).reduce((sum, factor) => sum + factor, 0);
    return Math.min(Math.max(difficulty, 0), 1);
  }

  /**
   * 计算建议优先级
   * 基于影响力和实现难度
   */
  public static calculateSuggestionPriority(
    impact: number,
    difficulty: number
  ): number {
    // 优先级计算公式：影响力 * (1 - 难度/2)
    // 这样难度会降低优先级，但不会完全抵消高影响力
    return impact * (1 - difficulty / 2);
  }

  /**
   * 计算命令的复杂度得分
   * 基于命令的长度、参数数量、管道数量等因素
   */
  public static calculateComplexityScore(command: string): number {
    const factors = {
      length: command.length / 100,                                // 长度因子
      parameters: (command.match(/--?\w+/g) || []).length / 5,    // 参数因子
      pipes: (command.match(/\|/g) || []).length / 2,             // 管道因子
      redirects: (command.match(/[<>]/g) || []).length / 2,       // 重定向因子
      quotes: (command.match(/["']/g) || []).length / 4,          // 引号因子
      variables: (command.match(/\$\w+/g) || []).length / 3       // 变量因子
    };

    // 计算总复杂度（0-1范围）
    const complexity = Object.values(factors).reduce((sum, factor) => sum + factor, 0);
    return Math.min(Math.max(complexity, 0), 1);
  }

  /**
   * 计算模式的时间相关性得分
   * 基于执行时间的规律性和稳定性
   */
  public static calculateTimeRelevanceScore(
    pattern: CommandPattern,
    averageTimeGap: number
  ): number {
    if (!pattern.avgExecutionTime) return 0;

    // 计算时间间隔的标准差
    const timeDeviation = Math.abs(pattern.avgExecutionTime - averageTimeGap);
    const maxDeviation = averageTimeGap * 2;

    // 时间相关性得分（0-1范围）
    return Math.max(0, 1 - timeDeviation / maxDeviation);
  }

  /**
   * 计算模式的上下文相关性得分
   * 基于命令在特定上下文中的表现
   */
  public static calculateContextRelevanceScore(
    pattern: CommandPattern,
    contextSuccessRate: number
  ): number {
    const baseScore = pattern.successRate || 0;
    const contextBonus = contextSuccessRate * 0.3; // 上下文加成
    return Math.min(baseScore + contextBonus, 1.0);
  }

  /**
   * 计算模式的整体质量得分
   * 综合考虑多个因素
   */
  public static calculateOverallQualityScore(pattern: CommandPattern): number {
    const weights = {
      frequency: 0.3,    // 使用频率权重
      success: 0.25,     // 成功率权重
      confidence: 0.25,  // 置信度权重
      time: 0.2         // 时间表现权重
    };

    const scores = {
      frequency: Math.min(pattern.frequency / 100, 1),
      success: pattern.successRate || 1.0,
      confidence: pattern.confidence,
      time: pattern.avgExecutionTime 
        ? Math.max(0, 1 - pattern.avgExecutionTime / 10000)
        : 1.0
    };

    // 计算加权总分
    return Object.entries(weights).reduce(
      (total, [key, weight]) => total + (scores[key as keyof typeof scores] * weight),
      0
    );
  }

  /**
   * 计算建议的可行性得分
   * 基于多个实现相关的因素
   */
  public static calculateFeasibilityScore(
    pattern: CommandPattern,
    complexity: number
  ): number {
    const factors = {
      complexity: 1 - complexity,                    // 复杂度反向得分
      successRate: pattern.successRate || 1.0,       // 成功率
      frequency: Math.min(pattern.frequency / 50, 1) // 使用频率
    };

    // 计算加权平均
    const weights = { complexity: 0.4, successRate: 0.4, frequency: 0.2 };
    return Object.entries(weights).reduce(
      (score, [key, weight]) => score + (factors[key as keyof typeof factors] * weight),
      0
    );
  }
} 