/**
 * 双模式编辑器包装组件类型定义
 * 提供与现有FileEditorMain兼容的接口
 */

import { EditorMode } from '../../types/FileEditorTypes';

/**
 * 双模式编辑器包装组件属性接口
 */
export interface DualModeEditorWrapperProps {
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
    // 初始模式（默认根据文件大小自动选择）
    initialMode?: EditorMode;
  };
}

/**
 * 双模式编辑器包装组件引用接口
 * 保持与FileEditorMainRef兼容
 */
export interface DualModeEditorWrapperRef {
  // 是否有未保存的修改
  isDirty: boolean;
  // 保存文件
  save: () => Promise<void>;
  // 刷新文件
  refresh: () => Promise<void>;
  // 获取当前模式
  getCurrentMode: () => EditorMode;
} 