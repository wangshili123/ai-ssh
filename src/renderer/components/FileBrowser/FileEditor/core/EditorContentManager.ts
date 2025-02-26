/**
 * 编辑器内容管理器
 * 负责处理文件内容的加载、保存和编码管理
 */

import { EventEmitter } from 'events';
import * as monaco from 'monaco-editor';
import { EditorEvents } from '../types/FileEditorTypes';
import { sftpService } from '../../../../services/sftp';

/**
 * 编辑器内容管理器
 * 管理文件内容加载、保存、编码检测和语言管理
 */
export class EditorContentManager extends EventEmitter {
  // 会话标识
  private sessionId: string;
  // 文件路径
  private filePath: string;
  // 原始内容
  private originalContent: string = '';
  // 编辑器模型
  private model: monaco.editor.ITextModel | null = null;
  // 编辑器实例
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  // 当前编码
  private encoding: string = 'UTF-8';
  // 是否有未保存修改
  private isDirty: boolean = false;

  /**
   * 构造函数
   * @param sessionId SSH会话ID
   * @param filePath 文件路径
   * @param editor Monaco编辑器实例
   */
  constructor(
    sessionId: string, 
    filePath: string, 
    editor: monaco.editor.IStandaloneCodeEditor | null = null
  ) {
    super();
    this.sessionId = sessionId;
    this.filePath = filePath;
    this.editor = editor;
  }

  /**
   * 设置编辑器实例
   * @param editor Monaco编辑器实例
   */
  public setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
  }

  /**
   * 加载文件内容
   * @returns 文件内容
   */
  public async loadContent(): Promise<string> {
    try {
      console.log('[EditorContentManager] 正在加载文件:', this.filePath);
      const result = await sftpService.readFile(this.sessionId, this.filePath);
      console.log('[EditorContentManager] 文件加载成功，内容长度:', result.content.length);
      this.originalContent = result.content;
      this.emit(EditorEvents.FILE_LOADED, {
        path: this.filePath,
        size: result.content.length,
        modifyTime: Date.now()
      });
      return result.content;
    } catch (error) {
      console.error('[EditorContentManager] 加载文件失败:', error);
      this.emit(EditorEvents.ERROR_OCCURRED, new Error(`加载文件失败: ${error}`));
      throw new Error(`加载文件失败: ${error}`);
    }
  }

  /**
   * 保存文件内容
   * @returns 是否保存成功
   */
  public async saveContent(): Promise<boolean> {
    if (!this.model) {
      console.warn('[EditorContentManager] 保存失败：没有活动的编辑器模型');
      return false;
    }

    try {
      const content = this.model.getValue();
      console.log('[EditorContentManager] 开始保存文件:', this.filePath);
      await sftpService.writeFile(this.sessionId, this.filePath, content);
      console.log('[EditorContentManager] 文件保存成功');
      
      this.originalContent = content;
      this.isDirty = false;
      this.emit(EditorEvents.FILE_SAVED, { path: this.filePath });
      return true;
    } catch (error) {
      console.error('[EditorContentManager] 保存文件失败:', error);
      this.emit(EditorEvents.ERROR_OCCURRED, new Error(`保存文件失败: ${error}`));
      throw new Error(`保存文件失败: ${error}`);
    }
  }

  /**
   * 设置编辑器模型
   * @param model 编辑器模型
   */
  public setModel(model: monaco.editor.ITextModel): void {
    // 取消之前模型的事件监听
    if (this.model) {
      // 这里没有直接的方法移除特定事件，所以我们重新设置模型时不需要特别处理
    }

    this.model = model;
    
    // 为新模型添加变更监听
    if (this.model) {
      this.model.onDidChangeContent(() => {
        const currentContent = this.model?.getValue() || '';
        const isDirty = currentContent !== this.originalContent;
        
        if (isDirty !== this.isDirty) {
          this.isDirty = isDirty;
          this.emit(EditorEvents.CONTENT_CHANGED, { isModified: isDirty });
        }
      });
    }
  }

  /**
   * 获取文件的语言类型
   * @param filePath 文件路径
   * @returns 语言ID
   */
  public getLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'md': 'markdown',
      'html': 'html',
      'css': 'css',
      'less': 'less',
      'scss': 'scss',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'sh': 'shell',
      'bash': 'shell',
      'py': 'python',
      'java': 'java',
      'c': 'cpp',
      'cpp': 'cpp',
      'h': 'cpp',
      'txt': 'plaintext'
    };
    return languageMap[ext] || 'plaintext';
  }

  /**
   * 设置文件编码
   * @param encoding 编码名称
   */
  public setEncoding(encoding: string): void {
    this.encoding = encoding;
    this.emit(EditorEvents.ENCODING_CHANGED, encoding);
  }
  
  /**
   * 获取当前编码
   * @returns 当前编码
   */
  public getEncoding(): string {
    return this.encoding;
  }

  /**
   * 更改文件路径
   * @param filePath 新的文件路径
   */
  public setFilePath(filePath: string): void {
    this.filePath = filePath;
  }

  /**
   * 更改会话ID
   * @param sessionId 新的会话ID
   */
  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }
  
  /**
   * 获取文件路径
   * @returns 当前文件路径
   */
  public getFilePath(): string {
    return this.filePath;
  }
  
  /**
   * 获取会话ID
   * @returns 当前会话ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }
  
  /**
   * 获取是否有未保存修改
   * @returns 是否有未保存修改
   */
  public getIsDirty(): boolean {
    return this.isDirty;
  }
  
  /**
   * 获取原始内容
   * @returns 原始文件内容
   */
  public getOriginalContent(): string {
    return this.originalContent;
  }
  
  /**
   * 获取当前内容
   * @returns 当前文件内容
   */
  public getCurrentContent(): string {
    return this.model?.getValue() || this.originalContent;
  }
  
  /**
   * 销毁管理器
   * 清理资源和事件监听
   */
  public dispose(): void {
    // 移除所有事件监听
    this.removeAllListeners();
    
    // 不需要清理模型，因为模型的所有权属于EditorManager
    this.model = null;
    this.editor = null;
  }
} 