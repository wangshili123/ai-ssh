import type { FileEntry } from '../../../../../main/types/file';
import type { SessionInfo } from '../../../../types';
import { ChildProcess } from 'child_process';

/**
 * 编辑器配置接口
 */
export interface EditorConfig {
  id: string;                    // 唯一标识符
  name: string;                  // 编辑器名称
  executablePath: string;        // 可执行文件路径
  arguments?: string;            // 启动参数
  icon?: string;                 // 编辑器图标路径
  isDefault?: boolean;           // 是否为默认编辑器
  addedTime: number;             // 添加时间戳
}

/**
 * 活动编辑器会话接口
 */
export interface ActiveEditorSession {
  id: string;                    // 会话唯一标识符
  file: FileEntry;               // 正在编辑的文件
  sessionInfo: SessionInfo;      // SSH会话信息
  tabId: string;                 // 标签页ID
  editor: EditorConfig;          // 使用的编辑器配置
  tempFilePath: string;          // 本地临时文件路径
  editorProcess?: ChildProcess;  // 编辑器进程
  lastModified: number;          // 最后修改时间
  isUploading: boolean;          // 是否正在上传
  uploadTimer?: NodeJS.Timeout;  // 上传定时器
}

/**
 * 外部编辑器设置接口
 */
export interface ExternalEditorSettings {
  editors: EditorConfig[];                           // 编辑器列表
  defaultEditor?: string;                            // 默认编辑器ID
  openMode: OpenMode;                                // 打开模式
  autoUpload: boolean;                               // 是否自动上传
  uploadDelay: number;                               // 上传延迟时间(ms)
  tempDirectory: string;                             // 临时文件目录
  fileAssociations: { [extension: string]: string }; // 文件扩展名关联
  rememberChoices: boolean;                          // 是否记住用户选择
}

/**
 * 打开模式类型
 */
export type OpenMode = 'ask' | 'default' | 'remember';

/**
 * 临时文件信息接口
 */
export interface TempFileInfo {
  sessionId: string;             // 会话ID
  localPath: string;             // 本地路径
  remotePath: string;            // 远程路径
  originalSize: number;          // 原始文件大小
  lastModified: number;          // 最后修改时间
  sessionInfo: SessionInfo;      // SSH会话信息
}

/**
 * 编辑器选择对话框属性
 */
export interface EditorSelectorDialogProps {
  visible: boolean;
  file: FileEntry;
  editors: EditorConfig[];
  onSelect: (editorId: string, remember: boolean) => void;
  onCancel: () => void;
}

/**
 * 编辑器配置对话框属性
 */
export interface EditorConfigDialogProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 添加编辑器对话框属性
 */
export interface AddEditorDialogProps {
  visible: boolean;
  editingEditor?: EditorConfig;
  onConfirm: (editor: Omit<EditorConfig, 'id' | 'addedTime'>) => void;
  onCancel: () => void;
}

/**
 * 编辑状态通知属性
 */
export interface EditingStatusNotificationProps {
  session: ActiveEditorSession;
  status: EditingStatus;
  onRetry?: () => void;
  onCancel?: () => void;
}

/**
 * 编辑状态枚举
 */
export enum EditingStatus {
  DOWNLOADING = 'downloading',   // 正在下载
  OPENING = 'opening',          // 正在打开编辑器
  EDITING = 'editing',          // 正在编辑
  UPLOADING = 'uploading',      // 正在上传
  COMPLETED = 'completed',      // 已完成
  ERROR = 'error'               // 出错
}

/**
 * 文件操作结果接口
 */
export interface FileOperationResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * 编辑器启动选项
 */
export interface EditorLaunchOptions {
  editor: EditorConfig;
  filePath: string;
  workingDirectory?: string;
}

/**
 * 文件监控选项
 */
export interface FileWatchOptions {
  session: ActiveEditorSession;
  onFileChange: (session: ActiveEditorSession) => Promise<void>;
  debounceDelay?: number;
}

/**
 * 编辑器检测结果
 */
export interface EditorDetectionResult {
  found: boolean;
  editor?: Omit<EditorConfig, 'id' | 'addedTime'>;
  error?: string;
}

/**
 * 文件关联设置
 */
export interface FileAssociation {
  extension: string;
  editorId: string;
  editorName: string;
}

/**
 * 文件打开方式偏好
 */
export interface FileOpenPreference {
  [extension: string]: 'builtin' | 'external'; // 文件扩展名 -> 编辑器类型
}

/**
 * 全局编辑器偏好设置
 */
export interface EditorPreferences {
  defaultOpenMode: 'builtin' | 'external'; // 默认打开方式
  fileOpenPreferences: FileOpenPreference; // 文件类型特定的偏好
}

/**
 * 上传进度信息
 */
export interface UploadProgress {
  sessionId: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
}

/**
 * 编辑器验证结果
 */
export interface EditorValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 临时文件清理选项
 */
export interface TempFileCleanupOptions {
  sessionId?: string;
  olderThan?: number;  // 清理多少毫秒前的文件
  force?: boolean;     // 强制清理
}

/**
 * 编辑器配置导入导出格式
 */
export interface EditorConfigExport {
  version: string;
  exportTime: number;
  editors: EditorConfig[];
  settings: Partial<ExternalEditorSettings>;
}

/**
 * 事件类型定义
 */
export interface ExternalEditorEvents {
  'editor-session-started': ActiveEditorSession;
  'editor-session-ended': string; // sessionId
  'file-uploaded': {
    sessionId: string;
    fileName: string;
    success: boolean;
    error?: string;
  };
  'editor-config-changed': ExternalEditorSettings;
  'temp-file-created': {
    sessionId: string;
    filePath: string;
  };
  'temp-file-deleted': {
    sessionId: string;
    filePath: string;
  };
}

/**
 * 错误类型枚举
 */
export enum ExternalEditorError {
  EDITOR_NOT_FOUND = 'EDITOR_NOT_FOUND',
  EDITOR_LAUNCH_FAILED = 'EDITOR_LAUNCH_FAILED',
  FILE_DOWNLOAD_FAILED = 'FILE_DOWNLOAD_FAILED',
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',
  TEMP_DIR_CREATE_FAILED = 'TEMP_DIR_CREATE_FAILED',
  FILE_WATCH_FAILED = 'FILE_WATCH_FAILED',
  CONFIG_SAVE_FAILED = 'CONFIG_SAVE_FAILED',
  INVALID_EDITOR_CONFIG = 'INVALID_EDITOR_CONFIG'
}

/**
 * 外部编辑器异常类
 */
export class ExternalEditorException extends Error {
  public readonly type: ExternalEditorError;
  public readonly details?: any;

  constructor(type: ExternalEditorError, message: string, details?: any) {
    super(message);
    this.name = 'ExternalEditorException';
    this.type = type;
    this.details = details;
  }
}

/**
 * 编辑器能力接口
 */
export interface EditorCapabilities {
  supportsMultipleFiles: boolean;    // 支持同时打开多个文件
  supportsWorkspace: boolean;         // 支持工作区
  supportsLineNumber: boolean;        // 支持跳转到指定行号
  supportsReadOnly: boolean;          // 支持只读模式
  supportsEncoding: boolean;          // 支持指定编码
}

/**
 * 默认编辑器能力
 */
export const DEFAULT_EDITOR_CAPABILITIES: EditorCapabilities = {
  supportsMultipleFiles: false,
  supportsWorkspace: false,
  supportsLineNumber: false,
  supportsReadOnly: false,
  supportsEncoding: false
};
