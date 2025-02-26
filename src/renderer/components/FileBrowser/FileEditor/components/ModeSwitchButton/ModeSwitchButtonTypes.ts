/**
 * 模式切换按钮类型定义
 */

import { EditorMode } from '../../types/FileEditorTypes';

/**
 * 模式切换按钮属性接口
 */
export interface ModeSwitchButtonProps {
  // 当前模式
  currentMode: EditorMode;
  // 文件大小（字节）
  fileSize?: number;
  // 是否禁用
  disabled?: boolean;
  // 模式切换回调
  onModeSwitch?: (mode: EditorMode, result: boolean) => void;
  // 自定义样式
  className?: string;
} 