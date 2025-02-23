/**
 * 文件编辑器状态管理类型定义
 */

import { FilterStats } from '../types/FileEditorTypes';

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

  // 错误状态
  errorRecoverable: boolean;

  // 方法
  setCurrentFile(file: string | null): void;
  setLoading(loading: boolean): void;
  setError(error: Error | null): void;
  setSaving(saving: boolean): void;
  setRefreshing(refreshing: boolean): void;
  setDirty(dirty: boolean): void;
  toggleRealtime(): void;
  toggleAutoScroll(): void;
  setFilterActive(active: boolean): void;
  updateFilterStats(stats: FilterStats): void;
  reset(): void;
  setErrorRecoverable(recoverable: boolean): void;
} 