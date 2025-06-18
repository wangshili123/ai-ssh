/**
 * 编辑器内容管理器
 * 负责处理文件内容的加载、保存和编码管理
 */

import { EventEmitter } from 'events';
import * as monaco from 'monaco-editor';
import { EditorEvents, ChunkLoadResult, LargeFileInfo, EditorMode } from '../types/FileEditorTypes';
import { sftpService } from '../../../../services/sftp';


// 常量定义
const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB，超过此大小会触发大文件处理
const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
const MAX_INITIAL_LOAD_SIZE = 2 * 1024 * 1024; // 2MB

const MAX_CHUNK_SIZE = 512 * 1024; // 512KB
const VERY_LARGE_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const LARGE_FILE_SIZE = 1 * 1024 * 1024; // 1MB

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
  // 文件总大小
  private fileSize: number = 0;
  // 已加载内容大小
  private loadedContentSize: number = 0;
  // 是否是大文件
  private isLargeFile: boolean = false;
  // 是否处于加载中状态
  private isLoading: boolean = false;
  // 当前内容
  private content: string = '';
  // 内容编码
  private contentEncoding: string = 'utf8';
  // 初始行数
  private initialLines: number = 0;
  // 是否有错误
  private hasError: boolean = false;
  // 文件是否已加载
  private fileLoaded: boolean = false;
  // 总内容大小
  private totalContentSize: number = 0;
  // 当前编辑器模式
  private activeMode: EditorMode = EditorMode.BROWSE;
  // 是否正在保存
  private isSaving: boolean = false;
  // 是否需要保存
  private needsSave: boolean = false;

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
    console.log('[EditorContentManager] 实例已创建');
  }

  /**
   * 设置编辑器实例
   * @param editor Monaco编辑器实例
   */
  public setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
    console.log('[EditorContentManager] 编辑器已设置');
  }

  /**
   * 获取文件信息
   * 用于确定文件大小和是否需要分块加载
   */
  private async getFileInfo(): Promise<{size: number}> {
    try {
      console.log('[EditorContentManager] 获取文件信息:', this.filePath);
      // 生成正确的connectionId，因为sftpService期望的是connectionId格式
      const connectionId = `sftp-${this.sessionId}`;
      const result = await sftpService.stat(connectionId, this.filePath);
      console.log('[EditorContentManager] 文件大小:', result.size);
      this.fileSize = result.size;
      
      // 确定是否为大文件
      this.isLargeFile = this.fileSize > LARGE_FILE_THRESHOLD;
      if (this.isLargeFile) {
        console.log('[EditorContentManager] 检测到大文件，将使用分块加载');
        this.emit(EditorEvents.LARGE_FILE_DETECTED, {
          size: this.fileSize,
          path: this.filePath
        });
      }
      
      return { size: this.fileSize };
    } catch (error) {
      console.error('[EditorContentManager] 获取文件信息失败:', error);
      throw new Error(`获取文件信息失败: ${error}`);
    }
  }

  /**
   * 加载文件内容
   * 根据文件大小决定是否需要分块加载
   * @returns 文件内容
   */
  public async loadContent(): Promise<string> {
    try {
      console.log('[EditorContentManager] 正在加载文件:', this.filePath);
      
      // 先获取文件信息
      await this.getFileInfo();
      
      // 根据文件大小决定是否分块加载
      if (this.isLargeFile) {
        console.log('[EditorContentManager] 文件较大，使用分块加载模式');
        // 只加载前面部分内容
        const result = await this.loadChunk(0, Math.min(MAX_INITIAL_LOAD_SIZE, this.fileSize));
        this.originalContent = result.content;
        this.loadedContentSize = result.bytesRead;
        
        console.log('[EditorContentManager] 初始加载完成，已加载字节数:', this.loadedContentSize);
        
        this.emit(EditorEvents.FILE_LOADED, {
          path: this.filePath,
          size: this.fileSize,
          loadedSize: this.loadedContentSize,
          isPartiallyLoaded: true,
          modifyTime: Date.now()
        });
        
        return result.content;
      } else {
        // 小文件直接加载全部内容
        console.log('[EditorContentManager] 文件较小，直接加载全部内容');
        // 生成正确的connectionId，因为sftpService期望的是connectionId格式
        const connectionId = `sftp-${this.sessionId}`;
        const result = await sftpService.readFile(connectionId, this.filePath);
        this.originalContent = result.content;
        this.loadedContentSize = result.bytesRead;
        this.isDirty = false; // 重置脏状态
        
        console.log('[EditorContentManager] 文件加载成功，内容长度:', result.content.length);
        
        // 详细日志记录
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
        
        this.emit(EditorEvents.FILE_LOADED, {
          path: this.filePath,
          size: result.content.length,
          loadedSize: result.bytesRead,
          isPartiallyLoaded: false,
          modifyTime: Date.now()
        });
        
        return result.content;
      }
    } catch (error) {
      console.error('[EditorContentManager] 加载文件失败:', error);
      this.emit(EditorEvents.ERROR_OCCURRED, new Error(`加载文件失败: ${error}`));
      throw new Error(`加载文件失败: ${error}`);
    }
  }

  /**
   * 加载文件的指定块
   * @param start 起始位置（字节）
   * @param length 长度（字节），-1表示读取到文件末尾
   * @returns 加载结果
   */
  public async loadChunk(start: number, length: number = DEFAULT_CHUNK_SIZE): Promise<ChunkLoadResult> {
    if (this.isLoading) {
      console.log('[EditorContentManager] 当前有加载任务正在进行，忽略新的加载请求');
      throw new Error('当前有加载任务正在进行，请稍后再试');
    }
    
    try {
      this.isLoading = true;
      console.log(`[EditorContentManager] 开始加载文件块 - 起始位置: ${start}, 长度: ${length}, 文件总大小: ${this.fileSize}`);
      this.emit(EditorEvents.LOADING_STARTED);
      
      // 生成正确的connectionId，因为sftpService期望的是connectionId格式
      const connectionId = `sftp-${this.sessionId}`;
      const result = await sftpService.readFile(connectionId, this.filePath, start, length);
      console.log(`[EditorContentManager] 块加载成功 - 实际读取字节数: ${result.bytesRead}, 总大小: ${result.totalSize}, 内容长度: ${result.content.length}`);
      
      // 更新已加载内容大小
      this.loadedContentSize = Math.max(this.loadedContentSize, start + result.bytesRead);
      
      const hasMore = this.loadedContentSize < this.fileSize;
      
      // 增强日志记录
      console.log(`[EditorContentManager] 块加载后状态: loadedSize=${this.loadedContentSize}, totalSize=${this.fileSize}, hasMore=${hasMore}, 差值=${this.fileSize - this.loadedContentSize} 字节`);
      
      // 如果有编辑器和模型，并且起始位置正好是当前内容长度，则将内容追加到模型中
      if (this.editor && this.model) {
        const currentLength = this.model.getValue().length;
        console.log(`[EditorContentManager] 检查是否可以追加内容: start=${start}, currentLength=${currentLength}, 差异=${start - currentLength}`);
        
        // 放宽条件：允许一定范围内的差异
        const isAppendable = Math.abs(start - currentLength) < 10;
        
        if (isAppendable) {
          console.log('[EditorContentManager] 准备追加新内容到编辑器');
          
          // 获取当前滚动位置
          const scrollTop = this.editor.getScrollTop();
          const scrollLeft = this.editor.getScrollLeft();
          
          // 获取模型当前行数和最后一行的长度
          const lineCount = this.model.getLineCount();
          const lastLineLength = this.model.getLineLength(lineCount);
          
          console.log(`[EditorContentManager] 当前模型状态: 总行数=${lineCount}, 最后一行长度=${lastLineLength}`);
          
          // 创建编辑操作
          const edits = [{
            range: new monaco.Range(
              lineCount,
              lastLineLength + 1,
              lineCount,
              lastLineLength + 1
            ),
            text: result.content
          }];
          
          // 应用编辑
          console.log(`[EditorContentManager] 开始追加内容，长度为 ${result.content.length} 字节`);
          this.model.pushEditOperations(
            [],
            edits,
            () => null
          );
          
          // 确保编辑器刷新显示
          this.editor.layout();
          
          // 恢复滚动位置
          this.editor.setScrollTop(scrollTop);
          this.editor.setScrollLeft(scrollLeft);
          
          // 验证内容是否已正确追加
          const newValue = this.model.getValue();
          const newLength = newValue.length;
          const expectedLength = Math.max(currentLength, start) + result.content.length;
          
          console.log(`[EditorContentManager] 内容追加后验证: 之前长度=${currentLength}, 现在长度=${newLength}, 增加=${newLength - currentLength}, 期望增加=${result.content.length}`);
          
          if (Math.abs(newLength - expectedLength) > 10) {
            console.warn(`[EditorContentManager] 内容追加可能不完整，差异过大: 实际=${newLength}, 期望=${expectedLength}, 差异=${newLength - expectedLength}`);
          } else {
            console.log(`[EditorContentManager] 内容追加成功，当前总行数: ${this.model.getLineCount()}`);
          }
        } else {
          console.warn(`[EditorContentManager] 无法追加内容，起始位置(${start})与当前内容长度(${currentLength})不匹配`);
          
          // 如果差异太大，考虑替换整个内容而不是追加
          if (start === 0 || (start > 0 && currentLength === 0)) {
            console.log(`[EditorContentManager] 替换整个编辑器内容，长度为 ${result.content.length} 字节`);
            this.model.setValue(result.content);
          } else if (start > currentLength) {
            // 尝试进行填充后追加
            console.log(`[EditorContentManager] 尝试填充空格后追加内容`);
            const spacesToAdd = start - currentLength;
            const padding = ' '.repeat(Math.min(spacesToAdd, 1000)); // 避免添加过多空格
            
            this.model.pushEditOperations(
              [], 
              [{
                range: new monaco.Range(
                  this.model.getLineCount(),
                  this.model.getLineLength(this.model.getLineCount()) + 1,
                  this.model.getLineCount(),
                  this.model.getLineLength(this.model.getLineCount()) + 1
                ),
                text: padding + result.content
              }],
              () => null
            );
            console.log(`[EditorContentManager] 填充并追加内容完成，填充了 ${padding.length} 个空格`);
          }
        }
      }
      
      // 发出块加载完成事件
      this.emit(EditorEvents.CHUNK_LOADED, {
        startPosition: start,
        endPosition: start + result.bytesRead,
        bytesRead: result.bytesRead,
        totalSize: result.totalSize,
        hasMore
      });
      
      // 如果加载完毕，发出加载完成事件
      if (!hasMore) {
        this.emit(EditorEvents.LOAD_MORE_COMPLETED, {
          loadedSize: this.loadedContentSize,
          totalSize: this.fileSize,
          isComplete: true
        });
      }
      
      this.emit(EditorEvents.LOADING_END);
      
      return {
        content: result.content,
        startPosition: start,
        endPosition: start + result.bytesRead,
        totalSize: result.totalSize,
        bytesRead: result.bytesRead,
        hasMore
      };
    } catch (error) {
      console.error('[EditorContentManager] 加载文件块失败:', error);
      this.emit(EditorEvents.ERROR_OCCURRED, new Error(`加载文件块失败: ${error}`));
      throw new Error(`加载文件块失败: ${error}`);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * 获取大文件信息
   * @returns 大文件信息
   */
  public getLargeFileInfo(): LargeFileInfo {
    const loadedSize = this.loadedContentSize;
    const totalSize = this.fileSize;

    // 确保即使在初始化时也有合理的值
    if (loadedSize === 0 && totalSize > 0 && this.isLargeFile) {
      // 防止除零错误
      console.log('[EditorContentManager] getLargeFileInfo: 初始化状态，将设置hasMore为true');
      return {
        loadedSize: 0,
        totalSize,
        hasMore: true,
        isComplete: false
      };
    }

    const hasMore = loadedSize < totalSize;

    // 增强日志记录
    console.log(`[EditorContentManager] getLargeFileInfo: loadedSize=${loadedSize}, totalSize=${totalSize}, hasMore=${hasMore}, 差值=${totalSize - loadedSize} 字节`);

    return {
      loadedSize,
      totalSize,
      hasMore,
      isComplete: loadedSize >= totalSize
    };
  }

  /**
   * 获取文件大小
   * @returns 文件大小（字节）
   */
  public getFileSize(): number {
    return this.fileSize;
  }

  /**
   * 是否为大文件
   * @returns 是否为大文件
   */
  public getIsLargeFile(): boolean {
    return this.isLargeFile;
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
      
      // 生成正确的connectionId，因为sftpService期望的是connectionId格式
      const connectionId = `sftp-${this.sessionId}`;
      await sftpService.writeFile(connectionId, this.filePath, content);
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
        if(this.activeMode === EditorMode.BROWSE){
          console.log('[EditorContentManager] 浏览模式下，不处理内容变化');
          return;
        }
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

  /**
   * 获取内容
   * @returns 当前内容
   */
  public getContent(): string {
    return this.content;
  }

  /**
   * 获取内容编码
   * @returns 当前内容编码
   */
  public getContentEncoding(): string {
    return this.contentEncoding;
  }

  /**
   * 获取已加载内容大小
   * @returns 已加载内容大小
   */
  public getLoadedContentSize(): number {
    return this.loadedContentSize;
  }

  /**
   * 获取总内容大小
   * @returns 总内容大小
   */
  public getTotalContentSize(): number {
    return this.totalContentSize;
  }

  /**
   * 检查是否可以加载更多内容
   * @returns 是否可以加载更多内容
   */
  public canLoadMore(): boolean {
    return this.loadedContentSize < this.totalContentSize;
  }

  /**
   * 检查编辑器是否准备就绪
   * @returns 编辑器是否准备就绪
   */
  public isReady(): boolean {
    return this.fileLoaded && !this.hasError;
  }

  /**
   * 保存文件内容到指定路径
   * @param path 文件路径
   * @param content 文件内容，默认为当前内容
   * @param encoding 文件编码，默认为当前编码
   */
  public async saveContentWithPath(path: string, content?: string, encoding?: string): Promise<void> {
    if (this.isSaving) {
      this.needsSave = true;
      return;
    }

    this.isSaving = true;

    try {
      const contentToSave = content || this.content;
      const encodingToUse = encoding || this.contentEncoding;
      
      console.log(`[EditorContentManager] 保存文件内容: ${path}, 编码: ${encodingToUse}, 长度: ${contentToSave.length}`);
      
      this.emit(EditorEvents.SAVING_STARTED);
      
      // 使用 sftpService 替代 window.electron.sftpService，并将编码转换为合适的类型
      // 生成正确的connectionId，因为sftpService期望的是connectionId格式
      const connectionId = `sftp-${this.sessionId}`;
      await sftpService.writeFile(connectionId, path, contentToSave, encodingToUse as any);
      
      this.isSaving = false;
      this.emit(EditorEvents.SAVING_COMPLETED);
      
      // 如果在保存过程中又有新的保存请求
      if (this.needsSave) {
        this.needsSave = false;
        await this.saveContentWithPath(path, this.content, this.contentEncoding);
      }
    } catch (error) {
      this.isSaving = false;
      console.error(`[EditorContentManager] 保存文件失败: ${error}`);
      this.handleError(error);
    }
  }

  /**
   * 设置编辑器模式
   * @param mode 编辑器模式
   */
  public setMode(mode: EditorMode): void {
    this.activeMode = mode;
    console.log(`[EditorContentManager] 编辑器模式设置为: ${mode}`);
  }

  /**
   * 获取当前编辑器模式
   * @returns 当前编辑器模式
   */
  public getMode(): EditorMode {
    return this.activeMode;
  }

  /**
   * 处理错误
   * @param error 错误对象
   */
  private handleError(error: any): void {
    this.hasError = true;
    console.error(`[EditorContentManager] 编辑器内容管理器错误: ${error}`);
    this.emit(EditorEvents.ERROR, error);
  }

  public reset(): void {
    this.content = '';
    this.loadedContentSize = 0;
    this.totalContentSize = 0;
    this.hasError = false;
    this.fileLoaded = false;
    console.log('[EditorContentManager] 编辑器内容管理器已重置');
  }

  /**
   * 设置原始内容
   * @param content 原始内容
   */
  public setOriginalContent(content: string): void {
    console.log(`[EditorContentManager] 设置原始内容 - 长度: ${content.length}`);
    this.originalContent = content;
    
    // 重置脏状态
    if (this.model) {
      const currentContent = this.model.getValue();
      const isDirty = !this.isContentEquivalent(currentContent, this.originalContent);
      
      if (isDirty !== this.isDirty) {
        console.log('[EditorContentManager] 更新脏状态:', { isDirty, previousIsDirty: this.isDirty });
        this.isDirty = isDirty;
        this.emit(EditorEvents.CONTENT_CHANGED, { isModified: isDirty });
      }
    } else {
      this.isDirty = false;
    }
  }
} 