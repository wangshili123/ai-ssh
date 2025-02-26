/**
 * 双模式编辑器类型定义
 */

import { EditorMode, RemoteFileInfo } from '../../types/FileEditorTypes';

/**
 * 双模式编辑器属性接口
 */
export interface DualModeEditorProps {
  // 文件路径
  filePath: string;
  // 会话ID
  sessionId: string;
  // 标签ID
  tabId: string;
  // 初始配置
  initialConfig?: {
    // 是否只读
    readOnly?: boolean;
    // 编码
    encoding?: string;
    // 初始模式
    initialMode?: EditorMode;
    // 是否自动选择模式（根据文件大小）
    autoSelectMode?: boolean;
    // 模式切换阈值（字节）
    modeSwitchThreshold?: number;
  };
}

/**
 * 双模式编辑器引用接口
 */
export interface DualModeEditorRef {
  // 是否有未保存的修改
  isDirty: boolean;
  // 保存文件
  save: () => Promise<boolean>;
  // 刷新文件
  refresh: () => Promise<boolean>;
  // 获取当前模式
  getCurrentMode: () => EditorMode;
  // 切换模式
  switchMode: (mode: EditorMode) => Promise<boolean>;
  // 获取文件信息
  getFileInfo: () => RemoteFileInfo | null;
}

/**
 * 编辑器状态接口
 */
export interface EditorState {
  // 当前模式
  currentMode: EditorMode;
  // 是否正在加载
  isLoading: boolean;
  // 是否有未保存的修改
  isDirty: boolean;
  // 是否只读
  readOnly: boolean;
  // 当前编码
  encoding: string;
  // 是否实时模式（浏览模式）
  isRealtime: boolean;
  // 是否自动滚动（浏览模式）
  isAutoScroll: boolean;
  // 光标位置
  cursorPosition: {
    line: number;
    column: number;
  };
  // 文件信息
  fileInfo: RemoteFileInfo | null;
  // 错误信息
  error: string | null;
} 