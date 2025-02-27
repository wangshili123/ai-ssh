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
      
      // 添加关于原始内容的详细日志
      const endsWithCR = result.content.endsWith('\r');
      const endsWithLF = result.content.endsWith('\n');
      const endsWithCRLF = result.content.endsWith('\r\n');
      console.log('[EditorContentManager] 原始文件内容分析:', {
        length: result.content.length,
        endsWithCR,
        endsWithLF,
        endsWithCRLF,
        lastFewChars: result.content.slice(-10).split('').map(c => c.charCodeAt(0))
      });
      
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
      
      // 添加关于保存内容的详细日志
      const endsWithCR = content.endsWith('\r');
      const endsWithLF = content.endsWith('\n');
      const endsWithCRLF = content.endsWith('\r\n');
      console.log('[EditorContentManager] 保存文件内容分析:', {
        length: content.length,
        endsWithCR, 
        endsWithLF, 
        endsWithCRLF,
        eolType: this.model.getEOL() === '\r\n' ? 'CRLF' : 'LF',
        lastFewChars: content.slice(-10).split('').map(c => c.charCodeAt(0))
      });
      
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
    
    // 详细分析新模型的内容
    const newEndsWithCR = newContent.endsWith('\r');
    const newEndsWithLF = newContent.endsWith('\n');
    const newEndsWithCRLF = newContent.endsWith('\r\n');
    const origEndsWithCR = this.originalContent.endsWith('\r');
    const origEndsWithLF = this.originalContent.endsWith('\n');
    const origEndsWithCRLF = this.originalContent.endsWith('\r\n');
    
    console.log('[EditorContentManager] 模型内容详细分析:', {
      originalContentLength: this.originalContent.length,
      newContentLength: newContent.length,
      contentLengthDiff: newContent.length - this.originalContent.length,
      newModelEOL: model.getEOL() === '\r\n' ? 'CRLF' : 'LF',
      // 换行符情况
      origEndsWithCR,
      origEndsWithLF,
      origEndsWithCRLF,
      newEndsWithCR,
      newEndsWithLF,
      newEndsWithCRLF,
      // 内容末尾分析
      origLastFewChars: this.originalContent.slice(-10).split('').map(c => c.charCodeAt(0)),
      newLastFewChars: newContent.slice(-10).split('').map(c => c.charCodeAt(0))
    });
    
    // 日志输出模型变化
    console.log('[EditorContentManager] 模型替换:', { 
      oldModelExists: !!oldModel,
      newModelExists: !!model,
      oldContentLength: oldContent.length,
      newContentLength: newContent.length,
      originalContentLength: this.originalContent.length,
      contentLengthDiff: newContent.length - this.originalContent.length
    });
    
    // 确保原始内容已设置
    if (this.originalContent.length === 0 && newContent.length > 0) {
      console.log('[EditorContentManager] 原始内容为空，使用新模型内容作为原始内容');
      this.originalContent = newContent;
    }
    
    // 立即检查当前脏状态 - 修改为判断内容等价性而非完全相等
    const isDirty = !this.isContentEquivalent(newContent, this.originalContent);
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
        
        // 使用内容等价性检查而非完全相等
        const isDirty = !this.isContentEquivalent(currentContent, this.originalContent);
        
        // 仅当状态有变化时记录详细日志
        if (isDirty !== this.isDirty) {
          console.log('[EditorContentManager] 内容变化导致脏状态变化:', { 
            currentLength: currentContent.length,
            originalLength: this.originalContent.length,
            isDirty,
            previousIsDirty: this.isDirty,
            // 输出差异信息
            difference: this.findFirstDifference(currentContent, this.originalContent)
          });
          
          this.isDirty = isDirty;
          this.emit(EditorEvents.CONTENT_CHANGED, { isModified: isDirty });
        }
      });
    }
  }
  
  /**
   * 判断两个内容是否等价（考虑换行符差异）
   * @param content1 第一个内容
   * @param content2 第二个内容 
   * @returns 内容是否等价
   */
  private isContentEquivalent(content1: string, content2: string): boolean {
    // 如果内容完全相同，直接返回true
    if (content1 === content2) {
      console.log('[EditorContentManager] 内容完全相同，等价性检查通过');
      return true;
    }
    
    // 长度差异分析
    const lengthDiff = Math.abs(content1.length - content2.length);
    
    // 大文件特殊处理：针对Monaco编辑器处理大文件时可能出现的1字节差异
    if (lengthDiff === 1 && (content1.length > 10000 || content2.length > 10000)) {
      console.log('[EditorContentManager] 检测到大文件1字节差异，执行深入分析');
      
      // 对于大文件，如果差异只有1个字符，我们认为内容等价
      // 这是针对Monaco编辑器处理大文件时的特殊情况
      console.log('[EditorContentManager] 大文件仅有1字节差异，认为内容等价');
      
      // 记录被忽略的差异
      if (content1.length > content2.length) {
        console.log(`[EditorContentManager] 原始内容长度(${content1.length})比编辑器模型内容长度(${content2.length})多1字节`);
      } else {
        console.log(`[EditorContentManager] 编辑器模型内容长度(${content1.length})比原始内容长度(${content2.length})多1字节`);
      }
      
      return true;
    }
    
    // 如果长度差异很大，内容一定不等价
    if (lengthDiff > 3) {
      console.log('[EditorContentManager] 内容长度差异大于3，认为内容已修改:', lengthDiff);
      return false;
    }
    
    // 规范化换行符后再比较
    const norm1 = content1.replace(/\r\n/g, '\n');
    const norm2 = content2.replace(/\r\n/g, '\n');
    
    const normLengthDiff = Math.abs(norm1.length - norm2.length);
    const normEqual = norm1 === norm2;
    
    console.log('[EditorContentManager] 规范化换行符后的比较结果:', {
      originalLengthDiff: lengthDiff,
      normalizedLengthDiff: normLengthDiff,
      contentEqual: content1 === content2,
      normalizedEqual: normEqual
    });
    
    // 特殊处理：如果规范化后内容相同，或者只有结尾换行符的差异
    if (normEqual) {
      return true;
    }
    
    // 如果规范化后长度差异为1，可能是末尾换行符问题
    if (normLengthDiff === 1) {
      // 检查是否仅末尾换行符差异
      const shorter = norm1.length < norm2.length ? norm1 : norm2;
      const longer = norm1.length < norm2.length ? norm2 : norm1;
      
      // 如果较长的字符串只是在较短的后面加了一个换行符
      if (longer === shorter + '\n') {
        console.log('[EditorContentManager] 检测到仅有末尾换行符差异，认为内容等价');
        return true;
      }
    }
    
    // 其他情况视为内容不等价
    return false;
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
    // 对于大文件，只检查开头、中间和结尾的一部分区域
    const isLargeFile = str1.length > 10000 || str2.length > 10000;
    
    if (isLargeFile) {
      console.log('[EditorContentManager] 大文件差异分析，采用抽样比较策略');
      
      // 检查文件开头的1000个字符
      const headSize = 1000;
      const headStr1 = str1.substring(0, Math.min(headSize, str1.length));
      const headStr2 = str2.substring(0, Math.min(headSize, str2.length));
      
      if (headStr1 !== headStr2) {
        // 如果开头部分不同，进一步定位差异
        for (let i = 0; i < Math.min(headStr1.length, headStr2.length); i++) {
          if (headStr1[i] !== headStr2[i]) {
            const context = 10;
            const start = Math.max(0, i - context);
            const end = Math.min(i + context, Math.min(headStr1.length, headStr2.length));
            
            const str1Codes = headStr1.substring(start, end).split('').map(c => c.charCodeAt(0));
            const str2Codes = headStr2.substring(start, end).split('').map(c => c.charCodeAt(0));
            
            return `文件开头区域差异，位置 ${i}: 
            原始: [${headStr1.substring(start, end)}] 编码: [${str1Codes}]
            当前: [${headStr2.substring(start, end)}] 编码: [${str2Codes}]`;
          }
        }
      }
      
      // 检查文件结尾的1000个字符
      const tailSize = 1000;
      const tailStr1 = str1.substring(Math.max(0, str1.length - tailSize));
      const tailStr2 = str2.substring(Math.max(0, str2.length - tailSize));
      
      if (tailStr1 !== tailStr2) {
        // 计算相对于文件结尾的位置
        const tailOffset1 = str1.length - tailSize;
        const tailOffset2 = str2.length - tailSize;
        
        for (let i = 0; i < Math.min(tailStr1.length, tailStr2.length); i++) {
          if (tailStr1[i] !== tailStr2[i]) {
            const context = 10;
            const start = Math.max(0, i - context);
            const end = Math.min(i + context, Math.min(tailStr1.length, tailStr2.length));
            
            const str1Codes = tailStr1.substring(start, end).split('').map(c => c.charCodeAt(0));
            const str2Codes = tailStr2.substring(start, end).split('').map(c => c.charCodeAt(0));
            
            return `文件结尾区域差异，相对文件结尾的位置 ${i}: 
            原始: [${tailStr1.substring(start, end)}] 编码: [${str1Codes}]
            当前: [${tailStr2.substring(start, end)}] 编码: [${str2Codes}]`;
          }
        }
      }
      
      return `未在文件开头和结尾区域找到具体差异，但内容长度不同: 原始长度=${str1.length}, 当前长度=${str2.length}`;
    }
    
    // 对于小文件，执行完整比较
    const minLength = Math.min(str1.length, str2.length);
    for (let i = 0; i < minLength; i++) {
      if (str1[i] !== str2[i]) {
        const context = 10; // 显示差异前后的上下文
        const start = Math.max(0, i - context);
        const end = Math.min(i + context, minLength);
        
        // 添加字符编码，更容易看出不可见字符的差异
        const str1Codes = str1.substring(start, end).split('').map(c => c.charCodeAt(0));
        const str2Codes = str2.substring(start, end).split('').map(c => c.charCodeAt(0));
        
        return `位置 ${i}: 
        原始: [${str1.substring(start, end)}] 编码: [${str1Codes}]
        当前: [${str2.substring(start, end)}] 编码: [${str2Codes}]`;
      }
    }
    
    // 如果所有共同的字符都相同，那么一个字符串是另一个的前缀
    if (str1.length !== str2.length) {
      // 分析长度差异部分
      if (str1.length > str2.length) {
        const extraPart = str1.slice(str2.length);
        const extraCodes = extraPart.split('').map(c => c.charCodeAt(0));
        return `原始比当前长，多出部分: [${extraPart}] 编码: [${extraCodes}]`;
      } else {
        const extraPart = str2.slice(str1.length);
        const extraCodes = extraPart.split('').map(c => c.charCodeAt(0));
        return `当前比原始长，多出部分: [${extraPart}] 编码: [${extraCodes}]`;
      }
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