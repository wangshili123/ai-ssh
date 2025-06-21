import { uiSettingsManager } from '../../../../services/UISettingsManager';
import type { ExternalEditorSettings } from '../../../../main/services/storage';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as os from 'os';
import { eventBus } from '../../../../services/eventBus';

// 重新导出类型，保持兼容性
export type { ExternalEditorSettings } from '../../../../main/services/storage';
export interface EditorConfig {
  id: string;
  name: string;
  executablePath: string;
  arguments?: string;
  isDefault: boolean;
  addedTime: number;
}

export interface EditorValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 统一的外部编辑器配置管理器
 * 使用UISettingsManager作为单一数据源，避免缓存不一致问题
 */
export class UnifiedEditorConfigManager {
  constructor() {
    // 不再需要私有缓存，直接使用uiSettingsManager
  }

  /**
   * 获取默认配置
   */
  private getDefaultSettings(): ExternalEditorSettings {
    return {
      editors: [],
      openMode: 'ask',
      autoUpload: true,
      uploadDelay: 2000,
      tempDirectory: path.join(os.tmpdir(), 'electerm-editor'),
      fileAssociations: {},
      rememberChoices: true,
      defaultOpenMode: 'builtin',
      fileOpenPreferences: {}
    };
  }

  /**
   * 获取外部编辑器设置
   */
  private async getExternalEditorSettings(): Promise<ExternalEditorSettings> {
    try {
      const uiSettings = uiSettingsManager.getSettings();
      const editorSettings = uiSettings.externalEditorSettings || this.getDefaultSettings();

      // 确保 editors 数组存在
      if (!editorSettings.editors) {
        editorSettings.editors = [];
      }

      return editorSettings;
    } catch (error) {
      console.error('[UnifiedEditorConfig] 获取配置失败:', error);
      return this.getDefaultSettings();
    }
  }

  /**
   * 保存外部编辑器设置
   */
  private async saveExternalEditorSettings(settings: ExternalEditorSettings): Promise<void> {
    try {
      const currentUiSettings = uiSettingsManager.getSettings();
      await uiSettingsManager.updateSettings({
        ...currentUiSettings,
        externalEditorSettings: settings
      });
      console.log('[UnifiedEditorConfig] 配置已保存');

      // 触发配置变化事件，通知其他组件配置已更新
      eventBus.emit('external-editor-config-changed', settings);
      console.log('[UnifiedEditorConfig] 已触发配置变化事件');
    } catch (error) {
      console.error('[UnifiedEditorConfig] 保存配置失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有设置
   */
  async getSettings(): Promise<ExternalEditorSettings> {
    return await this.getExternalEditorSettings();
  }

  /**
   * 更新设置
   */
  async updateSettings(updates: Partial<ExternalEditorSettings>): Promise<void> {
    const currentSettings = await this.getExternalEditorSettings();
    const newSettings = { ...currentSettings, ...updates };
    await this.saveExternalEditorSettings(newSettings);
  }

  // ==================== 编辑器管理 ====================

  /**
   * 获取所有编辑器
   */
  async getEditors(): Promise<EditorConfig[]> {
    const settings = await this.getSettings();
    return settings.editors || [];
  }

  /**
   * 添加编辑器
   */
  async addEditor(name: string, executablePath: string, args?: string, isDefault?: boolean): Promise<string> {
    const currentSettings = await this.getExternalEditorSettings();

    const editorId = uuidv4();
    const newEditor: EditorConfig = {
      id: editorId,
      name: name.trim(),
      executablePath: executablePath.trim(),
      arguments: args?.trim(),
      isDefault: isDefault || currentSettings.editors.length === 0,
      addedTime: Date.now()
    };

    // 如果设为默认，取消其他编辑器的默认状态
    if (newEditor.isDefault) {
      currentSettings.editors.forEach(editor => {
        editor.isDefault = false;
      });
      currentSettings.defaultEditor = editorId;
    }

    currentSettings.editors.push(newEditor);
    await this.saveExternalEditorSettings(currentSettings);

    console.log('[UnifiedEditorConfig] 添加编辑器:', newEditor);
    return editorId;
  }

  /**
   * 删除编辑器
   */
  async removeEditor(editorId: string): Promise<void> {
    const currentSettings = await this.getExternalEditorSettings();

    const editorIndex = currentSettings.editors.findIndex(e => e.id === editorId);
    if (editorIndex === -1) {
      console.warn('[UnifiedEditorConfig] 编辑器不存在:', editorId);
      return;
    }

    const removedEditor = currentSettings.editors[editorIndex];
    currentSettings.editors.splice(editorIndex, 1);

    // 如果删除的是默认编辑器，设置新的默认编辑器
    if (removedEditor.isDefault && currentSettings.editors.length > 0) {
      currentSettings.editors[0].isDefault = true;
      currentSettings.defaultEditor = currentSettings.editors[0].id;
    } else if (currentSettings.editors.length === 0) {
      delete currentSettings.defaultEditor;
    }

    // 清理相关的文件关联
    Object.keys(currentSettings.fileAssociations).forEach(ext => {
      if (currentSettings.fileAssociations[ext] === editorId) {
        delete currentSettings.fileAssociations[ext];
      }
    });

    await this.saveExternalEditorSettings(currentSettings);
    console.log('[UnifiedEditorConfig] 删除编辑器:', removedEditor.name);
  }

  /**
   * 更新编辑器
   */
  async updateEditor(editorId: string, updates: Partial<EditorConfig>): Promise<void> {
    const currentSettings = await this.getExternalEditorSettings();

    const editor = currentSettings.editors.find(e => e.id === editorId);
    if (!editor) {
      console.warn('[UnifiedEditorConfig] 编辑器不存在:', editorId);
      return;
    }

    // 更新编辑器属性
    Object.assign(editor, updates);

    // 如果设为默认，取消其他编辑器的默认状态
    if (updates.isDefault) {
      currentSettings.editors.forEach(e => {
        if (e.id !== editorId) {
          e.isDefault = false;
        }
      });
      currentSettings.defaultEditor = editorId;
    }

    await this.saveExternalEditorSettings(currentSettings);
    console.log('[UnifiedEditorConfig] 更新编辑器:', editor.name);
  }

  /**
   * 获取默认编辑器
   */
  async getDefaultEditor(): Promise<EditorConfig | undefined> {
    const settings = await this.getSettings();
    return settings.editors.find(e => e.isDefault) || settings.editors[0];
  }

  /**
   * 设置默认编辑器
   */
  async setDefaultEditor(editorId: string): Promise<void> {
    const currentSettings = await this.getExternalEditorSettings();

    const editor = currentSettings.editors.find(e => e.id === editorId);
    if (!editor) {
      console.warn('[UnifiedEditorConfig] 编辑器不存在:', editorId);
      return;
    }

    // 取消所有编辑器的默认状态
    currentSettings.editors.forEach(e => {
      e.isDefault = false;
    });

    // 设置新的默认编辑器
    editor.isDefault = true;
    currentSettings.defaultEditor = editorId;

    await this.saveExternalEditorSettings(currentSettings);
    console.log('[UnifiedEditorConfig] 设置默认编辑器:', editor.name);
  }

  // ==================== 文件关联管理 ====================

  /**
   * 设置文件关联
   */
  async setFileAssociation(extension: string, editorId: string): Promise<void> {
    const currentSettings = await this.getExternalEditorSettings();

    const editor = currentSettings.editors.find(e => e.id === editorId);
    if (!editor) {
      console.warn('[UnifiedEditorConfig] 编辑器不存在:', editorId);
      return;
    }

    const cleanExt = extension.replace(/^\./, '').toLowerCase();
    currentSettings.fileAssociations[cleanExt] = editorId;

    await this.saveExternalEditorSettings(currentSettings);
    console.log('[UnifiedEditorConfig] 设置文件关联:', cleanExt, '->', editor.name);
  }

  /**
   * 获取文件关联的编辑器
   */
  async getEditorForFile(fileName: string): Promise<EditorConfig | undefined> {
    const settings = await this.getSettings();
    const ext = path.extname(fileName).replace(/^\./, '').toLowerCase();
    
    if (!ext) return undefined;
    
    const editorId = settings.fileAssociations[ext];
    return editorId ? settings.editors.find(e => e.id === editorId) : undefined;
  }

  // ==================== 用户偏好管理 ====================

  /**
   * 设置文件类型的编辑器偏好
   */
  async setFilePreference(fileName: string, editorType: 'builtin' | 'external'): Promise<void> {
    const currentSettings = await this.getExternalEditorSettings();

    const extension = path.extname(fileName).replace(/^\./, '').toLowerCase();
    if (extension) {
      if (!currentSettings.fileOpenPreferences) {
        currentSettings.fileOpenPreferences = {};
      }
      currentSettings.fileOpenPreferences[extension] = editorType;
      await this.saveExternalEditorSettings(currentSettings);
      console.log(`[UnifiedEditorConfig] 设置 .${extension} 文件偏好为: ${editorType}`);
    }
  }

  /**
   * 获取文件的编辑器偏好
   */
  async getFilePreference(fileName: string): Promise<'builtin' | 'external'> {
    const settings = await this.getSettings();
    const extension = path.extname(fileName).replace(/^\./, '').toLowerCase();

    if (extension && settings.fileOpenPreferences && settings.fileOpenPreferences[extension]) {
      return settings.fileOpenPreferences[extension];
    }
    return settings.defaultOpenMode || 'builtin';
  }

  /**
   * 设置默认打开方式
   */
  async setDefaultOpenMode(mode: 'builtin' | 'external'): Promise<void> {
    const currentSettings = await this.getExternalEditorSettings();
    currentSettings.defaultOpenMode = mode;
    await this.saveExternalEditorSettings(currentSettings);
    console.log(`[UnifiedEditorConfig] 设置默认打开方式为: ${mode}`);
  }

  /**
   * 获取默认打开方式
   */
  async getDefaultOpenMode(): Promise<'builtin' | 'external'> {
    const settings = await this.getSettings();
    return settings.defaultOpenMode || 'builtin';
  }

  // ==================== 验证方法 ====================

  /**
   * 验证编辑器配置
   */
  async validateEditor(editor: Partial<EditorConfig>): Promise<EditorValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查必填字段
    if (!editor.name?.trim()) {
      errors.push('编辑器名称不能为空');
    }

    if (!editor.executablePath?.trim()) {
      errors.push('可执行文件路径不能为空');
    } else {
      // 简单的路径格式检查
      if (!editor.executablePath.includes('.exe') && process.platform === 'win32') {
        warnings.push('Windows平台建议选择.exe文件');
      }
    }

    // 检查名称是否重复
    if (editor.name?.trim()) {
      try {
        const editors = await this.getEditors();
        const existingEditor = editors.find(e =>
          e.name.toLowerCase() === editor.name!.toLowerCase() &&
          e.id !== (editor as EditorConfig).id
        );
        if (existingEditor) {
          errors.push('编辑器名称已存在');
        }
      } catch (error) {
        console.error('[UnifiedEditorConfig] 检查编辑器名称重复时出错:', error);
        warnings.push('无法检查编辑器名称重复，请确保名称唯一');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// 导出单例实例
export const unifiedEditorConfig = new UnifiedEditorConfigManager();
