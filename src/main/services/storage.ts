import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { SessionInfo } from '../../renderer/types/index';

// 分组信息接口
export interface GroupInfo {
  id: string;
  name: string;
  expanded?: boolean;
  order: number;
}

// UI设置接口
export interface UISettings {
  isFileBrowserVisible: boolean;
  isAIVisible: boolean;
  fileOpenSettings: FileOpenSettings;  // 添加文件打开设置
  externalEditorSettings: ExternalEditorSettings;  // 添加外部编辑器设置
  baseConfig?: {  // 添加基础配置支持
    monitor?: any;
    ai?: any;
    terminalShortcuts?: any;
  };
}

// 文件打开设置接口
export interface FileOpenSettings {
  defaultEditor: 'built-in';
  fileTypeAssociations: {
    [extension: string]: {
      editor: 'built-in';
    }
  }
}

// 外部编辑器配置接口
export interface ExternalEditorConfig {
  id: string;
  name: string;
  executablePath: string;
  arguments?: string;
  isDefault: boolean;
  addedTime: number;
}

// 外部编辑器设置接口
export interface ExternalEditorSettings {
  editors: ExternalEditorConfig[];
  openMode: 'ask' | 'default' | 'remember';
  autoUpload: boolean;
  uploadDelay: number;
  tempDirectory: string;
  fileAssociations: { [extension: string]: string };
  rememberChoices: boolean;
  defaultEditor?: string;
  // 用户偏好设置
  defaultOpenMode: 'builtin' | 'external';
  fileOpenPreferences: { [extension: string]: 'builtin' | 'external' };
}

// 加密密钥，实际应用中应该使用更安全的方式存储
const ENCRYPTION_KEY = 'your-secret-key-32-chars-long!!!';
const IV_LENGTH = 16;

class StorageService {
  private storagePath: string;
  private groupsPath: string;
  private uiSettingsPath: string;  // 新增UI设置存储路径

  constructor() {
    try {
      // 在用户数据目录下创建存储文件
      const userDataPath = app.getPath('userData');
      this.storagePath = path.join(userDataPath, 'sessions.json');
      this.groupsPath = path.join(userDataPath, 'groups.json');
      this.uiSettingsPath = path.join(userDataPath, 'ui-settings.json');  // 新增
    } catch (error) {
      // 如果在渲染进程中，提供一个默认路径
      console.warn('无法获取 app.getPath，使用默认路径', error);
      const defaultPath = path.join(process.cwd(), '.storage');
      this.storagePath = path.join(defaultPath, 'sessions.json');
      this.groupsPath = path.join(defaultPath, 'groups.json');
      this.uiSettingsPath = path.join(defaultPath, 'ui-settings.json');  // 新增
      
      // 确保目录存在
      if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath, { recursive: true });
      }
    }
  }

  // 加密数据
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  // 解密数据
  private decrypt(text: string): string {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift() || '', 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY),
      iv
    );
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  }

  // 保存会话数据
  async saveSessions(sessions: SessionInfo[]): Promise<void> {
    try {
      // 处理敏感信息
      const processedSessions = sessions.map(session => ({
        ...session,
        password: session.password ? this.encrypt(session.password) : undefined,
        privateKey: session.privateKey ? this.encrypt(session.privateKey) : undefined
      }));

      await fs.promises.writeFile(
        this.storagePath,
        JSON.stringify(processedSessions, null, 2)
      );
    } catch (error) {
      console.error('保存会话数据失败:', error);
      throw error;
    }
  }

  // 读取会话数据
  async loadSessions(): Promise<SessionInfo[]> {
    try {
      if (!fs.existsSync(this.storagePath)) {
        return [];
      }

      const data = await fs.promises.readFile(this.storagePath, 'utf8');
      const sessions = JSON.parse(data);

      // 解密敏感信息
      return sessions.map((session: SessionInfo) => ({
        ...session,
        password: session.password ? this.decrypt(session.password) : undefined,
        privateKey: session.privateKey ? this.decrypt(session.privateKey) : undefined
      }));
    } catch (error) {
      console.error('读取会话数据失败:', error);
      throw error;
    }
  }

  // 保存分组数据
  async saveGroups(groups: GroupInfo[]): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.groupsPath,
        JSON.stringify(groups, null, 2)
      );
    } catch (error) {
      console.error('保存分组数据失败:', error);
      throw error;
    }
  }

  // 读取分组数据
  async loadGroups(): Promise<GroupInfo[]> {
    try {
      if (!fs.existsSync(this.groupsPath)) {
        return [];
      }

      const data = await fs.promises.readFile(this.groupsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('读取分组数据失败:', error);
      throw error;
    }
  }

  // 导出配置时包含分组信息
  async exportConfig(filePath: string): Promise<void> {
    try {
      const sessions = await this.loadSessions();
      const groups = await this.loadGroups();
      await fs.promises.writeFile(
        filePath,
        JSON.stringify({ sessions, groups }, null, 2)
      );
    } catch (error) {
      console.error('导出配置失败:', error);
      throw error;
    }
  }

  // 导入配置时包含分组信息
  async importConfig(filePath: string): Promise<void> {
    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      const config = JSON.parse(data);
      
      if (Array.isArray(config)) {
        // 兼容旧版本的配置文件（只有会话数据）
        await this.saveSessions(config as SessionInfo[]);
      } else {
        // 新版本的配置文件（包含会话和分组数据）
        await this.saveSessions(config.sessions || []);
        await this.saveGroups(config.groups || []);
      }
    } catch (error) {
      console.error('导入配置失败:', error);
      throw error;
    }
  }

  // 备份配置时包含分组信息
  async backup(): Promise<void> {
    try {
      const backupDir = path.join(app.getPath('userData'), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `config-${timestamp}.json`);
      
      const sessions = await this.loadSessions();
      const groups = await this.loadGroups();
      await fs.promises.writeFile(
        backupPath,
        JSON.stringify({ sessions, groups }, null, 2)
      );
    } catch (error) {
      console.error('备份配置失败:', error);
      throw error;
    }
  }

  // 加载UI设置
  async loadUISettings(): Promise<UISettings> {
    try {
      if (!fs.existsSync(this.uiSettingsPath)) {
        // 默认设置
        return {
          isFileBrowserVisible: true,
          isAIVisible: false,
          fileOpenSettings: {
            defaultEditor: 'built-in',
            fileTypeAssociations: {}
          },
          externalEditorSettings: {
            editors: [],
            openMode: 'ask',
            autoUpload: true,
            uploadDelay: 2000,
            tempDirectory: require('path').join(require('os').tmpdir(), 'electerm-editor'),
            fileAssociations: {},
            rememberChoices: true,
            defaultOpenMode: 'builtin',
            fileOpenPreferences: {}
          },
          baseConfig: {
            terminalShortcuts: {
              acceptCompletion: 'Ctrl+Tab',
              acceptCompletionAlt: 'Alt+/',
              clearCompletion: 'Escape',
              navigateUp: 'Alt+ArrowUp',
              navigateDown: 'Alt+ArrowDown',
              copy: 'Ctrl+Shift+C',
              paste: 'Ctrl+Shift+V',
              clear: 'Ctrl+Shift+L',
              search: 'Ctrl+Shift+F'
            }
          }
        };
      }
      const data = await fs.promises.readFile(this.uiSettingsPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('加载UI设置失败:', error);
      // 发生错误时返回默认设置
      return {
        isFileBrowserVisible: true,
        isAIVisible: false,
        fileOpenSettings: {
          defaultEditor: 'built-in',
          fileTypeAssociations: {}
        },
        externalEditorSettings: {
          editors: [],
          openMode: 'ask',
          autoUpload: true,
          uploadDelay: 2000,
          tempDirectory: require('path').join(require('os').tmpdir(), 'electerm-editor'),
          fileAssociations: {},
          rememberChoices: true,
          defaultOpenMode: 'builtin',
          fileOpenPreferences: {}
        },
        baseConfig: {
          terminalShortcuts: {
            acceptCompletion: 'Ctrl+Tab',
            acceptCompletionAlt: 'Alt+/',
            clearCompletion: 'Escape',
            navigateUp: 'Alt+ArrowUp',
            navigateDown: 'Alt+ArrowDown',
            copy: 'Ctrl+Shift+C',
            paste: 'Ctrl+Shift+V',
            clear: 'Ctrl+Shift+L',
            search: 'Ctrl+Shift+F'
          }
        }
      };
    }
  }

  // 保存UI设置
  async saveUISettings(settings: UISettings): Promise<void> {
    try {
      await fs.promises.writeFile(
        this.uiSettingsPath,
        JSON.stringify(settings, null, 2)
      );
    } catch (error) {
      console.error('保存UI设置失败:', error);
      throw error;
    }
  }

  // 获取文件的默认打开方式
  async getDefaultEditor(filePath: string): Promise<'built-in'> {
    try {
      const settings = await this.loadUISettings();
      const extension = path.extname(filePath).toLowerCase();
      
      // 检查是否有针对该文件类型的特定设置
      if (extension && settings.fileOpenSettings.fileTypeAssociations[extension]) {
        return settings.fileOpenSettings.fileTypeAssociations[extension].editor;
      }
      
      // 返回全局默认设置
      return settings.fileOpenSettings.defaultEditor;
    } catch (error) {
      console.error('获取默认打开方式失败:', error);
      return 'built-in'; // 出错时返回默认值
    }
  }

  // 设置文件类型的默认打开方式
  async setDefaultEditor(extension: string, editor: 'built-in'): Promise<void> {
    try {
      const settings = await this.loadUISettings();
      
      if (!settings.fileOpenSettings) {
        settings.fileOpenSettings = {
          defaultEditor: 'built-in',
          fileTypeAssociations: {}
        };
      }

      if (extension === '*') {
        // 设置全局默认
        settings.fileOpenSettings.defaultEditor = editor;
      } else {
        // 设置特定文件类型
        const normalizedExtension = extension.toLowerCase();
        settings.fileOpenSettings.fileTypeAssociations[normalizedExtension] = {
          editor
        };
      }

      await this.saveUISettings(settings);
    } catch (error) {
      console.error('设置默认打开方式失败:', error);
      throw error;
    }
  }
}

export const storageService = new StorageService(); 