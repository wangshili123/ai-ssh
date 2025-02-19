import type { AppConfig } from '../../types/baseconfig/BaseConfigType';

const APP_CONFIG_KEY = 'app-config';

export class BaseConfig {
  private static config: AppConfig = {};

  public static init() {
    const savedConfig = localStorage.getItem(APP_CONFIG_KEY);
    console.log('[BaseConfig] 初始化配置:', savedConfig);
    if (savedConfig) {
      try {
        this.config = JSON.parse(savedConfig);

      } catch (error) {
        console.error('[BaseConfig] 配置解析失败:', error);
      }
    }
  }

  public static save() {
    try {
      console.log('[BaseConfig] 保存配置:', this.config);
      localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('[BaseConfig] 配置保存失败:', error);
    }
  }

  protected static getConfig(key: keyof AppConfig) {
    return this.config[key];
  }

  protected static setConfig<K extends keyof AppConfig>(key: K, value: NonNullable<AppConfig[K]>) {
    this.config[key] = value;
  }
} 