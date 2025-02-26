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
  // 内容变化监听器
  private contentChangeDisposable: monaco.IDisposable | null = null;

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
      
      // 设置原始内容
      this.originalContent = result.content;
      this.isDirty = false; // 重置脏状态
      
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
    // 清理之前的事件监听
    this.clearModelListeners();

    // 保存旧模型的内容用于比较
    const oldModel = this.model;
    const oldContent = oldModel ? oldModel.getValue() : '';

    this.model = model;
    
    // 获取新模型的内容
    const newContent = model ? model.getValue() : '';
    
    // 日志输出模型变化
    console.log('[EditorContentManager] 模型替换:', { 
      oldModelExists: !!oldModel,
      newModelExists: !!model,
      oldContentLength: oldContent.length,
      newContentLength: newContent.length,
      originalContentLength: this.originalContent.length
    });
    
    // 确保原始内容已设置
    if (this.originalContent.length === 0 && newContent.length > 0) {
      console.log('[EditorContentManager] 原始内容为空，使用新模型内容作为原始内容');
      this.originalContent = newContent;
    }
    
    // 立即检查当前脏状态
    const isDirty = newContent !== this.originalContent;
    if (isDirty !== this.isDirty) {
      console.log('[EditorContentManager] 初始脏状态检测:', { 
        isDirty, 
        previousIsDirty: this.isDirty 
      });
      this.isDirty = isDirty;
      this.emit(EditorEvents.CONTENT_CHANGED, { isModified: isDirty });
    }
    
    // 为新模型添加变更监听
    if (this.model) {
      console.log('[EditorContentManager] 添加模型内容变化监听器');
      
      // 保存监听器的disposable对象，以便后续清理
      this.contentChangeDisposable = this.model.onDidChangeContent(() => {
        if (!this.model) return;
        
        const currentContent = this.model.getValue();
        const originalContent = this.originalContent;
        
        // 比较当前内容和原始内容
        const isDirty = currentContent !== originalContent;
        
        console.log('[EditorContentManager] 内容变化检测:', { 
          contentLength: currentContent.length,
          originalLength: originalContent.length,
          isDirty,
          previousIsDirty: this.isDirty,
          // 输出内容的前20个字符以便调试
          contentStart: currentContent.substring(0, 20),
          originalStart: originalContent.substring(0, 20),
          // 仅当实际不同时才进行比较
          different: isDirty 
            ? `不同位置示例: ${this.findFirstDifference(currentContent, originalContent)}` 
            : '内容相同'
        });
        
        // 只有状态变化时才发送事件
        if (isDirty !== this.isDirty) {
          console.log('[EditorContentManager] 内容脏状态变化为:', isDirty);
          this.isDirty = isDirty;
          this.emit(EditorEvents.CONTENT_CHANGED, { isModified: isDirty });
        }
      });
    }
  }

  /**
   * 清理模型事件监听器
   */
  private clearModelListeners(): void {
    if (this.contentChangeDisposable) {
      this.contentChangeDisposable.dispose();
      this.contentChangeDisposable = null;
    }
  }

  /**
   * 查找两个字符串的第一个不同之处
   * @param str1 第一个字符串
   * @param str2 第二个字符串
   * @returns 不同之处的描述
   */
  private findFirstDifference(str1: string, str2: string): string {
    const minLength = Math.min(str1.length, str2.length);
    for (let i = 0; i < minLength; i++) {
      if (str1[i] !== str2[i]) {
        const context = 10; // 显示差异前后的上下文
        const start = Math.max(0, i - context);
        const end = Math.min(i + context, minLength);
        return `位置 ${i}: [${str1.substring(start, end)}] vs [${str2.substring(start, end)}]`;
      }
    }
    
    // 如果所有共同的字符都相同，那么一个字符串是另一个的前缀
    if (str1.length !== str2.length) {
      return `长度不同: ${str1.length} vs ${str2.length}`;
    }
    
    return '未找到差异';
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
    // 清理模型监听器
    this.clearModelListeners();
    
    // 移除所有事件监听
    this.removeAllListeners();
    
    // 不需要清理模型，因为模型的所有权属于EditorManager
    this.model = null;
    this.editor = null;
  }
} 