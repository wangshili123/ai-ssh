/**
 * 文件编辑器管理器
 * 负责编辑器核心功能和与 Monaco Editor 的集成
 */

import { EventEmitter } from 'events';
import * as monaco from 'monaco-editor';
import { EditorEvents, EditorErrorType } from '../types/FileEditorTypes';
import { ErrorManager, ErrorType } from './ErrorManager';

export interface EditorConfig {
  // 编辑器配置
  theme?: string;
  fontSize?: number;
  tabSize?: number;
  wordWrap?: 'on' | 'off';
  readOnly?: boolean;
  minimap?: boolean;
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

export class FileEditorManager extends EventEmitter {
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private currentModel: monaco.editor.ITextModel | null = null;
  private errorManager: ErrorManager;
  private config: EditorConfig;
  private disposables: monaco.IDisposable[] = [];
  private isDirty: boolean = false;

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
      ...config
    };
  }

  /**
   * 初始化编辑器
   */
  public initialize(container: HTMLElement): void {
    try {
      // 创建编辑器实例
      this.editor = monaco.editor.create(container, {
        value: '',
        language: 'plaintext',
        theme: this.config.theme,
        fontSize: this.config.fontSize,
        tabSize: this.config.tabSize,
        wordWrap: this.config.wordWrap,
        readOnly: this.config.readOnly,
        minimap: { enabled: this.config.minimap },
        scrollBeyondLastLine: false,
        automaticLayout: true
      });

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
    } catch (error) {
      this.errorManager.handleError(error as Error, ErrorType.OPERATION_FAILED);
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
  public setContent(content: string): void {
    try {
      if (!this.editor) {
        throw new Error('编辑器未初始化');
      }

      // 创建新的 model
      if (this.currentModel) {
        this.currentModel.dispose();
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
} 