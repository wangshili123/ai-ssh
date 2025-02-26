import { EventEmitter } from 'events';
import * as monaco from 'monaco-editor';
import { EditorEvents, EditorMode } from '../types/FileEditorTypes';
import { sftpService } from '../../../../services/sftp';

// 配置 Monaco Editor 的 worker
(window as any).MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, _label: string) {
    // 使用相对路径或CDN路径
    return './vs/base/worker/workerMain.js';
  }
};

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
}

export interface EditorConfig {
  // ... rest of the code ...
}

export class EditorManager extends EventEmitter {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private model: monaco.editor.ITextModel | null = null;
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
    mode: EditorMode.EDIT
  };

  private sessionId: string;
  private filePath: string;
  private originalContent: string = '';

  constructor(sessionId: string, filePath: string) {
    super();
    this.sessionId = sessionId;
    this.filePath = filePath;
  }

  // 调试方法
  private debugState() {
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

  // 初始化编辑器
  async initialize(container: HTMLElement, options: monaco.editor.IStandaloneEditorConstructionOptions = {}) {
    try {
      console.log('[EditorManager] 开始初始化');
      this.state.isLoading = true;
      this.emit('stateChanged', this.state);

      console.log('[EditorManager] 开始创建编辑器实例');
      
      // 加载文件内容
      const content = await this.loadContent();
      this.originalContent = content;
      console.log('[EditorManager] 文件内容加载完成，长度:', content.length);

      // 创建编辑器实例
      console.log('[EditorManager] 创建Monaco编辑器实例');
      this.editor = monaco.editor.create(container, {
        value: content, // 直接设置初始内容
        language: this.getLanguageFromPath(this.filePath),
        theme: 'vs-dark',
        automaticLayout: true,
        scrollBeyondLastLine: false,
        minimap: { enabled: true },
        lineNumbers: 'on',
        renderLineHighlight: 'all',
        contextmenu: true,
        fixedOverflowWidgets: true,
        overviewRulerBorder: false,
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
        this.getLanguageFromPath(this.filePath),
        monaco.Uri.file(this.filePath)
      );
      
      this.editor.setModel(this.model);
      console.log('[EditorManager] 模型设置完成');
      this.debugState();

      // 监听变化
      console.log('[EditorManager] 设置事件监听');
      this.setupEventListeners();

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

  // 设置事件监听
  private setupEventListeners() {
    if (!this.editor || !this.model) return;

    // 内容变化
    this.model.onDidChangeContent(() => {
      const currentContent = this.model?.getValue() || '';
      const isDirty = currentContent !== this.originalContent;
      if (isDirty !== this.state.isDirty) {
        this.state.isDirty = isDirty;
        this.emit('stateChanged', this.state);
      }
    });

    // 光标位置变化
    this.editor.onDidChangeCursorPosition(e => {
      this.state.cursorPosition = {
        line: e.position.lineNumber,
        column: e.position.column
      };
      this.emit('stateChanged', this.state);
    });
  }

  // 获取文件语言类型
  private getLanguageFromPath(filePath: string): string {
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

  // 加载文件内容
  private async loadContent(): Promise<string> {
    try {
      console.log('正在加载文件:', this.filePath);
      const result = await sftpService.readFile(this.sessionId, this.filePath);
      console.log('文件加载成功，内容长度:', result.content.length);
      return result.content;
    } catch (error) {
      console.error('加载文件失败:', error);
      throw new Error(`加载文件失败: ${error}`);
    }
  }

  // 保存文件
  async save(): Promise<void> {
    if (!this.model || !this.state.isDirty) return;

    try {
      const content = this.model.getValue();
      await sftpService.writeFile(this.sessionId, this.filePath, content);
      this.originalContent = content;
      this.state.isDirty = false;
      this.emit('stateChanged', this.state);
      this.emit(EditorEvents.FILE_SAVED);
    } catch (error) {
      throw new Error(`保存文件失败: ${error}`);
    }
  }

  // 获取当前状态
  getState(): EditorState {
    return { ...this.state };
  }

  // 设置编码
  setEncoding(encoding: string) {
    this.state.encoding = encoding;
    this.emit('stateChanged', this.state);
  }

  // 销毁编辑器
  destroy() {
    if (this.editor) {
      this.editor.dispose();
    }
    if (this.model) {
      this.model.dispose();
    }
    this.removeAllListeners();
  }

  // 重新加载内容
  async reload(): Promise<void> {
    try {
      const content = await this.loadContent();
      if (this.model) {
        this.model.setValue(content);
        this.originalContent = content;
        this.state.isDirty = false;
        this.emit('stateChanged', this.state);
      }
    } catch (error) {
      throw new Error(`重新加载失败: ${error}`);
    }
  }

  // 执行编辑器命令
  executeCommand(command: string): void {
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

  // 检查是否有选中内容
  hasSelection(): boolean {
    if (!this.editor) return false;
    const selection = this.editor.getSelection();
    return selection ? !selection.isEmpty() : false;
  }

  // 获取编辑器实例
  getEditor(): monaco.editor.IStandaloneCodeEditor | null {
    return this.editor;
  }

  // 获取当前内容
  getContent(): string {
    return this.model?.getValue() || '';
  }

  // 设置内容
  setContent(content: string): void {
    if (this.model) {
      this.model.setValue(content);
      this.originalContent = content;
      this.state.isDirty = false;
      this.emit('stateChanged', this.state);
    }
  }

  // 获取光标位置
  getCursorPosition(): { line: number; column: number } {
    if (!this.editor) return { line: 1, column: 1 };
    const position = this.editor.getPosition();
    return {
      line: position?.lineNumber || 1,
      column: position?.column || 1
    };
  }

  // 新增方法
  setCurrentFile(file: string) {
    this.filePath = file;
  }

  setSessionInfo(info: { sessionId: string; connectionId: string; isConnected: boolean }) {
    this.sessionId = info.sessionId;
    this.state.isConnected = info.isConnected;
  }

  setEditorState(state: Partial<EditorState>) {
    this.state = { ...this.state, ...state };
    this.emit('stateChanged', this.state);
  }

  setDirty(dirty: boolean) {
    this.state.isDirty = dirty;
    this.emit('stateChanged', this.state);
  }

  setLoading(loading: boolean) {
    this.state.isLoading = loading;
    this.emit('stateChanged', this.state);
  }

  setSaving(saving: boolean) {
    this.state.isSaving = saving;
    this.emit('stateChanged', this.state);
  }

  setError(error: Error | null) {
    this.state.error = error;
    this.emit('stateChanged', this.state);
  }

  setConnected(connected: boolean) {
    this.state.isConnected = connected;
    this.emit('stateChanged', this.state);
  }

  setCursorPosition(position: { line: number; column: number }) {
    this.state.cursorPosition = position;
    this.emit('stateChanged', this.state);
  }

  // 获取器
  get isRealtime() {
    return this.state.isRealtime;
  }

  get isDirty() {
    return this.state.isDirty;
  }

  get isLoading() {
    return this.state.isLoading;
  }

  get error() {
    return this.state.error;
  }

  get isConnected() {
    return this.state.isConnected;
  }

  get cursorPosition() {
    return this.state.cursorPosition;
  }

  get encoding() {
    return this.state.encoding;
  }

  get isRefreshing() {
    return this.state.isRefreshing;
  }

  get showLoadCompletePrompt() {
    return this.state.showLoadCompletePrompt;
  }

  set showLoadCompletePrompt(value: boolean) {
    this.state.showLoadCompletePrompt = value;
    this.emit('stateChanged', this.state);
  }

  /**
   * 切换编辑模式
   * @param mode 目标模式
   */
  public async switchMode(mode: EditorMode): Promise<boolean> {
    if (this.state.mode === mode) {
      return true; // 已经是目标模式
    }

    try {
      console.log(`[EditorManager] 开始切换到${mode}模式`);
      this.state.isLoading = true;
      this.emit('stateChanged', this.state);
      
      // 模拟模式切换延迟
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 如果是切换到编辑模式，需要加载完整内容
      if (mode === EditorMode.EDIT && this.state.showLoadCompletePrompt) {
        console.log('[EditorManager] 加载完整内容');
        await this.reload();
      }
      
      // 更新状态
      this.state.mode = mode;
      this.state.isLoading = false;
      
      console.log(`[EditorManager] 切换到${mode}模式完成`);
      this.emit('stateChanged', this.state);
      this.emit(EditorEvents.MODE_SWITCHING_COMPLETED, { mode });
      
      return true;
    } catch (error) {
      console.error(`[EditorManager] 切换到${mode}模式失败:`, error);
      this.state.isLoading = false;
      this.state.error = error as Error;
      this.emit('stateChanged', this.state);
      this.emit(EditorEvents.MODE_SWITCHING_FAILED, { error });
      
      return false;
    }
  }

  // 获取当前模式
  get mode(): EditorMode {
    return this.state.mode;
  }

  // 设置当前模式
  set mode(value: EditorMode) {
    if (this.state.mode !== value) {
      this.state.mode = value;
      this.emit('stateChanged', this.state);
    }
  }

  /**
   * 启动实时更新模式
   * 在浏览模式下监控文件变化
   */
  public startRealtime(): void {
    if (this.state.isRealtime) return;
    
    try {
      console.log('[EditorManager] 启动实时更新模式');
      // 实际实现可能需要调用文件监控服务
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
      // 实际实现可能需要停止文件监控服务
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
   * 在实时模式下，控制是否自动滚动到最新内容
   * @param enabled 是否启用自动滚动
   */
  public setAutoScroll(enabled: boolean): void {
    try {
      console.log(`[EditorManager] ${enabled ? '启用' : '禁用'}自动滚动`);
      // 实际实现可能需要设置编辑器的滚动行为
      // 这里只是更新状态并发出事件
      this.emit(EditorEvents.AUTO_SCROLL_CHANGED, enabled);
    } catch (error) {
      console.error('[EditorManager] 设置自动滚动失败:', error);
      this.setError(error as Error);
    }
  }
} 