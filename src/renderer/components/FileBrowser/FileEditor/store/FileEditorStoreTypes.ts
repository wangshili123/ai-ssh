/**
 * 文件编辑器状态管理类型定义
 */

import { FilterStats, RemoteFileInfo, RemoteSessionInfo } from '../types/FileEditorTypes';

// Store 类型
export interface IFileEditorStore {
  // 文件状态
  currentFile: string | null;
  isLoading: boolean;
  error: Error | null;

  // 编辑状态
  isSaving: boolean;
  isRefreshing: boolean;
  isDirty: boolean;

  // 实时模式状态
  isRealtime: boolean;
  isAutoScroll: boolean;

  // 过滤状态
  filterActive: boolean;
  filterStats: FilterStats;

  // 远程会话状态
  sessionInfo: RemoteSessionInfo | null;
  fileInfo: RemoteFileInfo | null;
  encoding: string;
  isConnected: boolean;
  cursorPosition: { line: number; column: number } | null;

  // 基本操作方法
  setCurrentFile(file: string | null): void;
  setLoading(loading: boolean): void;
  setError(error: Error | null): void;
  setSaving(saving: boolean): void;
  setRefreshing(refreshing: boolean): void;
  setDirty(dirty: boolean): void;
  setCursorPosition(position: { line: number; column: number } | null): void;

  // 实时模式方法
  toggleRealtime(): void;
  toggleAutoScroll(): void;

  // 过滤方法
  setFilterActive(active: boolean): void;
  updateFilterStats(stats: FilterStats): void;

  // 远程会话方法
  setSessionInfo(info: RemoteSessionInfo): void;
  setFileInfo(info: RemoteFileInfo): void;
  setEncoding(encoding: string): void;
  setConnected(connected: boolean): void;
  reconnect(): Promise<void>;
  checkConnection(): Promise<boolean>;

  // 状态重置
  reset(): void;
} 