/**
 * 编辑模式工具类
 * 提供各种辅助功能和查询方法
 */

import { EditorSelection } from '../types/FileEditorTypes';

/**
 * 编辑模式工具类
 * 提供各种辅助功能和查询方法
 */
export class EditModeUtils {
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
   * 获取文件总行数
   * @returns 文件的总行数
   */
  public getTotalLines(): number {
    const state = this.editMode.getState();
    const content = this.editMode.getContent();
    
    if (!state.isLoaded || !content) {
      return 0;
    }
    
    // 通过计算换行符的数量来确定行数
    const newlineMatches = content.match(/\n/g);
    const newlineCount = newlineMatches ? newlineMatches.length : 0;
    
    // 如果文件最后没有换行符，需要加1
    // 如果文件为空，返回0
    return content.length === 0 ? 0 : newlineCount + 1;
  }

  /**
   * 获取当前选中的文本
   * @returns 选中的文本，如果没有选择则返回undefined
   */
  public getSelectedText(): string | undefined {
    const state = this.editMode.getState();
    const content = this.editMode.getContent();
    
    if (!state.isLoaded || !state.selection) {
      return undefined;
    }
    
    try {
      // 如果是使用Monaco编辑器，可以直接获取选中文本
      const editor = this.editMode.getEditor();
      if (editor) {
        const selection = editor.getSelection();
        if (selection) {
          return editor.getModel()?.getValueInRange(selection);
        }
      }
      
      // 如果没有编辑器实例或获取失败，尝试从内容中提取
      if (state.selection) {
        const { startLine, startColumn, endLine, endColumn } = state.selection;
        if (startLine === endLine) {
          // 单行选择
          const lines = content.split('\n');
          if (lines.length >= startLine) {
            const line = lines[startLine - 1];
            return line.substring(startColumn - 1, endColumn - 1);
          }
        } else {
          // 多行选择
          const lines = content.split('\n');
          let selectedText = '';
          
          for (let i = startLine - 1; i < endLine && i < lines.length; i++) {
            const line: string = lines[i];
            if (i === startLine - 1) {
              // 第一行
              selectedText += line.substring(startColumn - 1) + '\n';
            } else if (i === endLine - 1) {
              // 最后一行
              selectedText += line.substring(0, endColumn - 1);
            } else {
              // 中间行
              selectedText += line + '\n';
            }
          }
          
          return selectedText;
        }
      }
    } catch (error) {
      console.error('获取选中文本失败:', error);
    }
    
    return undefined;
  }

  /**
   * 获取选择区域
   * @returns 选择的范围，如果没有选择则返回undefined
   */
  public getSelectionRange(): EditorSelection | undefined {
    const state = this.editMode.getState();
    
    if (!state.isLoaded) {
      return undefined;
    }
    
    return state.selection || undefined;
  }

  /**
   * 计算文件的行信息
   * @returns 行信息对象，包含总行数、空行数、非空行数等
   */
  public getLineStats(): { total: number; empty: number; nonEmpty: number } {
    const content = this.editMode.getContent();
    
    if (!content) {
      return { total: 0, empty: 0, nonEmpty: 0 };
    }
    
    const lines = content.split('\n');
    const total = lines.length;
    const empty = lines.filter((line: string) => line.trim() === '').length;
    const nonEmpty = total - empty;
    
    return { total, empty, nonEmpty };
  }

  /**
   * 获取文件的字符统计
   * @returns 字符统计对象，包含总字符数、非空白字符数等
   */
  public getCharStats(): { total: number; nonWhitespace: number } {
    const content = this.editMode.getContent();
    
    if (!content) {
      return { total: 0, nonWhitespace: 0 };
    }
    
    const total = content.length;
    const nonWhitespace = content.replace(/\s/g, '').length;
    
    return { total, nonWhitespace };
  }

  /**
   * 检查文件是否为二进制文件
   * 通过检测是否包含大量不可打印字符来判断
   * @returns 是否为二进制文件
   */
  public isBinaryFile(): boolean {
    const content = this.editMode.getContent();
    
    if (!content || content.length === 0) {
      return false;
    }
    
    // 检查前1000个字符中不可打印字符的比例
    const sampleSize = Math.min(1000, content.length);
    const sample = content.substring(0, sampleSize);
    
    // 计算不可打印字符的数量
    let nonPrintableCount = 0;
    for (let i = 0; i < sample.length; i++) {
      const charCode = sample.charCodeAt(i);
      // 排除常见的控制字符（如换行、制表符等）
      if ((charCode < 32 || charCode > 126) && 
          charCode !== 9 && charCode !== 10 && charCode !== 13) {
        nonPrintableCount++;
      }
    }
    
    // 如果不可打印字符比例超过10%，认为是二进制文件
    return (nonPrintableCount / sampleSize) > 0.1;
  }
} 