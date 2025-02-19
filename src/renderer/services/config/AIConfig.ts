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
    proxyURL: ''
};

export class AIConfigManager extends BaseConfig {
  private static instance: AIConfigManager;

  private constructor() {
    super();
    // 确保配置已初始化
    if (!BaseConfig.getConfig('ai')) {
      BaseConfig.setConfig('ai', DEFAULT_AI_CONFIG);
    }
  }

  static getInstance(): AIConfigManager {
    if (!AIConfigManager.instance) {
      AIConfigManager.instance = new AIConfigManager();
    }
    return AIConfigManager.instance;
  }

  getConfig(): AIConfig {
    return BaseConfig.getConfig('ai') as AIConfig || DEFAULT_AI_CONFIG;
  }

  saveConfig(config: AIConfig): void {
    BaseConfig.setConfig('ai', config);
  }
} 