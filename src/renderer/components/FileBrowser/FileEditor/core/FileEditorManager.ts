/**
 * 文件编辑器管理器
 * 负责编辑器核心功能和与 Monaco Editor 的集成
 */

import { EventEmitter } from 'events';
import * as monaco from 'monaco-editor';
import { EditorEvents, EditorErrorType, RemoteFileInfo, EncodingType } from '../types/FileEditorTypes';
import { ErrorManager, ErrorType } from './ErrorManager';
import { sftpService } from '../../../../services/sftp';
import { detectEncoding, isValidEncoding } from '../utils/FileEncodingUtils';

// 配置 Monaco Editor 的 worker
self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    return '/vs/base/worker/workerMain.js';
  }
};

export interface EditorConfig {
  // 编辑器配置
  theme?: string;
  fontSize?: number;
  tabSize?: number;
  wordWrap?: 'on' | 'off';
  readOnly?: boolean;
  minimap?: boolean;
  encoding?: string;
}

export interface EditorPosition {
  line: number;
  column: number;
}

export interface EditorSelection {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

// 语言映射配置
const LANGUAGE_MAP: { [key: string]: string } = {
  // 脚本语言
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'py': 'python',
  'rb': 'ruby',
  'php': 'php',
  'pl': 'perl',
  'lua': 'lua',
  'sh': 'shell',
  'bash': 'shell',
  'zsh': 'shell',
  'ps1': 'powershell',

  // 标记语言
  'html': 'html',
  'htm': 'html',
  'xml': 'xml',
  'xaml': 'xml',
  'svg': 'xml',
  'md': 'markdown',
  'markdown': 'markdown',
  'mdown': 'markdown',

  // 样式表
  'css': 'css',
  'scss': 'scss',
  'sass': 'scss',
  'less': 'less',

  // 配置文件
  'json': 'json',
  'jsonc': 'jsonc',
  'yaml': 'yaml',
  'yml': 'yaml',
  'toml': 'toml',
  'ini': 'ini',
  'conf': 'ini',
  'config': 'ini',

  // 编译语言
  'java': 'java',
  'cpp': 'cpp',
  'c': 'cpp',
  'h': 'cpp',
  'hpp': 'cpp',
  'cc': 'cpp',
  'cs': 'csharp',
  'go': 'go',
  'rs': 'rust',
  'swift': 'swift',
  'kt': 'kotlin',
  'scala': 'scala',

  // 数据库
  'sql': 'sql',
  'mysql': 'sql',
  'pgsql': 'sql',
  'plsql': 'sql',

  // 其他
  'log': 'log',
  'txt': 'plaintext',
  'env': 'plaintext',
  'properties': 'properties',
  'gradle': 'groovy',
  'dockerfile': 'dockerfile',
  'makefile': 'makefile',
  'gitignore': 'ignore',
  'editorconfig': 'editorconfig'
};

export class FileEditorManager extends EventEmitter {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private currentModel: monaco.editor.ITextModel | null = null;
  private errorManager: ErrorManager;
  private config: EditorConfig;
  private disposables: monaco.IDisposable[] = [];
  private isDirty: boolean = false;
  private sessionId: string = '';
  private filePath: string = '';
  private fileInfo: RemoteFileInfo | null = null;

  constructor(errorManager: ErrorManager, config: EditorConfig = {}) {
    super();
    this.errorManager = errorManager;
    this.config = {
      theme: 'vs-dark',
      fontSize: 14,
      tabSize: 2,
      wordWrap: 'on',
      readOnly: false,
      minimap: true,
      encoding: 'UTF-8',
      ...config
    };
  }

  /**
   * 获取文件的语言类型
   */
  private getLanguage(filePath: string): string {
    // 获取文件扩展名
    let extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    // 处理特殊文件名
    if (!extension || extension === filePath.toLowerCase()) {
      const filename = filePath.split('/').pop()?.toLowerCase() || '';
      switch (filename) {
        case 'dockerfile':
          return 'dockerfile';
        case 'makefile':
          return 'makefile';
        case '.gitignore':
          return 'ignore';
        case '.editorconfig':
          return 'editorconfig';
        case '.env':
          return 'properties';
        default:
          return 'plaintext';
      }
    }

    // 从映射表中获取语言类型
    return LANGUAGE_MAP[extension] || 'plaintext';
  }

  /**
   * 初始化编辑器
   */
  public async initialize(container: HTMLElement, sessionId: string, filePath: string): Promise<void> {
    try {
      this.sessionId = sessionId;
      this.filePath = filePath;

      // 获取文件信息
      const stats = await sftpService.stat(this.sessionId, this.filePath);
      this.fileInfo = {
        size: stats.size,
        modifyTime: stats.modifyTime,
        isDirectory: stats.isDirectory,
        permissions: stats.permissions,
        encoding: this.config.encoding || 'UTF-8',
        isPartiallyLoaded: false
      };

      // 创建编辑器实例
      this.editor = monaco.editor.create(container, {
        value: '',
        language: this.getLanguage(filePath),
        theme: this.config.theme,
        fontSize: this.config.fontSize,
        tabSize: this.config.tabSize,
        wordWrap: this.config.wordWrap,
        readOnly: this.config.readOnly,
        minimap: { enabled: this.config.minimap },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        formatOnPaste: true,
        formatOnType: true
      });

      // 如果文件不为空，加载文件内容
      if (stats.size > 0) {
        // 加载文件内容
        const result = await sftpService.readFile(
          this.sessionId,
          this.filePath,
          0,
          -1,
          this.config.encoding as BufferEncoding
        );

        // 创建新的 model
        if (this.currentModel) {
          this.currentModel.dispose();
        }

        this.currentModel = monaco.editor.createModel(
          result.content,
          this.getLanguage(filePath)
        );
        this.editor.setModel(this.currentModel);
      } else {
        // 对于空文件，创建一个空的 model
        this.currentModel = monaco.editor.createModel(
          '',
          this.getLanguage(filePath)
        );
        this.editor.setModel(this.currentModel);
      }

      // 添加快捷键处理
      this.addKeybindings();

      // 监听内容变化
      this.disposables.push(
        this.editor.onDidChangeModelContent(() => {
          this.isDirty = true;
          this.emit(EditorEvents.CONTENT_CHANGED);
        })
      );

      // 监听光标位置变化
      this.disposables.push(
        this.editor.onDidChangeCursorPosition((e) => {
          this.emit('cursorChanged', {
            line: e.position.lineNumber,
            column: e.position.column
          });
        })
      );

      // 监听选择变化
      this.disposables.push(
        this.editor.onDidChangeCursorSelection((e) => {
          this.emit('selectionChanged', {
            startLine: e.selection.startLineNumber,
            startColumn: e.selection.startColumn,
            endLine: e.selection.endLineNumber,
            endColumn: e.selection.endColumn
          });
        })
      );

      this.emit(EditorEvents.FILE_LOADED, this.currentModel.getValue());
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
      throw error;
    }
  }

  /**
   * 加载文件信息
   */
  private async loadFileInfo(): Promise<void> {
    try {
      const stats = await sftpService.stat(this.sessionId, this.filePath);
      this.fileInfo = {
        size: stats.size,
        modifyTime: stats.modifyTime,
        isDirectory: stats.isDirectory,
        permissions: stats.permissions,
        encoding: this.config.encoding || 'UTF-8',
        isPartiallyLoaded: false
      };
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.FILE_NOT_FOUND);
    }
  }

  /**
   * 添加快捷键绑定
   */
  private addKeybindings(): void {
    if (!this.editor) return;

    // 添加保存快捷键 (Ctrl+S)
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      this.emit(EditorEvents.SAVE_REQUESTED);
    });

    // 添加搜索快捷键 (Ctrl+F)
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      this.emit(EditorEvents.SEARCH_REQUESTED);
    });

    // 添加撤销快捷键 (Ctrl+Z)
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, () => {
      this.undo();
    });

    // 添加重做快捷键 (Ctrl+Y 或 Ctrl+Shift+Z)
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, () => {
      this.redo();
    });
    this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, () => {
      this.redo();
    });
  }

  /**
   * 设置编辑器内容
   */
  public async setContent(content: string): Promise<void> {
    try {
      if (!this.editor) {
        throw new Error('编辑器未初始化');
      }

      // 创建新的 model
      if (this.currentModel) {
        this.currentModel.dispose();
      }

      // 检测文件编码
      const buffer = Buffer.from(content);
      const detectedEncoding = detectEncoding(buffer);
      if (detectedEncoding && detectedEncoding !== this.config.encoding) {
        this.config.encoding = detectedEncoding;
        this.emit(EditorEvents.ENCODING_CHANGED, detectedEncoding);
      }

      this.currentModel = monaco.editor.createModel(content, 'plaintext');
      this.editor.setModel(this.currentModel);
      this.isDirty = false;

      this.emit(EditorEvents.CONTENT_CHANGED);
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
    }
  }

  /**
   * 保存文件内容
   */
  public async save(): Promise<void> {
    try {
      if (!this.editor || !this.currentModel) {
        throw new Error('编辑器未初始化');
      }

      const content = this.currentModel.getValue();
      await sftpService.writeFile(
        this.sessionId,
        this.filePath,
        content,
        this.config.encoding as BufferEncoding
      );

      this.isDirty = false;
      this.emit(EditorEvents.FILE_SAVED);

      // 更新文件信息
      await this.loadFileInfo();
    } catch (error) {
      if ((error as Error).message.includes('ECONNRESET')) {
        this.emit(EditorEvents.CONNECTION_LOST);
        this.errorManager.handleError(error as Error, ErrorType.CONNECTION_LOST);
      } else {
        this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
      }
    }
  }

  /**
   * 获取编辑器内容
   */
  public getContent(): string {
    if (!this.editor || !this.currentModel) {
      return '';
    }
    return this.currentModel.getValue();
  }

  /**
   * 插入内容
   */
  public insert(text: string, position?: EditorPosition): void {
    try {
      if (!this.editor || !this.currentModel) {
        throw new Error('编辑器未初始化');
      }

      const pos = position ? {
        lineNumber: position.line,
        column: position.column
      } : this.editor.getPosition();

      if (pos) {
        this.editor.executeEdits('', [{
          range: new monaco.Range(
            pos.lineNumber,
            pos.column,
            pos.lineNumber,
            pos.column
          ),
          text: text,
          forceMoveMarkers: true
        }]);
      }
    } catch (error) {
        this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
    }
  }

  /**
   * 替换选中内容
   */
  public replace(text: string): void {
    try {
      if (!this.editor || !this.currentModel) {
        throw new Error('编辑器未初始化');
      }

      const selection = this.editor.getSelection();
      if (selection) {
        this.editor.executeEdits('', [{
          range: selection,
          text: text,
          forceMoveMarkers: true
        }]);
      }
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
    }
  }

  /**
   * 获取当前位置
   */
  public getPosition(): EditorPosition | null {
    if (!this.editor) {
      return null;
    }

    const position = this.editor.getPosition();
    if (!position) {
      return null;
    }

    return {
      line: position.lineNumber,
      column: position.column
    };
  }

  /**
   * 设置位置
   */
  public setPosition(position: EditorPosition): void {
    if (!this.editor) {
      return;
    }

    this.editor.setPosition({
      lineNumber: position.line,
      column: position.column
    });
  }

  /**
   * 获取选中内容
   */
  public getSelection(): EditorSelection | null {
    if (!this.editor) {
      return null;
    }

    const selection = this.editor.getSelection();
    if (!selection) {
      return null;
    }

    return {
      startLine: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLine: selection.endLineNumber,
      endColumn: selection.endColumn
    };
  }

  /**
   * 设置选中范围
   */
  public setSelection(selection: EditorSelection): void {
    if (!this.editor) {
      return;
    }

    this.editor.setSelection(new monaco.Range(
      selection.startLine,
      selection.startColumn,
      selection.endLine,
      selection.endColumn
    ));
  }

  /**
   * 撤销
   */
  public undo(): void {
    if (this.editor) {
      this.editor.trigger('keyboard', 'undo', null);
    }
  }

  /**
   * 重做
   */
  public redo(): void {
    if (this.editor) {
      this.editor.trigger('keyboard', 'redo', null);
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<EditorConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.editor) {
      this.editor.updateOptions({
        theme: this.config.theme,
        fontSize: this.config.fontSize,
        tabSize: this.config.tabSize,
        wordWrap: this.config.wordWrap,
        readOnly: this.config.readOnly,
        minimap: { enabled: this.config.minimap }
      });
    }
  }

  /**
   * 检查是否有未保存的更改
   */
  public hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  /**
   * 标记已保存状态
   */
  public markAsSaved(): void {
    this.isDirty = false;
  }

  /**
   * 销毁编辑器
   */
  public destroy(): void {
    // 清理所有事件监听
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];

    // 清理 model
    if (this.currentModel) {
      this.currentModel.dispose();
      this.currentModel = null;
    }

    // 销毁编辑器
    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }

    this.removeAllListeners();
  }

  /**
   * 设置文件编码
   */
  public setEncoding(encoding: string): void {
    if (this.config.encoding === encoding) return;

    this.config.encoding = encoding;
    this.emit(EditorEvents.ENCODING_CHANGED, encoding);

    // 如果有内容，重新加载以使用新编码
    if (this.currentModel) {
      const content = this.currentModel.getValue();
      this.setContent(content);
    }
  }

  /**
   * 获取文件信息
   */
  public getFileInfo(): RemoteFileInfo | null {
    return this.fileInfo;
  }

  /**
   * 检查连接状态
   */
  public async checkConnection(): Promise<boolean> {
    try {
      await sftpService.stat(this.sessionId, this.filePath);
      return true;
    } catch (error) {
      this.emit(EditorEvents.CONNECTION_LOST);
      return false;
    }
  }

  /**
   * 重新加载文件
   */
  public async reload(): Promise<void> {
    try {
      const result = await sftpService.readFile(this.sessionId, this.filePath);
      await this.setContent(result.content);
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
    }
  }

  /**
   * 执行编辑器命令
   */
  public executeCommand(command: string): void {
    if (!this.editor) return;

    switch (command) {
      case 'copy':
        this.editor.trigger('keyboard', 'editor.action.clipboardCopyAction', null);
        break;
      case 'paste':
        this.editor.trigger('keyboard', 'editor.action.clipboardPasteAction', null);
        break;
      case 'cut':
        this.editor.trigger('keyboard', 'editor.action.clipboardCutAction', null);
        break;
      case 'selectAll':
        this.editor.trigger('keyboard', 'editor.action.selectAll', null);
        break;
    }
  }

  /**
   * 检查是否有选中文本
   */
  public hasSelection(): boolean {
    if (!this.editor) return false;
    const selection = this.editor.getSelection();
    return selection ? !selection.isEmpty() : false;
  }
} 