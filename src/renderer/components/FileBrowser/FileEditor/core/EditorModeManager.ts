/**
 * 编辑器模式管理器
 * 负责管理编辑器模式的切换和相关状态更新
 */

import { EventEmitter } from 'events';
import * as monaco from 'monaco-editor';
import { EditorEvents, EditorMode } from '../types/FileEditorTypes';

/**
 * 编辑器模式管理器类
 * 处理浏览模式和编辑模式之间的切换
 */
export class EditorModeManager extends EventEmitter {
  // 编辑器实例
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  // 当前模式
  private currentMode: EditorMode = EditorMode.BROWSE;
  // 是否正在切换模式
  private isSwitching: boolean = false;

  /**
   * 构造函数
   * @param editor Monaco编辑器实例
   * @param initialMode 初始模式
   */
  constructor(editor: monaco.editor.IStandaloneCodeEditor | null = null, initialMode: EditorMode = EditorMode.BROWSE) {
    super();
    this.editor = editor;
    this.currentMode = initialMode;
    
    // 如果编辑器实例可用，立即设置初始模式
    if (this.editor) {
      this.updateEditorOptions();
    }
  }

  /**
   * 设置编辑器实例
   * @param editor Monaco编辑器实例
   */
  public setEditor(editor: monaco.editor.IStandaloneCodeEditor): void {
    this.editor = editor;
    this.updateEditorOptions();
  }

  /**
   * 获取当前模式
   * @returns 当前编辑器模式
   */
  public getCurrentMode(): EditorMode {
    return this.currentMode;
  }

  /**
   * 切换到指定模式
   * @param targetMode 目标模式
   * @returns 切换是否成功
   */
  public async switchMode(targetMode: EditorMode): Promise<boolean> {
    // 如果已经是目标模式，直接返回成功
    if (this.currentMode === targetMode) {
      return true;
    }

    // 如果正在切换，拒绝新的切换请求
    if (this.isSwitching) {
      console.warn('[EditorModeManager] 模式切换正在进行中，请稍后再试');
      return false;
    }

    try {
      console.log(`[EditorModeManager] 开始切换到${targetMode}模式`);
      this.isSwitching = true;
      
      // 发出模式切换开始事件
      this.emit(EditorEvents.MODE_SWITCHING_STARTED, {
        fromMode: this.currentMode,
        toMode: targetMode
      });
      
      // 模拟切换延迟（可能的异步操作）
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // 更新当前模式
      this.currentMode = targetMode;
      
      // 更新编辑器选项
      this.updateEditorOptions();
      
      // 发出模式切换完成事件
      this.emit(EditorEvents.MODE_SWITCHING_COMPLETED, { mode: targetMode });
      
      console.log(`[EditorModeManager] 切换到${targetMode}模式完成`);
      this.isSwitching = false;
      return true;
    } catch (error) {
      console.error(`[EditorModeManager] 切换到${targetMode}模式失败:`, error);
      
      // 发出模式切换失败事件
      this.emit(EditorEvents.MODE_SWITCHING_FAILED, {
        fromMode: this.currentMode,
        toMode: targetMode,
        error
      });
      
      this.isSwitching = false;
      return false;
    }
  }

  /**
   * 更新编辑器选项以匹配当前模式
   */
  private updateEditorOptions(): void {
    if (!this.editor) return;
    
    // 设置只读状态
    const isReadOnly = this.currentMode === EditorMode.BROWSE;
    console.log(`[EditorModeManager] 设置编辑器只读状态: ${isReadOnly}`);
    
    this.editor.updateOptions({
      readOnly: isReadOnly,
      // 可以根据模式设置其他选项，如：
      // 浏览模式下可能想要禁用某些功能
      quickSuggestions: this.currentMode === EditorMode.EDIT
    });
  }

  /**
   * 设置当前模式（直接设置，不触发切换流程）
   * @param mode 新的编辑器模式
   */
  public setMode(mode: EditorMode): void {
    if (this.currentMode !== mode) {
      console.log(`[EditorModeManager] 直接设置模式为 ${mode}`);
      this.currentMode = mode;
      this.updateEditorOptions();
      this.emit(EditorEvents.MODE_SWITCHING_COMPLETED, { mode });
    }
  }

  /**
   * 销毁模式管理器
   */
  public dispose(): void {
    this.removeAllListeners();
    this.editor = null;
  }
} 