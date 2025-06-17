/**
 * 编辑器管理器
 * 负责协调编辑器的各个功能模块和对外提供统一的接口
 */

import { EventEmitter } from 'events';
import * as monaco from 'monaco-editor';
import { EditorEvents, EditorMode } from '../types/FileEditorTypes';
import { EditorReadOnlyHandler } from './EditorReadOnlyHandler';
import { EditorContentManager } from './EditorContentManager';
import { EditorModeManager } from './EditorModeManager';

// 配置 Monaco Editor 的 worker
(window as any).MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, _label: string) {
    // 使用相对路径或CDN路径
    return './vs/base/worker/workerMain.js';
  }
};

/**
 * 编辑器状态接口
 */
export interface EditorState {
  isDirty: boolean;
  encoding: string;
  cursorPosition: {
    line: number;
    column: number;
  };
  isLoading: boolean;
  error: Error | null;
  isRealtime: boolean;
  isConnected: boolean;
  showLoadCompletePrompt: boolean;
  isRefreshing: boolean;
  isSaving: boolean;
  mode: EditorMode;
  isLargeFile?: boolean;
  isAutoScroll?: boolean;
  largeFileInfo?: {
    loadedSize: number;
    totalSize: number;
    hasMore: boolean;
    isComplete?: boolean;
  };
  loadingProgress?: number;
}

/**
 * 编辑器管理器
 * 协调编辑器的各个功能模块，对外提供统一的接口
 */
export class EditorManager extends EventEmitter {
  // 编辑器实例
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  // 编辑器模型
  private model: monaco.editor.ITextModel | null = null;
  // 编辑器状态
  private state: EditorState = {
    isDirty: false,
    encoding: 'UTF-8',
    cursorPosition: { line: 1, column: 1 },
    isLoading: false,
    error: null,
    isRealtime: false,
    isConnected: true,
    showLoadCompletePrompt: false,
    isRefreshing: false,
    isSaving: false,
    mode: EditorMode.BROWSE,
    isLargeFile: false,
    largeFileInfo: undefined,
    loadingProgress: undefined
  };

  // 会话和文件信息
  private sessionId: string;
  private filePath: string;
  
  // 功能模块管理器
  private contentManager: EditorContentManager;
  private modeManager: EditorModeManager;
  private readOnlyHandler: EditorReadOnlyHandler | null = null;

  /**
   * 构造函数
   * @param sessionId 会话ID
   * @param filePath 文件路径
   */
  constructor(sessionId: string, filePath: string) {
    super();
    this.sessionId = sessionId;
    this.filePath = filePath;
    
    // 初始化内容管理器
    this.contentManager = new EditorContentManager(sessionId, filePath);
    
    // 初始化模式管理器
    this.modeManager = new EditorModeManager(null, this.state.mode);
    
    // 设置事件转发
    this.setupEventForwarding();
  }

  /**
   * 设置事件转发
   * 将各个管理器的事件转发到EditorManager
   */
  private setupEventForwarding(): void {
    // 转发内容管理器事件
    this.contentManager.on(EditorEvents.CONTENT_CHANGED, (data) => {
      console.log('[EditorManager] 收到内容变化事件，isDirty:', data.isModified);
      
      // 创建新的状态对象，而不是修改原对象
      const newState = { 
        ...this.state,
        isDirty: data.isModified 
      };
      this.state = newState; // 更新状态引用
      
      console.log('[EditorManager] 发出状态变化事件，新状态:', newState);
      this.emit('stateChanged', newState);
    });
    
    this.contentManager.on(EditorEvents.FILE_LOADED, (data) => {
      this.emit(EditorEvents.FILE_LOADED, data);
    });
    
    this.contentManager.on(EditorEvents.FILE_SAVED, () => {
      // 创建新的状态对象
      const newState = { 
        ...this.state,
        isDirty: false 
      };
      this.state = newState;
      
      console.log('[EditorManager] 文件已保存，重置isDirty为false');
      this.emit('stateChanged', newState);
      this.emit(EditorEvents.FILE_SAVED);
    });
    
    this.contentManager.on(EditorEvents.ERROR_OCCURRED, (error) => {
      this.state.error = error;
      this.emit('stateChanged', this.state);
      this.emit(EditorEvents.ERROR_OCCURRED, error);
    });
    
    this.contentManager.on(EditorEvents.ENCODING_CHANGED, (encoding) => {
      this.state.encoding = encoding;
      this.emit('stateChanged', this.state);
      this.emit(EditorEvents.ENCODING_CHANGED, encoding);
    });
    
    // 转发模式管理器事件
    this.modeManager.on(EditorEvents.MODE_SWITCHING_STARTED, (data) => {
      // 创建新状态对象
      const loadingState = {
        ...this.state,
        isLoading: true
      };
      this.state = loadingState;
      this.emit('stateChanged', loadingState);
      this.emit(EditorEvents.MODE_SWITCHING_STARTED, data);
    });
    
    this.modeManager.on(EditorEvents.MODE_SWITCHING_COMPLETED, (data) => {
      // 创建新状态对象
      const completedState = {
        ...this.state,
        mode: data.mode,
        isLoading: false
      };
      this.state = completedState;
      this.emit('stateChanged', completedState);
      this.emit(EditorEvents.MODE_SWITCHING_COMPLETED, data);
      
      // 更新只读处理器
      if (this.readOnlyHandler) {
        this.readOnlyHandler.updateMode(data.mode);
      }
    });
    
    this.modeManager.on(EditorEvents.MODE_SWITCHING_FAILED, (data) => {
      // 创建新状态对象
      const failedState = {
        ...this.state,
        isLoading: false,
        error: data.error
      };
      this.state = failedState;
      this.emit('stateChanged', failedState);
      this.emit(EditorEvents.MODE_SWITCHING_FAILED, data);
    });
    
    // 添加大文件相关事件转发
    this.contentManager.on(EditorEvents.LARGE_FILE_DETECTED, (data) => {
      console.log('[EditorManager] 检测到大文件:', data);
      
      // 获取大文件信息并正确初始化largeFileInfo
      const largeFileInfo = this.contentManager.getLargeFileInfo();
      console.log('[EditorManager] 大文件初始信息:', largeFileInfo);
      
      // 创建新状态对象并明确设置大文件相关属性
      const newState = {
        ...this.state,
        isLargeFile: true,  // 明确设置为 true
        showLoadCompletePrompt: true,
        largeFileInfo  // 设置完整的大文件信息
      };
      
      console.log('[EditorManager] 大文件状态更新:', {
        oldState: {
          isLargeFile: this.state.isLargeFile,
          largeFileInfo: this.state.largeFileInfo
        },
        newState: {
          isLargeFile: newState.isLargeFile,
          largeFileInfo: newState.largeFileInfo
        }
      });
      
      // 更新状态
      this.state = newState;
      
      // 触发状态变化事件
      this.emit('stateChanged', newState);
      this.emit(EditorEvents.LARGE_FILE_DETECTED, data);
    });
    
    this.contentManager.on(EditorEvents.CHUNK_LOADED, (data) => {
      console.log('[EditorManager] 块加载完成:', data);
      
      // 创建新的大文件信息对象
      const newLargeFileInfo = {
        loadedSize: data.endPosition,
        totalSize: data.totalSize,
        hasMore: data.hasMore
      };
      
      // 检查大文件信息是否有变化
      const hasInfoChanged = !this.state.largeFileInfo || 
        this.state.largeFileInfo.loadedSize !== newLargeFileInfo.loadedSize ||
        this.state.largeFileInfo.totalSize !== newLargeFileInfo.totalSize ||
        this.state.largeFileInfo.hasMore !== newLargeFileInfo.hasMore;
      
      // 创建新状态对象
      const newState = {
        ...this.state,
        isLargeFile: true,  // 确保设置为 true
        largeFileInfo: newLargeFileInfo
      };
      
      // 记录状态变化详情
      console.log('[EditorManager] 更新大文件信息:', {
        oldState: this.state.largeFileInfo,
        newState: newState.largeFileInfo,
        hasChanged: hasInfoChanged
      });
      
      if (hasInfoChanged) {
        // 更新状态引用
        this.state = newState;
        
        // 触发状态变化事件
        this.emit('stateChanged', newState);
      }
      
      this.emit(EditorEvents.CHUNK_LOADED, data);
    });
    
    this.contentManager.on(EditorEvents.LOAD_MORE_COMPLETED, (data) => {
      console.log('[EditorManager] 加载更多内容完成:', data);
      if (data.isComplete) {
        this.state.showLoadCompletePrompt = false;
      }
      this.emit('stateChanged', this.state);
      this.emit(EditorEvents.LOAD_MORE_COMPLETED, data);
    });
  }

  /**
   * 调试方法
   * 输出当前编辑器状态
   */
  private debugState(): void {
    console.log('[EditorManager] 当前状态:', {
      hasEditor: !!this.editor,
      hasModel: !!this.model,
      modelDisposed: this.model?.isDisposed(),
      editorDomElement: this.editor?.getDomNode(),
      modelLanguage: this.model?.getLanguageId(),
      modelUri: this.model?.uri.toString(),
      contentLength: this.model?.getValue().length,
      state: { ...this.state }
    });
  }

  /**
   * 初始化编辑器
   * @param container 编辑器容器元素
   * @param options 编辑器选项
   */
  async initialize(container: HTMLElement, options: monaco.editor.IStandaloneEditorConstructionOptions = {}): Promise<void> {
    try {
      console.log('[EditorManager] 开始初始化');
      this.state.isLoading = true;
      this.emit('stateChanged', this.state);

      console.log('[EditorManager] 开始创建编辑器实例');
      
      // 加载文件内容
      const content = await this.contentManager.loadContent();
      
      // 检查是否为大文件，并确保状态正确
      if (this.contentManager.getIsLargeFile()) {
        const largeFileInfo = this.contentManager.getLargeFileInfo();
        console.log('[EditorManager] 初始化时检测到大文件:', largeFileInfo);
        
        // 更新状态
        this.state.isLargeFile = true;
        this.state.largeFileInfo = largeFileInfo;
      }
      
      // 创建编辑器实例
      console.log('[EditorManager] 创建Monaco编辑器实例');
      this.editor = monaco.editor.create(container, {
        value: content,
        language: this.contentManager.getLanguageFromPath(this.filePath),
        theme: 'vs-dark',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        minimap: { enabled: true },
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        contextmenu: true,
        fixedOverflowWidgets: true,
        overviewRulerBorder: false,
        readOnly: this.state.mode === EditorMode.BROWSE,
        scrollbar: {
          useShadows: false,
          verticalScrollbarSize: 10,
          horizontalScrollbarSize: 10,
          alwaysConsumeMouseWheel: false
        },
        ...options
      });

      console.log('[EditorManager] 编辑器实例创建完成');
      this.debugState();

      // 等待编辑器实例准备就绪
      await new Promise(resolve => setTimeout(resolve, 100));

      // 创建模型
      if (this.model) {
        console.log('[EditorManager] 清理旧模型');
        this.model.dispose();
      }
      
      console.log('[EditorManager] 创建新模型');
      this.model = monaco.editor.createModel(
        content,
        this.contentManager.getLanguageFromPath(this.filePath),
        monaco.Uri.file(this.filePath)
      );
      
      this.editor.setModel(this.model);
      console.log('[EditorManager] 模型设置完成');
      this.debugState();

      // 更新内容管理器
      this.contentManager.setEditor(this.editor);
      this.contentManager.setModel(this.model);
      
      // 更新模式管理器
      this.modeManager.setEditor(this.editor);
      
      // 初始化只读处理器
      this.readOnlyHandler = new EditorReadOnlyHandler(this.editor, this.state.mode);

      // 设置事件监听
      this.setupEditorEventListeners();

      // 强制重新布局
      console.log('[EditorManager] 强制重新布局');
      this.editor.layout();

      this.state.isLoading = false;
      this.emit('stateChanged', this.state);
      
      console.log('[EditorManager] 初始化完成，状态:', this.state);
      this.debugState();
    } catch (error) {
      console.error('[EditorManager] 初始化失败:', error);
      this.state.error = error as Error;
      this.state.isLoading = false;
      this.emit('stateChanged', this.state);
      throw error;
    }
  }

  /**
   * 设置编辑器事件监听
   */
  private setupEditorEventListeners(): void {
    if (!this.editor) return;

    // 光标位置变化
    this.editor.onDidChangeCursorPosition(e => {
      this.state.cursorPosition = {
        line: e.position.lineNumber,
        column: e.position.column
      };
      this.emit('stateChanged', this.state);
    });
  }

  /**
   * 切换编辑模式
   * @param mode 目标模式
   */
  public async switchMode(mode: EditorMode): Promise<boolean> {
    // 如果是切换到编辑模式，且当前是大文件，需要加载完整文件
    if (mode === EditorMode.EDIT && this.state.isLargeFile) {
      try {
        console.log('[EditorManager] 切换到编辑模式，检测到大文件，开始加载完整文件');
        
        // 设置加载状态
        const loadingState = {
          ...this.state,
          isLoading: true
        };
        this.state = loadingState;
        this.emit('stateChanged', loadingState);
        
        // 获取会话ID和文件路径
        const sessionId = this.sessionId;
        const filePath = this.filePath;
        
        // 导入sftpService
        const { sftpService } = await import('../../../../services/sftp');
        
        console.log(`[EditorManager] 开始并行读取大文件 - sessionId: ${sessionId}, filePath: ${filePath}`);
        
        // 创建进度更新函数
        let lastProgressEmit = 0;
        const onProgress = (progress: number) => {
          // 限制进度更新频率，避免过多的状态更新
          const now = Date.now();
          if (now - lastProgressEmit > 200 || progress >= 1) { // 每200ms更新一次或进度完成时
            lastProgressEmit = now;
            
            // 计算百分比并取整
            const percent = Math.round(progress * 100);
            console.log(`[EditorManager] 大文件加载进度: ${percent}%`);
            
            // 更新加载状态，包含进度信息
            const progressState = {
              ...this.state,
              isLoading: true,
              loadingProgress: progress
            };
            this.emit('loadingProgress', progress); // 发出专门的进度事件
            this.emit('stateChanged', progressState);
          }
        };
        
        // 生成正确的connectionId，因为sftpService期望的是connectionId格式
        const connectionId = `sftp-${sessionId}`;
        // 并行读取整个文件，添加进度回调
        const result = await sftpService.readLargeFile(connectionId, filePath, {
          chunkSize: 131072, // 128KB
          maxParallelChunks: 8,
          onProgress
        });
        
        console.log(`[EditorManager] 大文件读取完成 - 总大小: ${result.totalSize}, 读取字节数: ${result.bytesRead}`);
        
        // 更新编辑器内容
        if (this.model) {
          console.log('[EditorManager] 更新编辑器模型内容');
          this.model.setValue(result.content);
          
          // 更新原始内容
          this.contentManager.setOriginalContent(result.content);
        }
        
        // 更新状态 - 编辑模式下不再视为"大文件"
        const updatedState = {
          ...this.state,
          isLargeFile: false,
          largeFileInfo: undefined,
          isLoading: false,
          loadingProgress: undefined // 清除进度信息
        };
        this.state = updatedState;
        this.emit('stateChanged', updatedState);
        
        console.log('[EditorManager] 大文件加载完成，继续模式切换');
      } catch (error) {
        console.error('[EditorManager] 加载完整文件失败:', error);
        
        // 更新错误状态
        const errorState = {
          ...this.state,
          error: error instanceof Error ? error : new Error(String(error)),
          isLoading: false,
          loadingProgress: undefined // 清除进度信息
        };
        this.state = errorState;
        this.emit('stateChanged', errorState);
        this.emit('error', errorState.error);
        
        return false;
      }
    }
    
    // 正常的模式切换
    return this.modeManager.switchMode(mode);
  }

  /**
   * 保存文件
   */
  public async save(): Promise<void> {
    console.log('[EditorManager] 开始保存文件，isDirty状态:', this.state.isDirty);
    if (!this.state.isDirty) return;

    try {
      // 创建新状态对象
      const loadingState = {
        ...this.state,
        isSaving: true
      };
      this.state = loadingState;
      this.emit('stateChanged', loadingState);
      
      await this.contentManager.saveContent();
      
      // 创建新状态对象
      const savedState = {
        ...this.state,
        isDirty: false,
        isSaving: false
      };
      this.state = savedState;
      
      console.log('[EditorManager] 文件保存成功，isDirty状态重置为:', savedState.isDirty);
      this.emit('stateChanged', savedState);
    } catch (error) {
      // 创建新状态对象
      const errorState = {
        ...this.state,
        error: error as Error,
        isSaving: false
      };
      this.state = errorState;
      this.emit('stateChanged', errorState);
      throw error;
    }
  }

  /**
   * 重新加载内容
   */
  public async reload(): Promise<void> {
    try {
      // 创建新状态对象
      const refreshingState = {
        ...this.state,
        isRefreshing: true
      };
      this.state = refreshingState;
      this.emit('stateChanged', refreshingState);
      
      const content = await this.contentManager.loadContent();
      
      if (this.model) {
        this.model.setValue(content);
      }
      
      // 创建新状态对象
      const reloadedState = {
        ...this.state,
        isDirty: false,
        isRefreshing: false
      };
      this.state = reloadedState;
      this.emit('stateChanged', reloadedState);
    } catch (error) {
      // 创建新状态对象
      const errorState = {
        ...this.state,
        error: error as Error,
        isRefreshing: false
      };
      this.state = errorState;
      this.emit('stateChanged', errorState);
      throw error;
    }
  }

  /**
   * 获取当前状态
   */
  public getState(): EditorState {
    return { ...this.state };
  }

  /**
   * 设置编码
   * @param encoding 编码名称
   */
  public setEncoding(encoding: string): void {
    this.contentManager.setEncoding(encoding);
  }

  /**
   * 销毁编辑器
   * 清理所有资源
   */
  public destroy(): void {
    // 销毁编辑器实例
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
    
    // 销毁模型
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    
    // 销毁模块管理器
    if (this.readOnlyHandler) {
      this.readOnlyHandler.dispose();
      this.readOnlyHandler = null;
    }
    
    this.contentManager.dispose();
    this.modeManager.dispose();
    
    // 移除所有事件监听
    this.removeAllListeners();
  }

  // 只读属性访问方法
  
  /**
   * 获取当前模式
   */
  get mode(): EditorMode {
    return this.state.mode;
  }
  
  /**
   * 获取是否有未保存内容
   */
  get isDirty(): boolean {
    return this.state.isDirty;
  }
  
  /**
   * 获取是否正在加载
   */
  get isLoading(): boolean {
    return this.state.isLoading;
  }
  
  /**
   * 获取当前错误
   */
  get error(): Error | null {
    return this.state.error;
  }
  
  /**
   * 获取光标位置
   */
  get cursorPosition(): { line: number; column: number } {
    return this.state.cursorPosition;
  }
  
  /**
   * 获取编码方式
   */
  get encoding(): string {
    return this.state.encoding;
  }
  
  /**
   * 获取编辑器实例
   */
  public getEditor(): monaco.editor.IStandaloneCodeEditor | null {
    return this.editor;
  }
  
  /**
   * 获取是否处于只读状态
   */
  public isReadOnly(): boolean {
    return this.state.mode === EditorMode.BROWSE;
  }
  
  /**
   * 执行编辑器命令
   * @param command 命令名称
   */
  public executeCommand(command: string): void {
    if (!this.editor) return;
    
    switch (command) {
      case 'copy':
        this.editor.getAction('editor.action.clipboardCopyAction')?.run();
        break;
      case 'paste':
        this.editor.getAction('editor.action.clipboardPasteAction')?.run();
        break;
      case 'cut':
        this.editor.getAction('editor.action.clipboardCutAction')?.run();
        break;
      case 'selectAll':
        this.editor.getAction('editor.action.selectAll')?.run();
        break;
    }
  }
  
  /**
   * 检查是否有选中内容
   */
  public hasSelection(): boolean {
    if (!this.editor) return false;
    const selection = this.editor.getSelection();
    return selection ? !selection.isEmpty() : false;
  }
  
  // 状态更新方法
  
  /**
   * 设置是否有未保存修改
   */
  public setDirty(dirty: boolean): void {
    this.state.isDirty = dirty;
    this.emit('stateChanged', this.state);
  }
  
  /**
   * 设置是否正在加载
   */
  public setLoading(loading: boolean): void {
    this.state.isLoading = loading;
    this.emit('stateChanged', this.state);
  }
  
  /**
   * 设置是否正在保存
   */
  public setSaving(saving: boolean): void {
    this.state.isSaving = saving;
    this.emit('stateChanged', this.state);
  }
  
  /**
   * 设置错误信息
   */
  public setError(error: Error | null): void {
    this.state.error = error;
    this.emit('stateChanged', this.state);
  }
  
  /**
   * 设置是否已连接
   */
  public setConnected(connected: boolean): void {
    this.state.isConnected = connected;
    this.emit('stateChanged', this.state);
  }
  
  /**
   * 设置光标位置
   */
  public setCursorPosition(position: { line: number; column: number }): void {
    this.state.cursorPosition = position;
    this.emit('stateChanged', this.state);
  }
  
  /**
   * 获取是否显示加载完成提示
   */
  get showLoadCompletePrompt(): boolean {
    return this.state.showLoadCompletePrompt;
  }
  
  /**
   * 设置是否显示加载完成提示
   */
  set showLoadCompletePrompt(value: boolean) {
    this.state.showLoadCompletePrompt = value;
    this.emit('stateChanged', this.state);
  }
  
  /**
   * 启动实时更新模式
   */
  public startRealtime(): void {
    if (this.state.isRealtime) return;
    
    try {
      console.log('[EditorManager] 启动实时更新模式');
      this.state.isRealtime = true;
      this.emit('stateChanged', this.state);
      this.emit(EditorEvents.WATCH_STARTED);
    } catch (error) {
      console.error('[EditorManager] 启动实时更新失败:', error);
      this.setError(error as Error);
    }
  }
  
  /**
   * 停止实时更新模式
   */
  public stopRealtime(): void {
    if (!this.state.isRealtime) return;
    
    try {
      console.log('[EditorManager] 停止实时更新模式');
      this.state.isRealtime = false;
      this.emit('stateChanged', this.state);
      this.emit(EditorEvents.WATCH_STOPPED);
    } catch (error) {
      console.error('[EditorManager] 停止实时更新失败:', error);
      this.setError(error as Error);
    }
  }
  
  /**
   * 设置是否自动滚动
   */
  public setAutoScroll(enabled: boolean): void {
    try {
      console.log(`[EditorManager] ${enabled ? '启用' : '禁用'}自动滚动`);
      this.emit(EditorEvents.AUTO_SCROLL_CHANGED, enabled);
    } catch (error) {
      console.error('[EditorManager] 设置自动滚动失败:', error);
      this.setError(error as Error);
    }
  }

  /**
   * 获取内容管理器
   * 用于直接操作文件内容
   */
  public getContentManager(): EditorContentManager {
    return this.contentManager;
  }

  /**
   * 加载更多内容
   * 用于大文件滚动加载
   */
  public async loadMoreContent(): Promise<boolean> {
    if (!this.state.isLargeFile || !this.state.largeFileInfo?.hasMore) {
      console.log('[EditorManager] 没有更多内容需要加载', {
        isLargeFile: this.state.isLargeFile,
        hasMore: this.state.largeFileInfo?.hasMore,
        largeFileInfo: this.state.largeFileInfo
      });
      return false;
    }
    
    try {
      console.log('[EditorManager] 开始加载更多内容');
      
      // 记录加载前的内容状态
      const beforeLoadContentLength = this.model?.getValue().length || 0;
      const beforeLoadLineCount = this.model?.getLineCount() || 0;
      console.log(`[EditorManager] 加载前状态: 内容长度=${beforeLoadContentLength}, 行数=${beforeLoadLineCount}`);
      
      // 更新状态为加载中
      const loadingState = {
        ...this.state,
        isLoading: true
      };
      this.state = loadingState;
      this.emit('stateChanged', loadingState);
      
      const loadedSize = this.state.largeFileInfo?.loadedSize || 0;
      const result = await this.contentManager.loadChunk(loadedSize);
      
      console.log('[EditorManager] 加载更多内容成功', result);
      
      // 验证内容是否真的增加了
      const afterLoadContentLength = this.model?.getValue().length || 0;
      const afterLoadLineCount = this.model?.getLineCount() || 0;
      const contentIncreased = afterLoadContentLength > beforeLoadContentLength;
      const linesIncreased = afterLoadLineCount > beforeLoadLineCount;
      
      console.log(`[EditorManager] 加载后状态: 内容长度=${afterLoadContentLength}, 行数=${afterLoadLineCount}, 内容增加=${contentIncreased}, 行数增加=${linesIncreased}`);
      
      // 如果内容没有增加但应该增加，尝试强制刷新
      if (!contentIncreased && result.bytesRead > 0) {
        console.warn('[EditorManager] 加载内容后编辑器没有显示新内容，尝试强制刷新');
        
        // 更复杂的强制刷新机制
        if (this.editor) {
          // 1. 强制布局刷新
          this.editor.layout();
          
          // 2. 强制滚动到底部然后回来，触发重绘
          const currentScrollTop = this.editor.getScrollTop();
          this.editor.setScrollTop(this.editor.getScrollTop() + 100);
          setTimeout(() => {
            if (this.editor) {
              this.editor.setScrollTop(currentScrollTop);
            }
          }, 50);
          
          // 3. 聚焦编辑器，可能触发重绘
          this.editor.focus();
        }
      }
      
      // 主动更新状态（即使事件已经更新了状态，这里再次确保）
      const newState = {
        ...this.state,
        isLoading: false,
        largeFileInfo: {
          loadedSize: result.endPosition,
          totalSize: result.totalSize,
          hasMore: result.hasMore
        }
      };
      this.state = newState;
      this.emit('stateChanged', newState);
      console.log('[EditorManager] 更新大文件状态:', newState.largeFileInfo);
      
      return contentIncreased || linesIncreased; // 返回是否真的有内容增加
    } catch (error) {
      console.error('[EditorManager] 加载更多内容失败:', error);
      
      // 更新加载状态
      const errorState = {
        ...this.state,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
      this.state = errorState;
      this.emit('stateChanged', errorState);
      this.emit('error', errorState.error);
      
      return false;
    }
  }
} 