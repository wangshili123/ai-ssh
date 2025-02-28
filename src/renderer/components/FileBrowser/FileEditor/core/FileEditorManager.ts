/**
 * 文件编辑器管理器
 * 负责协调文件编辑器的各个组件，是整个编辑器的核心
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import { promisify } from 'util';
import * as fs from 'fs';
import { 
  EditorEvents, 
  EditorErrorType, 
  EditorMode,
  EditorConfig,
  EditorPosition,
  EditorSelection,
  FilterConfig,
  SearchConfig,
  SearchResult,
  ModeSwitchOptions,
  ModeSwitchResult
} from '../types/FileEditorTypes';
import { ErrorManager } from './ErrorManager';
import { ModeManager } from './ModeManager';
import { BrowseMode } from './BrowseMode';
import { EditMode } from './EditMode';
import { EditorContentManager } from './EditorContentManager';

const statAsync = promisify(fs.stat);

/**
 * 文件编辑器管理器
 * 整个文件编辑器的核心，负责协调各个组件的工作
 */
export class FileEditorManager extends EventEmitter {
  private filePath: string;
  private sessionId: string;
  private errorManager: ErrorManager;
  private modeManager: ModeManager;
  private config: EditorConfig;
  private isDisposed: boolean = false;
  private _isAutoScrollEnabled: boolean = false;
  private contentManager: EditorContentManager | null = null;

  /**
   * 构造函数
   * @param filePath 文件路径
   * @param sessionId 会话ID
   * @param config 编辑器配置
   */
  constructor(filePath: string, sessionId: string, config: EditorConfig = {}) {
    super();
    this.filePath = filePath;
    this.sessionId = sessionId;
    this.config = this.mergeWithDefaultConfig(config);
    
    // 创建错误管理器
    this.errorManager = new ErrorManager();
    
    // 创建模式管理器
    this.modeManager = new ModeManager(filePath, sessionId, this.errorManager);
    
    // 转发模式管理器的事件
    this.forwardEvents(this.modeManager);
    
    // 监听错误事件
    this.errorManager.on(EditorEvents.ERROR_OCCURRED, (error) => {
      this.emit(EditorEvents.ERROR_OCCURRED, error);
    });
  }

  /**
   * 合并默认配置
   * @param config 用户配置
   * @returns 合并后的配置
   */
  private mergeWithDefaultConfig(config: EditorConfig): EditorConfig {
    const defaultConfig: EditorConfig = {
      theme: 'vs',
      fontSize: 14,
      lineHeight: 1.5,
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'off',
      autoIndent: true,
      formatOnType: false,
      formatOnPaste: false,
      autoSave: false,
      autoSaveInterval: 30000,
      largeFileSize: 10 * 1024 * 1024,
      maxFileSize: 50 * 1024 * 1024
    };
    
    return { ...defaultConfig, ...config };
  }

  /**
   * 转发事件
   * @param emitter 事件发射器
   */
  private forwardEvents(emitter: EventEmitter): void {
    // 获取所有 EditorEvents 枚举值
    const events = Object.values(EditorEvents);
    
    // 为每个事件添加监听器
    for (const event of events) {
      emitter.on(event, (...args) => {
        this.emit(event, ...args);
      });
    }
  }

  /**
   * 加载文件
   * 根据文件大小自动选择合适的模式
   */
  public async loadFile(): Promise<boolean> {
    try {
      // 获取文件信息
      const stats = await statAsync(this.filePath);
      const fileSize = stats.size;
      
      // 根据文件大小选择模式
      if (fileSize > this.config.largeFileSize!) {
        // 大文件使用浏览模式
        return this.getBrowseMode().getTotalLines().then(() => true);
      } else {
        // 小文件使用编辑模式
        return this.switchToMode(EditorMode.EDIT).then(result => result.success);
      }
    } catch (error: any) {
      this.errorManager.handleError(
        EditorErrorType.FILE_NOT_FOUND,
        `加载文件失败: ${error.message}`
      );
      return false;
    }
  }

  /**
   * 切换模式
   * @param mode 目标模式
   * @param options 切换选项
   * @returns 切换结果
   */
  public async switchToMode(mode: EditorMode, options: ModeSwitchOptions = {}): Promise<ModeSwitchResult> {
    if (mode === EditorMode.BROWSE) {
      return this.modeManager.switchToBrowseMode(options);
    } else {
      return this.modeManager.switchToEditMode(options);
    }
  }

  /**
   * 获取当前模式
   * @returns 当前模式
   */
  public getCurrentMode(): EditorMode {
    return this.modeManager.getCurrentMode();
  }

  /**
   * 获取浏览模式实例
   * @returns 浏览模式实例
   */
  public getBrowseMode(): BrowseMode {
    return this.modeManager.getBrowseMode();
  }

  /**
   * 获取编辑模式实例
   * @returns 编辑模式实例
   */
  public getEditMode(): EditMode {
    return this.modeManager.getEditMode();
  }

  /**
   * 保存文件
   * 如果当前是编辑模式，则保存文件
   * @returns 保存结果
   */
  public async saveFile(): Promise<boolean> {
    if (this.getCurrentMode() === EditorMode.EDIT) {
      return this.getEditMode().saveFile();
    } else {
      // 浏览模式下不支持保存
      return true;
    }
  }

  /**
   * 应用过滤条件
   * 在浏览模式下过滤文件内容
   * @param config 过滤配置
   * @returns 过滤结果
   */
  public async applyFilter(config: FilterConfig): Promise<string[]> {
    if (this.getCurrentMode() === EditorMode.BROWSE) {
      return this.getBrowseMode().applyFilter(config);
    } else {
      // 编辑模式下不支持过滤
      return [];
    }
  }

  /**
   * 搜索文件内容
   * @param config 搜索配置
   * @returns 搜索结果
   */
  public async search(config: SearchConfig): Promise<SearchResult[]> {
    if (this.getCurrentMode() === EditorMode.BROWSE) {
      return this.getBrowseMode().search(config);
    } else {
      // 编辑模式下暂不支持搜索
      return [];
    }
  }

  /**
   * 启动实时监控
   * 在浏览模式下监控文件变化
   */
  public startRealtime(): void {
    if (this.getCurrentMode() === EditorMode.BROWSE) {
      this.getBrowseMode().startRealtime();
    }
  }

  /**
   * 停止实时监控
   */
  public stopRealtime(): void {
    if (this.getCurrentMode() === EditorMode.BROWSE) {
      this.getBrowseMode().stopRealtime();
    }
  }

  /**
   * 更新文件内容
   * 在编辑模式下更新文件内容
   * @param content 新的文件内容
   */
  public updateContent(content: string): void {
    if (this.getCurrentMode() === EditorMode.EDIT) {
      this.getEditMode().updateContent(content);
    }
  }

  /**
   * 更新光标位置
   * @param position 新的光标位置
   */
  public updateCursorPosition(position: EditorPosition): void {
    if (this.getCurrentMode() === EditorMode.EDIT) {
      this.getEditMode().updateCursorPosition(position);
    }
  }

  /**
   * 更新选择区域
   * @param selection 新的选择区域
   */
  public updateSelection(selection: EditorSelection | null): void {
    if (this.getCurrentMode() === EditorMode.EDIT) {
      this.getEditMode().updateSelection(selection);
    }
  }

  /**
   * 撤销操作
   * 在编辑模式下撤销操作
   */
  public undo(): void {
    if (this.getCurrentMode() === EditorMode.EDIT) {
      this.getEditMode().undo();
    }
  }

  /**
   * 重做操作
   * 在编辑模式下重做操作
   */
  public redo(): void {
    if (this.getCurrentMode() === EditorMode.EDIT) {
      this.getEditMode().redo();
    }
  }

  /**
   * 设置编码
   * @param encoding 编码类型
   */
  public setEncoding(encoding: BufferEncoding): void {
    this.getBrowseMode().setEncoding(encoding);
    this.getEditMode().setEncoding(encoding);
  }

  /**
   * 启用自动保存
   * @param interval 自动保存间隔（毫秒）
   */
  public enableAutoSave(interval?: number): void {
    this.getEditMode().enableAutoSave(interval);
  }

  /**
   * 禁用自动保存
   */
  public disableAutoSave(): void {
    this.getEditMode().disableAutoSave();
  }

  /**
   * 获取文件路径
   * @returns 文件路径
   */
  public getFilePath(): string {
    return this.filePath;
  }

  /**
   * 获取文件名
   * @returns 文件名
   */
  public getFileName(): string {
    return path.basename(this.filePath);
  }

  /**
   * 获取会话ID
   * @returns 会话ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * 获取配置
   * @returns 编辑器配置
   */
  public getConfig(): EditorConfig {
    return this.config;
  }

  /**
   * 更新配置
   * @param config 新的配置
   */
  public updateConfig(config: Partial<EditorConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit(EditorEvents.CONTENT_CHANGED, { config: this.config });
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.isDisposed) {
      return;
    }
    
    this.isDisposed = true;
    this.modeManager.dispose();
    this.removeAllListeners();
  }

  /**
   * 设置是否自动滚动
   * 在实时模式下，控制是否自动滚动到最新内容
   * @param enabled 是否启用自动滚动
   */
  public setAutoScroll(enabled: boolean): void {
    if (this.getCurrentMode() === EditorMode.BROWSE) {
      // 在浏览模式下，将自动滚动配置传递给浏览模式管理器
      const browseMode = this.getBrowseMode();
      if (browseMode) {
        // 如果BrowseMode中有setAutoScroll方法，可直接调用
        // 如果没有，可以考虑在BrowseMode中实现该方法
        if (typeof browseMode.setAutoScroll === 'function') {
          browseMode.setAutoScroll(enabled);
        } else {
          // 如果BrowseMode没有直接支持，可以通过事件通知或其他方式实现
          this.emit(EditorEvents.AUTO_SCROLL_CHANGED, enabled);
        }
      }
    }
    
    // 保存状态，无论当前模式是什么
    this._isAutoScrollEnabled = enabled;
    
    // 触发事件通知
    this.emit(EditorEvents.AUTO_SCROLL_CHANGED, enabled);
  }

  /**
   * 获取是否启用自动滚动
   * @returns 是否启用自动滚动
   */
  public isAutoScrollEnabled(): boolean {
    return this._isAutoScrollEnabled;
  }

  /**
   * 初始化文件编辑器
   * @param filePath 文件路径
   * @param sessionId 会话ID
   */
  public initialize(filePath: string, sessionId: string): Promise<void> {
    this.filePath = filePath;
    this.sessionId = sessionId;
    
    // 初始化逻辑
    return Promise.resolve();
  }

  /**
   * 切换编辑模式
   * @param mode 目标模式
   * @param options 切换选项
   */
  public switchMode(mode: EditorMode, options?: any): Promise<boolean> {
    // 根据目标模式调用相应的切换方法
    return this.modeManager.switchToMode(mode);
  }

  /**
   * 获取当前内容
   * @returns 当前文件内容
   */
  public getContent(): string {
    // 根据当前模式获取内容
    if (this.getCurrentMode() === EditorMode.EDIT) {
      return this.getEditMode().getContent();
    } else {
      // BrowseMode可能需要实现类似方法
      return '';
    }
  }

  /**
   * 重新加载文件
   */
  public reload(): Promise<boolean> {
    // 重新加载文件内容
    return this.loadFile();
  }

  /**
   * 销毁编辑器实例
   */
  public destroy(): void {
    // 清理资源
    this.modeManager.dispose();
  }

  /**
   * 获取内容管理器
   * @returns 内容管理器实例
   */
  public getContentManager(): EditorContentManager | null {
    return this.contentManager;
  }
} 