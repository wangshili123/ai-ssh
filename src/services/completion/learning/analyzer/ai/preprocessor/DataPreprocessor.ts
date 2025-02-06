import { AIAnalysisInput } from '../types/ai-analysis.types';
import { ParameterPattern, ContextPattern, SequencePattern } from '../../types';

/**
 * 特征数据结构
 */
interface Features {
  commandFrequency: Map<string, number>;
  contextualUsage: Map<string, string[]>;
  timeDistribution: Map<string, number[]>;
  errorRates: Map<string, number>;
}

/**
 * 预处理后的数据结构
 */
interface ProcessedData {
  patterns: {
    parameters: ParameterPattern[];
    contexts: ContextPattern[];
    sequences: SequencePattern[];
  };
  metrics: {
    totalCommands: number;
    uniquePatterns: number;
    averageConfidence: number;
    averageSuccessRate: number;
    averageExecutionTime: number;
  };
  features: Features;
}

/**
 * 数据预处理器
 * 负责清洗和预处理 AI 分析的输入数据
 */
export class DataPreprocessor {
  /**
   * 预处理数据
   */
  public static async preprocess(input: AIAnalysisInput): Promise<ProcessedData> {
    try {
      console.log('[DataPreprocessor] Starting data preprocessing');

      // 1. 数据清洗
      const cleanedData = await this.cleanData(input);

      // 2. 特征提取
      const features = await this.extractFeatures(cleanedData);

      // 3. 数据规范化
      const normalizedData = await this.normalizeData(features);

      // 4. 生成处理后的数据
      const processedData = this.assembleProcessedData(normalizedData, input);

      console.log('[DataPreprocessor] Data preprocessing completed');
      return processedData;
    } catch (error) {
      console.error('[DataPreprocessor] Preprocessing failed:', error);
      throw new Error(`Data preprocessing failed: ${error}`);
    }
  }

  /**
   * 数据清洗
   */
  private static async cleanData(input: AIAnalysisInput): Promise<AIAnalysisInput> {
    // 1. 移除无效数据
    const validPatterns = input.baseAnalysis.patterns.filter(pattern => {
      if ('parameter' in pattern) {
        return pattern.command && pattern.parameter;
      } else if ('context' in pattern) {
        return pattern.command && pattern.context;
      } else if ('commands' in pattern) {
        return pattern.commands.length > 0;
      }
      return false;
    });

    // 2. 去重
    const uniquePatterns = this.removeDuplicates(validPatterns);

    // 3. 规范化字符串
    const normalizedPatterns = uniquePatterns.map(pattern => {
      if ('parameter' in pattern) {
        return {
          ...pattern,
          command: pattern.command.trim().toLowerCase(),
          parameter: pattern.parameter.trim()
        };
      } else if ('context' in pattern) {
        return {
          ...pattern,
          command: pattern.command.trim().toLowerCase(),
          context: pattern.context.trim()
        };
      } else {
        return {
          ...pattern,
          commands: pattern.commands.map(cmd => cmd.trim().toLowerCase())
        };
      }
    });

    return {
      ...input,
      baseAnalysis: {
        ...input.baseAnalysis,
        patterns: normalizedPatterns
      }
    };
  }

  /**
   * 特征提取
   */
  private static async extractFeatures(input: AIAnalysisInput): Promise<Features> {
    const features: Features = {
      commandFrequency: new Map<string, number>(),
      contextualUsage: new Map<string, string[]>(),
      timeDistribution: new Map<string, number[]>(),
      errorRates: new Map<string, number>()
    };

    // 1. 提取命令频率
    input.baseAnalysis.patterns.forEach(pattern => {
      if ('parameter' in pattern) {
        this.updateFrequency(features.commandFrequency, pattern.command);
      } else if ('context' in pattern) {
        this.updateFrequency(features.commandFrequency, pattern.command);
        this.updateContextualUsage(features.contextualUsage, pattern.command, pattern.context);
      } else if ('commands' in pattern) {
        pattern.commands.forEach(cmd => this.updateFrequency(features.commandFrequency, cmd));
      }
    });

    // 2. 提取时间分布
    input.context.historicalData.recentCommands.forEach(cmd => {
      const hour = new Date(cmd.timestamp).getHours();
      const command = cmd.command.split(' ')[0].toLowerCase();
      if (!features.timeDistribution.has(command)) {
        features.timeDistribution.set(command, new Array(24).fill(0));
      }
      features.timeDistribution.get(command)![hour]++;
    });

    // 3. 提取错误率
    input.context.historicalData.recentCommands.forEach(cmd => {
      const command = cmd.command.split(' ')[0].toLowerCase();
      if (!features.errorRates.has(command)) {
        features.errorRates.set(command, 0);
      }
      if (!cmd.success) {
        features.errorRates.set(command, features.errorRates.get(command)! + 1);
      }
    });

    return features;
  }

  /**
   * 数据规范化
   */
  private static async normalizeData(features: Features): Promise<Features> {
    // 1. 规范化频率
    const maxFrequency = Math.max(...Array.from(features.commandFrequency.values()));
    features.commandFrequency.forEach((value: number, key: string) => {
      features.commandFrequency.set(key, value / maxFrequency);
    });

    // 2. 规范化错误率
    features.errorRates.forEach((errors: number, command: string) => {
      const total = features.commandFrequency.get(command) || 1;
      features.errorRates.set(command, errors / total);
    });

    // 3. 规范化时间分布
    features.timeDistribution.forEach((distribution: number[], command: string) => {
      const total = distribution.reduce((a, b) => a + b, 0);
      if (total > 0) {
        features.timeDistribution.set(
          command,
          distribution.map(count => count / total)
        );
      }
    });

    return features;
  }

  /**
   * 组装处理后的数据
   */
  private static assembleProcessedData(
    features: Features,
    input: AIAnalysisInput
  ): ProcessedData {
    return {
      patterns: {
        parameters: input.baseAnalysis.patterns.filter(p => 'parameter' in p) as ParameterPattern[],
        contexts: input.baseAnalysis.patterns.filter(p => 'context' in p) as ContextPattern[],
        sequences: input.baseAnalysis.patterns.filter(p => 'commands' in p) as SequencePattern[]
      },
      metrics: input.baseAnalysis.metrics,
      features
    };
  }

  /**
   * 更新频率计数
   */
  private static updateFrequency(
    frequencyMap: Map<string, number>,
    command: string
  ): void {
    frequencyMap.set(command, (frequencyMap.get(command) || 0) + 1);
  }

  /**
   * 更新上下文使用情况
   */
  private static updateContextualUsage(
    contextMap: Map<string, string[]>,
    command: string,
    context: string
  ): void {
    if (!contextMap.has(command)) {
      contextMap.set(command, []);
    }
    contextMap.get(command)!.push(context);
  }

  /**
   * 去除重复模式
   */
  private static removeDuplicates(patterns: Array<ParameterPattern | ContextPattern | SequencePattern>): Array<ParameterPattern | ContextPattern | SequencePattern> {
    const seen = new Set<string>();
    return patterns.filter(pattern => {
      const key = this.getPatternKey(pattern);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 获取模式的唯一键
   */
  private static getPatternKey(pattern: ParameterPattern | ContextPattern | SequencePattern): string {
    if ('parameter' in pattern) {
      return `param:${pattern.command}:${pattern.parameter}`;
    } else if ('context' in pattern) {
      return `ctx:${pattern.command}:${pattern.context}`;
    } else {
      return `seq:${pattern.commands.join(':')}`;
    }
  }
} 