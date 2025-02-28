/**
 * 编辑模式核心实现
 * 负责文件的完整加载、编辑和保存功能
 */

import { EventEmitter } from 'events';
import { readFile, writeFile } from 'fs';
import { promisify } from 'util';
import * as path from 'path';
import { 
  EditorEvents, 
  EditorErrorType, 
  EditorPosition,
  EditorSelection,
  EditModeState
} from '../types/FileEditorTypes';
import { ErrorManager } from './ErrorManager';
import { EditModeOperations } from './EditModeOperations';
import { EditModeAutoSave } from './EditModeAutoSave';
import { EditModeContent } from './EditModeContent';
import { EditModeUtils } from './EditModeUtils';

const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);

// 默认配置
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * 编辑模式管理器
 * 负责文件的完整加载、编辑和保存功能
 */
export class EditMode extends EventEmitter {
  private filePath: string;
  private sessionId: string;
  private state: EditModeState;
  private errorManager: ErrorManager;
  private encoding: BufferEncoding;
  private fileSize: number = 0;
  
  // 内容管理
  public contentManager: EditModeContent;
  
  // 编辑操作
  private operationsManager: EditModeOperations;
  
  // 自动保存
  private autoSaveManager: EditModeAutoSave;
  
  // 工具和查询
  private utils: EditModeUtils;

  /**
   * 构造函数
   * @param filePath 文件路径
   * @param sessionId 会话ID
   * @param errorManager 错误管理器
   */
  constructor(filePath: string, sessionId: string, errorManager: ErrorManager) {
    super();
    this.filePath = filePath;
    this.sessionId = sessionId;
    this.errorManager = errorManager;
    this.encoding = 'utf8';
    
    // 初始化状态
    this.state = {
      isLoaded: false,
      isSaving: false,
      selection: null,
      cursorPosition: { line: 0, column: 0 },
      undoStack: [],
      redoStack: []
    };
    
    // 初始化各个管理器
    this.contentManager = new EditModeContent(this);
    this.operationsManager = new EditModeOperations(this);
    this.autoSaveManager = new EditModeAutoSave(this);
    this.utils = new EditModeUtils(this);
  }

  /**
   * 加载文件内容
   * 读取整个文件到内存中
   */
  public async loadFile(): Promise<boolean> {
    if (this.state.isLoaded) {
      return true;
    }
    
    this.emit(EditorEvents.LOADING_STARTED);
    
    try {
      // 获取文件信息
      const stats = await promisify(require('fs').stat)(this.filePath);
      this.fileSize = stats.size;
      
      // 检查文件大小
      if (this.fileSize > MAX_FILE_SIZE) {
        this.errorManager.handleError(
          EditorErrorType.FILE_TOO_LARGE,
          `文件过大（${(this.fileSize / 1024 / 1024).toFixed(2)}MB），超过最大限制（${MAX_FILE_SIZE / 1024 / 1024}MB）`
        );
        this.emit(EditorEvents.LOADING_END);
        return false;
      }
      
      // 读取文件内容
      const content = await readFileAsync(this.filePath, this.encoding);
      
      // 更新内容
      this.contentManager.setContent(content, content);
      
      // 更新状态
      this.state.isLoaded = true;
      
      // 发出加载完成事件
      this.emit(EditorEvents.FILE_LOADED, {
        size: this.fileSize,
        path: this.filePath,
        content: this.contentManager.getContent()
      });
      
      this.emit(EditorEvents.LOADING_END);
      
      // 如果启用了自动保存，开始定时器
      if (this.autoSaveManager.isAutoSaveEnabled()) {
        this.autoSaveManager.startAutoSave();
      }
      
      return true;
    } catch (error: any) {
      this.emit(EditorEvents.LOADING_END);
      this.errorManager.handleError(
        EditorErrorType.FILE_NOT_FOUND,
        `加载文件失败: ${error.message}`
      );
      return false;
    }
  }

  /**
   * 保存文件
   * 将修改后的内容写入文件
   */
  public async saveFile(): Promise<boolean> {
    if (!this.state.isLoaded) {
      return false;
    }
    
    this.emit(EditorEvents.LOADING_STARTED);
    
    try {
      // 获取当前内容
      const content = this.contentManager.getContent();
      
      await writeFileAsync(this.filePath, content, this.encoding);
      
      // 更新内容状态
      this.contentManager.markAsSaved();
      
      // 更新状态
      this.state.isSaving = false;
      
      // 发出保存完成事件
      this.emit(EditorEvents.FILE_SAVED, {
        path: this.filePath,
        size: Buffer.byteLength(content, this.encoding)
      });
      
      this.emit(EditorEvents.LOADING_END);
      return true;
    } catch (error: any) {
      this.state.isSaving = false;
      this.emit(EditorEvents.LOADING_END);
      this.errorManager.handleError(
        EditorErrorType.PERMISSION_DENIED,
        `保存文件失败: ${error.message}`
      );
      return false;
    }
  }

  /**
   * 更新文件内容
   * @param content 新的文件内容
   */
  public updateContent(content: string): void {
    if (!this.state.isLoaded) {
      return;
    }
    
    this.operationsManager.updateContent(content);
  }

  /**
   * 撤销操作
   */
  public undo(): void {
    this.operationsManager.undo();
  }

  /**
   * 重做操作
   */
  public redo(): void {
    this.operationsManager.redo();
  }

  /**
   * 更新光标位置
   * @param position 新的光标位置
   */
  public updateCursorPosition(position: EditorPosition): void {
    this.operationsManager.updateCursorPosition(position);
  }

  /**
   * 更新选择区域
   * @param selection 新的选择区域
   */
  public updateSelection(selection: EditorSelection | null): void {
    this.operationsManager.updateSelection(selection);
  }

  /**
   * 获取当前内容
   * @returns 当前文件内容
   */
  public getContent(): string {
    return this.contentManager.getContent();
  }

  /**
   * 获取原始内容
   * @returns 原始文件内容
   */
  public getOriginalContent(): string {
    return this.contentManager.getOriginalContent();
  }

  /**
   * 获取当前状态
   * @returns 编辑模式状态
   */
  public getState(): EditModeState {
    return this.state;
  }

  /**
   * 检查文件是否已修改
   * @returns 是否已修改
   */
  public isFileModified(): boolean {
    return this.contentManager.isModified();
  }

  /**
   * 设置编码
   * @param encoding 编码类型
   */
  public setEncoding(encoding: BufferEncoding): void {
    this.encoding = encoding;
    
    // 如果文件已加载，需要重新加载
    if (this.state.isLoaded) {
      this.loadFile();
    }
  }

  /**
   * 启用自动保存
   * @param interval 自动保存间隔（毫秒）
   */
  public enableAutoSave(interval?: number): void {
    this.autoSaveManager.enableAutoSave(interval);
  }

  /**
   * 禁用自动保存
   */
  public disableAutoSave(): void {
    this.autoSaveManager.disableAutoSave();
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.autoSaveManager.stopAutoSave();
    this.removeAllListeners();
    
    // 如果文件已修改且未保存，尝试保存
    if (this.contentManager.isModified() && this.state.isLoaded) {
      this.saveFile();
    }
  }

  /**
   * 获取文件总行数
   * @returns 文件的总行数
   */
  public getTotalLines(): number {
    return this.utils.getTotalLines();
  }

  /**
   * 获取当前选中的文本
   * @returns 选中的文本，如果没有选择则返回undefined
   */
  public getSelectedText(): string | undefined {
    return this.utils.getSelectedText();
  }

  /**
   * 获取选择区域
   * @returns 选择的范围，如果没有选择则返回undefined
   */
  public getSelectionRange(): EditorSelection | undefined {
    return this.utils.getSelectionRange();
  }

  /**
   * 获取编辑器实例
   * 私有方法，用于getTotalLines和getSelectedText方法
   */
  public getEditor(): any {
    // 此方法需要根据实际编辑器实现来适配
    // 如果使用Monaco编辑器，可以返回Monaco实例
    // 这里仅作为示例
    return null;
  }

  /**
   * 获取Monaco编辑器实例
   * @returns Monaco编辑器实例
   */
  public getMonacoEditor(): any {
    return this.getEditor();
  }

  /**
   * 导航到下一个搜索结果
   * @param wrap 是否在结尾处循环到开头
   */
  public navigateToNextSearchResult(wrap: boolean = true): void {
    // 在实际实现中需要与编辑器集成
    console.log('导航到下一个搜索结果', wrap);
  }

  /**
   * 导航到上一个搜索结果
   * @param wrap 是否在开头处循环到结尾
   */
  public navigateToPreviousSearchResult(wrap: boolean = true): void {
    // 在实际实现中需要与编辑器集成
    console.log('导航到上一个搜索结果', wrap);
  }
} 