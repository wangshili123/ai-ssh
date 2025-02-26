/**
 * 编辑模式内容管理
 * 负责管理编辑器的内容状态
 */

import { EditorEvents } from '../types/FileEditorTypes';

/**
 * 编辑模式内容管理器
 * 负责管理文件内容、原始内容和修改状态
 */
export class EditModeContent {
  // 原始内容
  private originalContent: string = '';
  
  // 当前修改后的内容
  private modifiedContent: string = '';
  
  // 是否已修改
  private isContentModified: boolean = false;
  
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
   * 设置内容
   * @param content 当前内容
   * @param originalContent 原始内容
   */
  public setContent(content: string, originalContent: string): void {
    this.modifiedContent = content;
    this.originalContent = originalContent;
    this.isContentModified = content !== originalContent;
  }

  /**
   * 更新内容
   * @param content 新内容
   */
  public updateContent(content: string): void {
    this.modifiedContent = content;
    this.isContentModified = this.modifiedContent !== this.originalContent;
    
    // 发出内容变更事件
    this.editMode.emit(EditorEvents.CONTENT_CHANGED, {
      content: this.modifiedContent,
      isModified: this.isContentModified
    });
  }

  /**
   * 标记内容已保存
   * 将当前内容设置为原始内容
   */
  public markAsSaved(): void {
    this.originalContent = this.modifiedContent;
    this.isContentModified = false;
  }

  /**
   * 获取当前内容
   * @returns 当前内容
   */
  public getContent(): string {
    return this.modifiedContent;
  }

  /**
   * 获取原始内容
   * @returns 原始内容
   */
  public getOriginalContent(): string {
    return this.originalContent;
  }

  /**
   * 检查内容是否已修改
   * @returns 是否已修改
   */
  public isModified(): boolean {
    return this.isContentModified;
  }
} 