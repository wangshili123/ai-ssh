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
} 