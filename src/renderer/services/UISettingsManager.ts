import { storageService } from './storage';
import type { UISettings } from '../../main/services/storage';

/**
 * UI设置管理器
 * 统一管理所有UI相关的设置
 */
class UISettingsManager {
  private static instance: UISettingsManager;
  private settings: UISettings;
  private saveTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    // 初始化默认设置
    this.settings = {
      isFileBrowserVisible: true,
      isAIVisible: false,
      fileOpenSettings: {
        defaultEditor: 'built-in' as const,
        fileTypeAssociations: {}
      }
    };
  }

  static getInstance(): UISettingsManager {
    if (!UISettingsManager.instance) {
      UISettingsManager.instance = new UISettingsManager();
    }
    return UISettingsManager.instance;
  }

  /**
   * 初始化设置
   */
  async init(): Promise<void> {
    try {
      const savedSettings = await storageService.loadUISettings();
      this.settings = savedSettings;
    } catch (error) {
      console.error('[UISettingsManager] 加载设置失败:', error);
    }
  }

  /**
   * 获取当前设置
   */
  getSettings(): UISettings {
    return { ...this.settings };
  }

  /**
   * 更新部分设置
   * @param partialSettings 要更新的设置项
   */
  async updateSettings(partialSettings: Partial<UISettings>): Promise<void> {
    console.log('[UISettingsManager] 更新设置前:', JSON.stringify(this.settings, null, 2));
    console.log('[UISettingsManager] 要更新的设置:', JSON.stringify(partialSettings, null, 2));

    // 深度合并设置，确保嵌套对象不会被覆盖
    this.settings = {
      ...this.settings,
      ...partialSettings,
      // 确保 fileOpenSettings 的更新不会完全覆盖原有值
      fileOpenSettings: {
        ...this.settings.fileOpenSettings,
        ...(partialSettings.fileOpenSettings || {})
      },
      // 确保 externalEditorSettings 的更新不会完全覆盖原有值
      externalEditorSettings: {
        ...this.settings.externalEditorSettings,
        ...(partialSettings.externalEditorSettings || {})
      },
      // 确保 baseConfig 的更新不会完全覆盖原有值
      baseConfig: {
        ...this.settings.baseConfig,
        ...(partialSettings.baseConfig || {})
      }
    };

    console.log('[UISettingsManager] 更新设置后:', JSON.stringify(this.settings, null, 2));

    // 使用防抖进行保存
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(async () => {
      try {
        await storageService.saveUISettings(this.settings);
        console.log('[UISettingsManager] 设置已保存到文件');
      } catch (error) {
        console.error('[UISettingsManager] 保存设置失败:', error);
      }
    }, 500);
  }

  /**
   * 更新文件打开设置
   */
  async updateFileOpenSettings(extension: string, editor: 'built-in'): Promise<void> {
    const newFileOpenSettings = {
      ...this.settings.fileOpenSettings,
      fileTypeAssociations: {
        ...this.settings.fileOpenSettings.fileTypeAssociations,
        [extension]: { editor }
      }
    };

    await this.updateSettings({
      fileOpenSettings: newFileOpenSettings
    });
  }

  /**
   * 获取文件的默认编辑器
   */
  getDefaultEditor(extension: string): 'built-in' {
    const fileOpenSettings = this.settings.fileOpenSettings;
    return fileOpenSettings.fileTypeAssociations[extension]?.editor || fileOpenSettings.defaultEditor;
  }
}

export const uiSettingsManager = UISettingsManager.getInstance(); 