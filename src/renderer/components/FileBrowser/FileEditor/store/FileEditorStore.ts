/**
 * 文件编辑器状态管理
 */

import { makeAutoObservable } from 'mobx';
import { createContext, useContext } from 'react';
import { FilterStats, RemoteFileInfo, RemoteSessionInfo } from '../types/FileEditorTypes';
import { IFileEditorStore } from './FileEditorStoreTypes';
import { sftpService } from '../../../../services/sftp';

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

  // 远程会话状态
  sessionInfo: RemoteSessionInfo | null = null;
  fileInfo: RemoteFileInfo | null = null;
  encoding: string = 'UTF-8';
  isConnected: boolean = false;
  cursorPosition: { line: number; column: number } | null = null;

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

  // 远程会话操作
  setSessionInfo = (info: RemoteSessionInfo) => {
    this.sessionInfo = info;
    this.isConnected = info.isConnected;
  };

  setConnected = (connected: boolean) => {
    this.isConnected = connected;
  };

  setFileInfo = (info: RemoteFileInfo) => {
    this.fileInfo = info;
    this.encoding = info.encoding;
  };

  setCursorPosition = (position: { line: number; column: number } | null) => {
    this.cursorPosition = position;
  };

  setEncoding = (encoding: string) => {
    this.encoding = encoding;
  };

  reconnect = async (): Promise<void> => {
    if (!this.sessionInfo) return;

    try {
      this.isLoading = true;
      await sftpService.close(this.sessionInfo.sessionId);
      // 重新连接的逻辑将由 sftpService 自动处理
      this.isConnected = true;
      this.error = null;
    } catch (error) {
      this.error = error as Error;
      this.isConnected = false;
    } finally {
      this.isLoading = false;
    }
  };

  checkConnection = async (): Promise<boolean> => {
    if (!this.sessionInfo) return false;

    try {
      const stats = await sftpService.stat(this.sessionInfo.sessionId, this.currentFile || '');
      this.isConnected = true;
      return true;
    } catch (error) {
      this.isConnected = false;
      return false;
    }
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
    this.sessionInfo = null;
    this.fileInfo = null;
    this.encoding = 'UTF-8';
    this.isConnected = false;
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