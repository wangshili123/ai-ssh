/**
 * 文件编辑器状态栏类型定义
 */

import { EditorMode } from '../../types/FileEditorTypes';

/**
 * 文件编辑器状态栏属性接口
 */
export interface FileStatusBarProps {
  // 当前模式
  currentMode: EditorMode;
  // 光标位置
  cursorPosition?: {
    line: number;
    column: number;
  };
  // 文件信息
  fileInfo?: {
    path: string;
    size: number;
    encoding: string;
    modified?: Date;
  };
  // 浏览模式特有信息
  browseInfo?: {
    totalLines: number;
    loadedLines: number;
    filteredLines?: number;
  };
  // 编辑模式特有信息
  editInfo?: {
    totalLines: number;
    selectedText?: string;
    selectionRange?: {
      startLine: number;
      startColumn: number;
      endLine: number;
      endColumn: number;
    };
  };
  // 是否只读
  readOnly?: boolean;
  // 是否有未保存的修改
  isDirty?: boolean;
  // 是否启用自动滚动
  isAutoScroll?: boolean;
  // 自定义样式
  className?: string;
} 