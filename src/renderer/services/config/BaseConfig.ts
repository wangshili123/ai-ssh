import type { AppConfig } from '../../types/baseconfig/BaseConfigType';
import { ipcRenderer } from 'electron';

export class BaseConfig {
  private static config: AppConfig = {};
  private static initialized: boolean = false;
  private static initPromise: Promise<void> | null = null;

  public static async init() {
    if (this.initialized || this.initPromise) {
      return this.initPromise;
    }

    console.log('[BaseConfig] 开始初始化配置');
    this.initPromise = new Promise<void>(async (resolve) => {
      try {
        // 从主进程加载配置文件
        const response = await ipcRenderer.invoke('storage:load-base-config');
        if (response.success && response.data) {
          this.config = response.data;
          console.log('[BaseConfig] 从文件加载配置:', this.config);
        } else {
          console.log('[BaseConfig] 使用默认配置');
          this.config = {};
        }
      } catch (error) {
        console.error('[BaseConfig] 配置加载失败:', error);
        this.config = {};
      }

      this.initialized = true;
      resolve();
    });

    return this.initPromise;
  }

  public static async save() {
    try {
      console.log('[BaseConfig] 保存配置到文件:', this.config);
      const response = await ipcRenderer.invoke('storage:save-base-config', this.config);
      if (!response.success) {
        throw new Error(response.error);
      }
      console.log('[BaseConfig] 配置保存成功');
    } catch (error) {
      console.error('[BaseConfig] 配置保存失败:', error);
      throw error;
    }
  }

  protected static async getConfig(key: keyof AppConfig) {
    if (!this.initialized) {
      console.log('[BaseConfig] 等待配置初始化完成');
      await this.init();
    }
    return this.config[key];
  }

  protected static async setConfig<K extends keyof AppConfig>(key: K, value: NonNullable<AppConfig[K]>) {
    if (!this.initialized) {
      console.log('[BaseConfig] 等待配置初始化完成');
      await this.init();
    }
    this.config[key] = value;
    // 立即保存到文件
    await this.save();
  }
} 