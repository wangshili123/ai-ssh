/**
 * 文件列表事件类型
 */
export enum FileListEvents {
  // 目录相关事件
  CHANGE_DIRECTORY = 'change-directory',
  
  // 编辑器相关事件
  OPEN_EDITOR = 'open-editor',
  
  // 错误事件
  ERROR = 'error'
} 