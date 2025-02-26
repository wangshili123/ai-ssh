/**
 * 双模式编辑器包装器类型定义
 */

import { TabInfo } from '../../types/FileEditorTypes';

/**
 * 双模式编辑器包装器属性
 */
export interface DualModeEditorWrapperProps {
  /**
   * 文件路径
   */
  filePath: string;
  
  /**
   * 文件内容
   */
  content: string;
  
  /**
   * 文件编码
   */
  encoding: string;
  
  /**
   * 标签信息
   */
  tabInfo: TabInfo;
  
  /**
   * 更新标签回调
   */
  updateTab: (tabId: string, updates: Partial<TabInfo>) => void;
  
  /**
   * 保存回调
   */
  onSave: (content: string) => Promise<void>;
  
  /**
   * 关闭回调
   */
  onClose: () => void;
}

/**
 * 双模式编辑器包装器引用
 */
export interface DualModeEditorWrapperRef {
  /**
   * 获取当前是否已修改
   */
  isDirty: boolean;
  
  /**
   * 保存文件
   */
  save: () => Promise<void>;
  
  /**
   * 刷新文件
   */
  refresh: () => Promise<void>;
} 