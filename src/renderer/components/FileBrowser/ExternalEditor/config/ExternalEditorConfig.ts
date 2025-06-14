import type {
  ExternalEditorSettings,
  EditorConfig,
  OpenMode,
  EditorValidationResult,
  FileAssociation
} from '../types/ExternalEditorTypes';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

// 将fs方法转换为Promise版本
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const access = promisify(fs.access);

/**
 * 外部编辑器配置管理器
 * 使用本地文件进行配置持久化
 */
export class ExternalEditorConfigManager {
  private static readonly CONFIG_DIR = path.join(os.tmpdir(), '.electerm');
  private static readonly CONFIG_FILE = path.join(ExternalEditorConfigManager.CONFIG_DIR, 'external-editor-config.json');
  private config: ExternalEditorSettings;
  constructor() {
    this.config = this.loadConfig();
  }

  private getDefaultConfig(): ExternalEditorSettings {
    return {
      editors: [],
      openMode: 'ask',
      autoUpload: true,
      uploadDelay: 2000,
      tempDirectory: path.join(os.tmpdir(), 'ssh-editor'),
      fileAssociations: {},
      rememberChoices: true
    };
  }

  private async ensureConfigDirectory(): Promise<void> {
    try {
      await access(ExternalEditorConfigManager.CONFIG_DIR);
    } catch (error) {
      // 目录不存在，创建它
      await mkdir(ExternalEditorConfigManager.CONFIG_DIR, { recursive: true });
    }
  }

  private loadConfig(): ExternalEditorSettings {
    try {
      // 同步读取配置文件
      if (fs.existsSync(ExternalEditorConfigManager.CONFIG_FILE)) {
        const data = fs.readFileSync(ExternalEditorConfigManager.CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(data);
        return { ...this.getDefaultConfig(), ...parsed };
      }
    } catch (error) {
      console.error('[ExternalEditorConfig] 加载配置失败:', error);
    }
    return this.getDefaultConfig();
  }

  private saveConfig(): void {
    try {
      // 确保目录存在（同步）
      if (!fs.existsSync(ExternalEditorConfigManager.CONFIG_DIR)) {
        fs.mkdirSync(ExternalEditorConfigManager.CONFIG_DIR, { recursive: true });
      }

      // 同步写入文件
      fs.writeFileSync(ExternalEditorConfigManager.CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf8');
      console.log('[ExternalEditorConfig] 配置已保存到:', ExternalEditorConfigManager.CONFIG_FILE);
    } catch (error) {
      console.error('[ExternalEditorConfig] 保存配置失败:', error);
    }
  }

  getConfig(): ExternalEditorSettings {
    return { ...this.config };
  }

  setConfig(config: ExternalEditorSettings): void {
    this.config = { ...config };
    this.saveConfig();
  }

  /**
   * 添加新编辑器
   */
  addEditor(name: string, executablePath: string, args?: string, isDefault?: boolean): string {
    const config = this.getConfig();
    const editorId = uuidv4();
    
    const newEditor: EditorConfig = {
      id: editorId,
      name: name.trim(),
      executablePath: executablePath.trim(),
      arguments: args?.trim(),
      isDefault: isDefault || config.editors.length === 0, // 第一个编辑器自动设为默认
      addedTime: Date.now()
    };

    // 如果设为默认，取消其他编辑器的默认状态
    if (newEditor.isDefault) {
      config.editors.forEach(editor => {
        editor.isDefault = false;
      });
      config.defaultEditor = editorId;
    }

    config.editors.push(newEditor);
    this.setConfig(config);
    
    console.log('[ExternalEditorConfig] 添加编辑器:', newEditor);
    return editorId;
  }

  /**
   * 删除编辑器
   */
  removeEditor(editorId: string): void {
    const config = this.getConfig();
    const editorIndex = config.editors.findIndex(e => e.id === editorId);
    
    if (editorIndex === -1) {
      console.warn('[ExternalEditorConfig] 编辑器不存在:', editorId);
      return;
    }

    const removedEditor = config.editors[editorIndex];
    config.editors.splice(editorIndex, 1);

    // 如果删除的是默认编辑器，设置新的默认编辑器
    if (removedEditor.isDefault && config.editors.length > 0) {
      config.editors[0].isDefault = true;
      config.defaultEditor = config.editors[0].id;
    } else if (config.editors.length === 0) {
      delete config.defaultEditor;
    }

    // 清理相关的文件关联
    Object.keys(config.fileAssociations).forEach(ext => {
      if (config.fileAssociations[ext] === editorId) {
        delete config.fileAssociations[ext];
      }
    });

    this.setConfig(config);
    console.log('[ExternalEditorConfig] 删除编辑器:', removedEditor.name);
  }

  /**
   * 更新编辑器配置
   */
  updateEditor(editorId: string, updates: Partial<EditorConfig>): void {
    const config = this.getConfig();
    const editor = config.editors.find(e => e.id === editorId);
    
    if (!editor) {
      console.warn('[ExternalEditorConfig] 编辑器不存在:', editorId);
      return;
    }

    // 更新编辑器属性
    Object.assign(editor, updates);

    // 如果设为默认，取消其他编辑器的默认状态
    if (updates.isDefault) {
      config.editors.forEach(e => {
        if (e.id !== editorId) {
          e.isDefault = false;
        }
      });
      config.defaultEditor = editorId;
    }

    this.setConfig(config);
    console.log('[ExternalEditorConfig] 更新编辑器:', editor.name);
  }

  /**
   * 获取所有编辑器
   */
  getEditors(): EditorConfig[] {
    return this.getConfig().editors;
  }

  /**
   * 根据ID获取编辑器
   */
  getEditor(editorId: string): EditorConfig | undefined {
    return this.getConfig().editors.find(e => e.id === editorId);
  }

  /**
   * 获取默认编辑器
   */
  getDefaultEditor(): EditorConfig | undefined {
    const config = this.getConfig();
    return config.editors.find(e => e.isDefault) || config.editors[0];
  }

  /**
   * 设置默认编辑器
   */
  setDefaultEditor(editorId: string): void {
    const config = this.getConfig();
    const editor = config.editors.find(e => e.id === editorId);
    
    if (!editor) {
      console.warn('[ExternalEditorConfig] 编辑器不存在:', editorId);
      return;
    }

    // 取消所有编辑器的默认状态
    config.editors.forEach(e => {
      e.isDefault = false;
    });

    // 设置新的默认编辑器
    editor.isDefault = true;
    config.defaultEditor = editorId;

    this.setConfig(config);
    console.log('[ExternalEditorConfig] 设置默认编辑器:', editor.name);
  }

  /**
   * 设置文件关联
   */
  setFileAssociation(extension: string, editorId: string): void {
    const config = this.getConfig();
    const editor = this.getEditor(editorId);
    
    if (!editor) {
      console.warn('[ExternalEditorConfig] 编辑器不存在:', editorId);
      return;
    }

    // 移除扩展名前的点号并转为小写
    const cleanExt = extension.replace(/^\./, '').toLowerCase();
    config.fileAssociations[cleanExt] = editorId;
    
    this.setConfig(config);
    console.log('[ExternalEditorConfig] 设置文件关联:', cleanExt, '->', editor.name);
  }

  /**
   * 根据文件名获取关联的编辑器
   */
  getEditorForFile(fileName: string): EditorConfig | undefined {
    const config = this.getConfig();
    const ext = path.extname(fileName).replace(/^\./, '').toLowerCase();
    
    if (!ext) return undefined;
    
    const editorId = config.fileAssociations[ext];
    return editorId ? this.getEditor(editorId) : undefined;
  }

  /**
   * 清除文件关联
   */
  clearFileAssociation(extension: string): void {
    const config = this.getConfig();
    const cleanExt = extension.replace(/^\./, '').toLowerCase();
    
    delete config.fileAssociations[cleanExt];
    this.setConfig(config);
    console.log('[ExternalEditorConfig] 清除文件关联:', cleanExt);
  }

  /**
   * 获取所有文件关联
   */
  getFileAssociations(): FileAssociation[] {
    const config = this.getConfig();
    return Object.entries(config.fileAssociations).map(([ext, editorId]) => {
      const editor = this.getEditor(editorId);
      return {
        extension: ext,
        editorId,
        editorName: editor?.name || '未知编辑器'
      };
    });
  }

  /**
   * 设置打开模式
   */
  setOpenMode(mode: OpenMode): void {
    const config = this.getConfig();
    config.openMode = mode;
    this.setConfig(config);
    console.log('[ExternalEditorConfig] 设置打开模式:', mode);
  }

  /**
   * 设置自动上传
   */
  setAutoUpload(enabled: boolean): void {
    const config = this.getConfig();
    config.autoUpload = enabled;
    this.setConfig(config);
    console.log('[ExternalEditorConfig] 设置自动上传:', enabled);
  }

  /**
   * 设置上传延迟
   */
  setUploadDelay(delay: number): void {
    const config = this.getConfig();
    config.uploadDelay = Math.max(500, delay); // 最小500ms
    this.setConfig(config);
    console.log('[ExternalEditorConfig] 设置上传延迟:', config.uploadDelay);
  }

  /**
   * 设置临时目录
   */
  setTempDirectory(directory: string): void {
    const config = this.getConfig();
    config.tempDirectory = directory;
    this.setConfig(config);
    console.log('[ExternalEditorConfig] 设置临时目录:', directory);
  }

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
    if (editor.name) {
      const existingEditor = this.getEditors().find(e =>
        e.name.toLowerCase() === editor.name!.toLowerCase() &&
        e.id !== (editor as EditorConfig).id
      );
      if (existingEditor) {
        errors.push('编辑器名称已存在');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * 重置配置为默认值
   */
  resetToDefault(): void {
    this.setConfig(this.getDefaultConfig());
    console.log('[ExternalEditorConfig] 重置为默认配置');
  }

  /**
   * 导出配置
   */
  exportConfig(): string {
    const config = this.getConfig();
    const exportData = {
      version: '1.0.0',
      exportTime: Date.now(),
      editors: config.editors,
      settings: {
        openMode: config.openMode,
        autoUpload: config.autoUpload,
        uploadDelay: config.uploadDelay,
        rememberChoices: config.rememberChoices
      }
    };
    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入配置
   */
  importConfig(configJson: string): boolean {
    try {
      const importData = JSON.parse(configJson);
      const config = this.getConfig();
      
      // 导入编辑器
      if (Array.isArray(importData.editors)) {
        importData.editors.forEach((editor: any) => {
          if (editor.name && editor.executablePath) {
            this.addEditor(
              editor.name,
              editor.executablePath,
              editor.arguments,
              editor.isDefault
            );
          }
        });
      }
      
      // 导入设置
      if (importData.settings) {
        Object.assign(config, importData.settings);
        this.setConfig(config);
      }
      
      console.log('[ExternalEditorConfig] 导入配置成功');
      return true;
    } catch (error) {
      console.error('[ExternalEditorConfig] 导入配置失败:', error);
      return false;
    }
  }
}

// 创建全局实例
export const externalEditorConfig = new ExternalEditorConfigManager();
