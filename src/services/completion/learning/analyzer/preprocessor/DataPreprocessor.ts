import { CompletionUsage } from '../../types';
import { ProcessedData, ParameterPattern, AnalysisConfig } from '../types';
import { PatternExtractor } from '../patterns/PatternExtractor';

/**
 * 数据预处理器
 * 负责数据清洗和基础统计计算
 */
export class DataPreprocessor {
  /**
   * 预处理数据
   * @param data 原始补全使用数据
   * @param config 分析配置
   * @returns 处理后的数据
   */
  public static async preprocess(
    data: CompletionUsage[],
    config: AnalysisConfig
  ): Promise<ProcessedData> {
    console.log('[DataPreprocessor] 开始数据预处理...');
    
    const processedData: ProcessedData = {
      uniqueCommands: new Set<string>(),
      commandFrequency: new Map<string, number>(),
      parameterPatterns: [],
      contextPatterns: [],
      sequencePatterns: [],
      totalSamples: 0,
      totalUniqueCommands: 0,
      averageFrequency: 0
    };

    try {
      // 1. 数据清洗和基础统计
      await this.processBasicStatistics(data, processedData);

      // 2. 计算统计指标
      this.calculateStatistics(processedData);

      // 3. 提取各类模式
      await this.extractPatterns(data, processedData, config);

      console.log('[DataPreprocessor] 数据预处理完成:', {
        totalSamples: processedData.totalSamples,
        uniqueCommands: processedData.totalUniqueCommands,
        averageFrequency: processedData.averageFrequency,
        parameterPatterns: processedData.parameterPatterns.length,
        contextPatterns: processedData.contextPatterns.length,
        sequencePatterns: processedData.sequencePatterns.length
      });

      return processedData;

    } catch (error) {
      console.error('[DataPreprocessor] 数据预处理失败:', error);
      throw error;
    }
  }

  /**
   * 处理基础统计数据
   */
  private static async processBasicStatistics(
    data: CompletionUsage[],
    processedData: ProcessedData
  ): Promise<void> {
    for (const record of data) {
      const command = record.suggestion.trim();
      if (!command) continue;

      processedData.totalSamples++;

      // 更新命令频率
      processedData.uniqueCommands.add(command);
      processedData.commandFrequency.set(
        command,
        (processedData.commandFrequency.get(command) || 0) + 1
      );

      // 提取参数模式
      const parameterPattern = PatternExtractor.extractParameterPattern(command);
      if (parameterPattern) {
        this.updateParameterPatterns(processedData.parameterPatterns, parameterPattern);
      }
    }
  }

  /**
   * 计算统计指标
   */
  private static calculateStatistics(processedData: ProcessedData): void {
    // 计算唯一命令数
    processedData.totalUniqueCommands = processedData.uniqueCommands.size;
    
    // 计算平均频率
    let totalFrequency = 0;
    for (const frequency of processedData.commandFrequency.values()) {
      totalFrequency += frequency;
    }
    processedData.averageFrequency = processedData.totalUniqueCommands > 0
      ? totalFrequency / processedData.totalUniqueCommands
      : 0;
  }

  /**
   * 提取各类模式
   */
  private static async extractPatterns(
    data: CompletionUsage[],
    processedData: ProcessedData,
    config: AnalysisConfig
  ): Promise<void> {
    // 提取序列模式
    processedData.sequencePatterns = PatternExtractor.identifySequencePatterns(
      data,
      config.maxSequenceLength,
      config.minFrequency
    );

    // 提取上下文模式
    processedData.contextPatterns = PatternExtractor.identifyContextPatterns(
      data,
      config.contextWindow,
      config.minFrequency
    );
  }

  /**
   * 更新参数模式
   */
  private static updateParameterPatterns(
    patterns: ParameterPattern[],
    newPattern: ParameterPattern
  ): void {
    const existingPattern = patterns.find(p => 
      p.command === newPattern.command && p.parameter === newPattern.parameter
    );

    if (existingPattern) {
      existingPattern.frequency++;
      if (!existingPattern.examples.includes(newPattern.examples[0])) {
        existingPattern.examples.push(newPattern.examples[0]);
      }
    } else {
      patterns.push(newPattern);
    }
  }
} 