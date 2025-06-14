import { BaseConfig } from './BaseConfig';
import { uiSettingsManager } from '../UISettingsManager';
import type { TerminalShortcutConfig } from '../../types/baseconfig/BaseConfigType';

/**
 * 终端快捷键配置管理器
 */
export class TerminalShortcutConfigManager extends BaseConfig {
  private static instance: TerminalShortcutConfigManager;

  public static getInstance(): TerminalShortcutConfigManager {
    if (!TerminalShortcutConfigManager.instance) {
      TerminalShortcutConfigManager.instance = new TerminalShortcutConfigManager();
    }
    return TerminalShortcutConfigManager.instance;
  }

  /**
   * 获取默认配置
   */
  private getDefaultConfig(): TerminalShortcutConfig {
    return {
      // 智能补全快捷键
      acceptCompletion: 'Ctrl+Tab',
      acceptCompletionAlt: 'Alt+/',
      clearCompletion: 'Escape',
      navigateUp: 'Alt+ArrowUp',
      navigateDown: 'Alt+ArrowDown',

      // 终端操作快捷键
      copy: 'Ctrl+Shift+C',
      paste: 'Ctrl+Shift+V',
      clear: 'Ctrl+Shift+L',
      search: 'Ctrl+Shift+F'
    };
  }

  /**
   * 获取终端快捷键配置
   */
  public getConfig(): TerminalShortcutConfig {
    try {
      // 优先从ui-config中读取
      const uiSettings = uiSettingsManager.getSettings();
      if (uiSettings.baseConfig?.terminalShortcuts) {
        return uiSettings.baseConfig.terminalShortcuts;
      }

      // 回退到BaseConfig
      const config = TerminalShortcutConfigManager.getConfig('terminalShortcuts') as TerminalShortcutConfig;
      return config || this.getDefaultConfig();
    } catch (error) {
      console.error('[TerminalShortcutConfigManager] 获取配置失败:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * 保存终端快捷键配置
   */
  public async saveConfig(config: TerminalShortcutConfig): Promise<void> {
    console.log('[TerminalShortcutConfigManager] 保存终端快捷键配置:', config);

    try {
      // 保存到ui-config
      const currentSettings = uiSettingsManager.getSettings();
      await uiSettingsManager.updateSettings({
        ...currentSettings,
        baseConfig: {
          ...currentSettings.baseConfig,
          terminalShortcuts: config
        }
      });

      // 同时保存到BaseConfig作为备份
      TerminalShortcutConfigManager.setConfig('terminalShortcuts', config);
    } catch (error) {
      console.error('[TerminalShortcutConfigManager] 保存配置失败:', error);
      // 如果ui-config保存失败，至少保存到BaseConfig
      TerminalShortcutConfigManager.setConfig('terminalShortcuts', config);
    }
  }

  /**
   * 重置为默认配置
   */
  public resetToDefault(): void {
    const defaultConfig = this.getDefaultConfig();
    this.saveConfig(defaultConfig);
  }

  /**
   * 检查快捷键是否匹配
   * @param event 键盘事件
   * @param shortcut 快捷键字符串，如 'Ctrl+Tab', 'Alt+/', 'Escape'
   * @returns 是否匹配
   */
  public static matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
    const parts = shortcut.split('+');
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    // 检查主键
    let keyMatches = false;
    if (key === 'Tab') {
      keyMatches = event.key === 'Tab';
    } else if (key === 'Escape') {
      keyMatches = event.key === 'Escape';
    } else if (key === 'ArrowUp') {
      keyMatches = event.key === 'ArrowUp';
    } else if (key === 'ArrowDown') {
      keyMatches = event.key === 'ArrowDown';
    } else if (key === '/') {
      keyMatches = event.key === '/';
    } else {
      keyMatches = event.key === key;
    }

    if (!keyMatches) return false;

    // 检查修饰键
    const hasCtrl = modifiers.includes('Ctrl');
    const hasAlt = modifiers.includes('Alt');
    const hasShift = modifiers.includes('Shift');
    const hasMeta = modifiers.includes('Meta');

    return (
      event.ctrlKey === hasCtrl &&
      event.altKey === hasAlt &&
      event.shiftKey === hasShift &&
      event.metaKey === hasMeta
    );
  }

  /**
   * 格式化快捷键显示文本
   * @param shortcut 快捷键字符串
   * @returns 格式化后的显示文本
   */
  public static formatShortcutDisplay(shortcut: string): string {
    return shortcut.replace(/\+/g, ' + ');
  }

}
