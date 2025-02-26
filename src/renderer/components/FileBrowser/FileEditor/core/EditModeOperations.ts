/**
 * 编辑模式操作管理
 * 负责管理编辑器的操作，如撤销、重做、光标移动等
 */

import { EditorEvents, EditorPosition, EditorSelection } from '../types/FileEditorTypes';

/**
 * 编辑模式操作管理器
 * 负责处理编辑操作，如撤销、重做、光标移动和选择
 */
export class EditModeOperations {
  // 编辑模式引用
  private editMode: any;

  /**
   * 构造函数
   * @param editMode 编辑模式引用
   */
  constructor(editMode: any) {
    this.editMode = editMode;
  }

  /**
   * 更新内容
   * @param content 新的文件内容
   */
  public updateContent(content: string): void {
    const state = this.editMode.getState();
    if (!state.isLoaded) {
      return;
    }
    
    // 记录当前内容到撤销栈
    state.undoStack.push(this.editMode.getContent());
    
    // 清空重做栈
    state.redoStack = [];
    
    // 更新内容
    this.editMode.contentManager.updateContent(content);
  }

  /**
   * 撤销操作
   */
  public undo(): void {
    const state = this.editMode.getState();
    if (!state.isLoaded || state.undoStack.length === 0) {
      return;
    }
    
    // 将当前内容推入重做栈
    state.redoStack.push(this.editMode.getContent());
    
    // 从撤销栈中取出上一个内容
    const previousContent = state.undoStack.pop() as string;
    
    // 更新内容
    this.editMode.contentManager.updateContent(previousContent);
  }

  /**
   * 重做操作
   */
  public redo(): void {
    const state = this.editMode.getState();
    if (!state.isLoaded || state.redoStack.length === 0) {
      return;
    }
    
    // 将当前内容推入撤销栈
    state.undoStack.push(this.editMode.getContent());
    
    // 从重做栈中取出下一个内容
    const nextContent = state.redoStack.pop() as string;
    
    // 更新内容
    this.editMode.contentManager.updateContent(nextContent);
  }

  /**
   * 更新光标位置
   * @param position 新的光标位置
   */
  public updateCursorPosition(position: EditorPosition): void {
    const state = this.editMode.getState();
    if (!state.isLoaded) {
      return;
    }
    
    state.cursorPosition = position;
    this.editMode.emit(EditorEvents.CURSOR_MOVED, position);
  }

  /**
   * 更新选择区域
   * @param selection 新的选择区域
   */
  public updateSelection(selection: EditorSelection | null): void {
    const state = this.editMode.getState();
    if (!state.isLoaded) {
      return;
    }
    
    state.selection = selection;
    this.editMode.emit(EditorEvents.SELECTION_CHANGED, selection);
  }
} 