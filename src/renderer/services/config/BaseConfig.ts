import type { AppConfig } from '../../types/baseconfig/BaseConfigType';

const APP_CONFIG_KEY = 'app-config';

export class BaseConfig {
  private static config: AppConfig = {};
  private static initialized: boolean = false;
  private static initPromise: Promise<void> | null = null;

  public static init() {
    if (this.initialized || this.initPromise) {
      return this.initPromise;
    }

    console.log('[BaseConfig] 开始初始化配置');
    this.initPromise = new Promise<void>((resolve) => {
      const savedConfig = localStorage.getItem(APP_CONFIG_KEY);
      console.log('[BaseConfig] 读取配置:', savedConfig);
      
      if (savedConfig) {
        try {
          this.config = JSON.parse(savedConfig);
        } catch (error) {
          console.error('[BaseConfig] 配置解析失败:', error);
        }
      }
      
      this.initialized = true;
      resolve();
    });

    return this.initPromise;
  }

  public static save() {
    try {
      console.log('[BaseConfig] 保存配置:', this.config);
      localStorage.setItem(APP_CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('[BaseConfig] 配置保存失败:', error);
    }
  }

  protected static  getConfig(key: keyof AppConfig) {
    if (!this.initialized) {
      console.log('[BaseConfig] 等待配置初始化完成');
      this.init();
    }
    return this.config[key];
  }

  protected static  setConfig<K extends keyof AppConfig>(key: K, value: NonNullable<AppConfig[K]>) {
    if (!this.initialized) {
      console.log('[BaseConfig] 等待配置初始化完成');
      this.init();
    }
    this.config[key] = value;
  }
} 