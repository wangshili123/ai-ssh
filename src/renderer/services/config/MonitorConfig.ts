import { BaseConfig } from './BaseConfig';
import type { MonitorConfig } from '../../types/baseconfig/BaseConfigType';

const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  refreshInterval: 5,
  defaultPage: 'performance',
  enableCache: true,
  cacheExpiration: 30
};

export class MonitorConfigManager extends BaseConfig {
  private static instance: MonitorConfigManager;

  private constructor() {
    super();
    // 确保配置已初始化
    if (!BaseConfig.getConfig('monitor')) {
      BaseConfig.setConfig('monitor', DEFAULT_MONITOR_CONFIG);
    }
  }

  static getInstance(): MonitorConfigManager {
    if (!MonitorConfigManager.instance) {
      MonitorConfigManager.instance = new MonitorConfigManager();
    }
    return MonitorConfigManager.instance;
  }

  getConfig(): MonitorConfig {
    return BaseConfig.getConfig('monitor') as MonitorConfig || DEFAULT_MONITOR_CONFIG;
  }

  saveConfig(config: MonitorConfig): void {
    BaseConfig.setConfig('monitor', config);
  }
} 