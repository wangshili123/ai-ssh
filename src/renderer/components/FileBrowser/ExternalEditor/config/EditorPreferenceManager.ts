import type { EditorPreferences, FileOpenPreference } from '../types/ExternalEditorTypes';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * 编辑器偏好管理器
 * 管理用户对不同文件类型的编辑器选择偏好
 */
export class EditorPreferenceManager {
  private static readonly CONFIG_DIR = path.join(os.homedir(), '.electerm');
  private static readonly CONFIG_FILE = path.join(EditorPreferenceManager.CONFIG_DIR, 'editor-preferences.json');
  private preferences: EditorPreferences;

  constructor() {
    this.preferences = this.loadPreferences();
  }

  private getDefaultPreferences(): EditorPreferences {
    return {
      defaultOpenMode: 'builtin',
      fileOpenPreferences: {}
    };
  }

  private loadPreferences(): EditorPreferences {
    try {
      // 同步读取配置文件
      if (fs.existsSync(EditorPreferenceManager.CONFIG_FILE)) {
        const data = fs.readFileSync(EditorPreferenceManager.CONFIG_FILE, 'utf8');
        const parsed = JSON.parse(data);
        return { ...this.getDefaultPreferences(), ...parsed };
      }
    } catch (error) {
      console.error('[EditorPreferenceManager] 加载偏好设置失败:', error);
    }
    return this.getDefaultPreferences();
  }

  private savePreferences(): void {
    try {
      // 确保目录存在（同步）
      if (!fs.existsSync(EditorPreferenceManager.CONFIG_DIR)) {
        fs.mkdirSync(EditorPreferenceManager.CONFIG_DIR, { recursive: true });
      }

      // 同步写入文件
      fs.writeFileSync(EditorPreferenceManager.CONFIG_FILE, JSON.stringify(this.preferences, null, 2), 'utf8');
      console.log('[EditorPreferenceManager] 偏好设置已保存到:', EditorPreferenceManager.CONFIG_FILE);
    } catch (error) {
      console.error('[EditorPreferenceManager] 保存偏好设置失败:', error);
    }
  }

  /**
   * 获取文件的扩展名
   */
  private getFileExtension(fileName: string): string {
    return path.extname(fileName).replace(/^\./, '').toLowerCase();
  }

  /**
   * 设置文件类型的编辑器偏好
   */
  setFilePreference(fileName: string, editorType: 'builtin' | 'external'): void {
    const extension = this.getFileExtension(fileName);
    if (extension) {
      this.preferences.fileOpenPreferences[extension] = editorType;
      this.savePreferences();
      console.log(`[EditorPreferenceManager] 设置 .${extension} 文件偏好为: ${editorType}`);
    }
  }

  /**
   * 获取文件的编辑器偏好
   */
  getFilePreference(fileName: string): 'builtin' | 'external' {
    const extension = this.getFileExtension(fileName);
    if (extension && this.preferences.fileOpenPreferences[extension]) {
      return this.preferences.fileOpenPreferences[extension];
    }
    return this.preferences.defaultOpenMode;
  }

  /**
   * 设置默认打开方式
   */
  setDefaultOpenMode(mode: 'builtin' | 'external'): void {
    this.preferences.defaultOpenMode = mode;
    this.savePreferences();
    console.log(`[EditorPreferenceManager] 设置默认打开方式为: ${mode}`);
  }

  /**
   * 获取默认打开方式
   */
  getDefaultOpenMode(): 'builtin' | 'external' {
    return this.preferences.defaultOpenMode;
  }

  /**
   * 获取所有偏好设置
   */
  getPreferences(): EditorPreferences {
    return { ...this.preferences };
  }

  /**
   * 清除文件类型偏好
   */
  clearFilePreference(fileName: string): void {
    const extension = this.getFileExtension(fileName);
    if (extension && this.preferences.fileOpenPreferences[extension]) {
      delete this.preferences.fileOpenPreferences[extension];
      this.savePreferences();
      console.log(`[EditorPreferenceManager] 清除 .${extension} 文件偏好`);
    }
  }

  /**
   * 清除所有偏好设置
   */
  clearAllPreferences(): void {
    this.preferences = this.getDefaultPreferences();
    this.savePreferences();
    console.log('[EditorPreferenceManager] 清除所有偏好设置');
  }

  /**
   * 获取文件类型偏好列表
   */
  getFilePreferenceList(): Array<{ extension: string; editorType: 'builtin' | 'external' }> {
    return Object.entries(this.preferences.fileOpenPreferences).map(([extension, editorType]) => ({
      extension,
      editorType
    }));
  }

  /**
   * 检查是否有文件类型偏好设置
   */
  hasFilePreference(fileName: string): boolean {
    const extension = this.getFileExtension(fileName);
    return extension ? !!this.preferences.fileOpenPreferences[extension] : false;
  }
}

// 导出单例实例
export const editorPreferenceManager = new EditorPreferenceManager();
