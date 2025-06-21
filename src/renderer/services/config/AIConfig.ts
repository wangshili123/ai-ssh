import { BaseConfig } from './BaseConfig';
import type { AIConfig } from '../../types/baseconfig/BaseConfigType';

const DEFAULT_AI_CONFIG: AIConfig = {
    model: '',
    temperature: 0.7,
    maxTokens: 60000,
    baseURL: 'https://api.openai.com/v1',
    agentAutoRun: false,
    agentRiskLevel: 'low',
    apiKey: '',
    proxyURL: '',

    // 自动分析配置默认值
    autoAnalysisEnabled: false,              // 默认关闭自动分析
    autoAnalysisFrequency: 'weekly',         // 默认每周分析一次
    autoAnalysisQuotaLimit: 50,              // 默认每月50次调用限制
    autoAnalysisCurrentUsage: 0,             // 初始使用次数为0
    autoAnalysisLastResetMonth: new Date().toISOString().slice(0, 7)  // 当前月份 YYYY-MM
};

export class AIConfigManager extends BaseConfig {
  private static instance: AIConfigManager;

  private constructor() {
    super();
  }

  static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  async getConfig(): Promise<AIConfig> {
    const config = await BaseConfig.getConfig('ai') as AIConfig;
    return config || DEFAULT_AI_CONFIG;
  }

  async saveConfig(config: AIConfig): Promise<void> {
    await BaseConfig.setConfig('ai', config);
  }

  /**
   * 检查并重置月度使用次数
   */
  async checkAndResetMonthlyUsage(): Promise<AIConfig> {
    const config = await this.getConfig();
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM格式
    const lastResetMonth = config.autoAnalysisLastResetMonth || currentMonth;

    // 如果当前月份与上次重置月份不同，则重置使用次数
    if (currentMonth !== lastResetMonth) {
      const updatedConfig = {
        ...config,
        autoAnalysisCurrentUsage: 0,
        autoAnalysisLastResetMonth: currentMonth
      };

      await this.saveConfig(updatedConfig);
      console.log('[AIConfigManager] 月度使用次数已重置:', {
        previousMonth: lastResetMonth,
        currentMonth,
        previousUsage: config.autoAnalysisCurrentUsage || 0
      });

      return updatedConfig;
    }

    return config;
  }
}