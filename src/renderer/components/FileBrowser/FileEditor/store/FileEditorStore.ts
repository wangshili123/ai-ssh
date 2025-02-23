/**
 * 文件编辑器状态管理
 */

import { makeAutoObservable } from 'mobx';
import { createContext, useContext } from 'react';
import { FilterStats } from '../types/FileEditorTypes';
import { IFileEditorStore } from './FileEditorStoreTypes';

export class FileEditorStore implements IFileEditorStore {
  // 文件状态
  currentFile: string | null = null;
  isLoading: boolean = false;
  error: Error | null = null;

  // 编辑状态
  isSaving: boolean = false;
  isRefreshing: boolean = false;
  isDirty: boolean = false;

  // 实时模式状态
  isRealtime: boolean = false;
  isAutoScroll: boolean = true;

  // 过滤状态
  filterActive: boolean = false;
  filterStats: FilterStats = {
    matchedLines: 0,
    totalLines: 0,
    processedSize: 0
  };

  // 错误状态
  errorRecoverable: boolean = false;

  constructor() {
    makeAutoObservable(this);
  }

  // 文件操作
  setCurrentFile = (file: string | null) => {
    this.currentFile = file;
  };

  setLoading = (loading: boolean) => {
    this.isLoading = loading;
  };

  setError = (error: Error | null) => {
    this.error = error;
  };

  setErrorRecoverable = (recoverable: boolean) => {
    this.errorRecoverable = recoverable;
  };

  // 编辑操作
  setSaving = (saving: boolean) => {
    this.isSaving = saving;
  };

  setRefreshing = (refreshing: boolean) => {
    this.isRefreshing = refreshing;
  };

  setDirty = (dirty: boolean) => {
    this.isDirty = dirty;
  };

  // 实时模式操作
  toggleRealtime = () => {
    this.isRealtime = !this.isRealtime;
  };

  toggleAutoScroll = () => {
    this.isAutoScroll = !this.isAutoScroll;
  };

  // 过滤操作
  setFilterActive = (active: boolean) => {
    this.filterActive = active;
  };

  updateFilterStats = (stats: FilterStats) => {
    this.filterStats = stats;
  };

  // 重置状态
  reset = () => {
    this.currentFile = null;
    this.isLoading = false;
    this.error = null;
    this.isSaving = false;
    this.isRefreshing = false;
    this.isDirty = false;
    this.isRealtime = false;
    this.isAutoScroll = true;
    this.filterActive = false;
    this.filterStats = {
      matchedLines: 0,
      totalLines: 0,
      processedSize: 0
    };
  };
}

// 创建 Context
export const EditorStoreContext = createContext<FileEditorStore | null>(null);

// 创建 Hook
export const useEditorStore = () => {
  const store = useContext(EditorStoreContext);
  if (!store) {
    throw new Error('useEditorStore must be used within an EditorStoreProvider');
  }
  return store;
}; 