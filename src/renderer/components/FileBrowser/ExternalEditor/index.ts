// 外部编辑器功能入口文件

// 配置管理 - 使用统一的配置管理器
export { UnifiedEditorConfigManager, unifiedEditorConfig } from './config/UnifiedEditorConfig';
// 保持向后兼容的别名
export { unifiedEditorConfig as externalEditorConfig } from './config/UnifiedEditorConfig';
export { unifiedEditorConfig as editorPreferenceManager } from './config/UnifiedEditorConfig';

// 核心管理器
export { ExternalEditorManager, externalEditorManager } from './core/ExternalEditorManager';
export { TempFileManager } from './core/TempFileManager';
export { FileWatcher } from './core/FileWatcher';

// 组件
export { EditorConfigDialog } from './components/EditorConfigDialog';
export { AddEditorDialog } from './components/AddEditorDialog';
export { EditorSelectorDialog } from './components/EditorSelectorDialog';

// 类型定义
export type {
  EditorConfig,
  ActiveEditorSession,
  ExternalEditorSettings,
  OpenMode,
  TempFileInfo,
  EditorSelectorDialogProps,
  EditorConfigDialogProps,
  AddEditorDialogProps,
  EditingStatus,
  FileOperationResult,
  EditorLaunchOptions,
  FileWatchOptions,
  EditorDetectionResult,
  FileAssociation,
  FileOpenPreference,
  EditorPreferences,
  UploadProgress,
  EditorValidationResult,
  TempFileCleanupOptions,
  EditorConfigExport,
  ExternalEditorEvents,
  ExternalEditorError,
  EditorCapabilities
} from './types/ExternalEditorTypes';

export { 
  ExternalEditorException,
  DEFAULT_EDITOR_CAPABILITIES,
  EditingStatus
} from './types/ExternalEditorTypes';
