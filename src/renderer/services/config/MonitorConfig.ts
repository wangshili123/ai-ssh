import { BaseConfig } from './BaseConfig';
import type { MonitorConfig } from '../../types/baseconfig/BaseConfigType';

const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  refreshInterval: 5,
  defaultPage: 'performance'
};

export class MonitorConfigManager extends BaseConfig {
  private static instance: MonitorConfigManager;

  private constructor() {
    super();
  }

  static getInstance(): MonitorConfigManager {
    if (!MonitorConfigManager.instance) {
      MonitorConfigManager.instance = new MonitorConfigManager();
    }
    return MonitorConfigManager.instance;
  }

  async getConfig(): Promise<MonitorConfig> {
    const config = await BaseConfig.getConfig('monitor') as MonitorConfig;
    console.log('[MonitorConfigManager] 获取配置:', config);
    return config || DEFAULT_MONITOR_CONFIG;
  }

  async saveConfig(config: MonitorConfig): Promise<void> {
    await BaseConfig.setConfig('monitor', config);
  }
} 