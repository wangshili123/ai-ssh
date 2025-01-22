import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { DataNode } from 'antd/es/tree';
import type { FileEntry } from '../../main/types/file';

interface TabState {
  currentPath: string;
  history: string[];
  historyIndex: number;
  treeData: DataNode[];
  expandedKeys: string[];
  fileList: FileEntry[];
  loading: boolean;
  connected: boolean;
}

interface FileBrowserState {
  tabs: Record<string, TabState>;
}

const initialState: FileBrowserState = {
  tabs: {}
};

const fileBrowserSlice = createSlice({
  name: 'fileBrowser',
  initialState,
  reducers: {
    initTab: (state: FileBrowserState, action: PayloadAction<string>) => {
      if (!state.tabs[action.payload]) {
        state.tabs[action.payload] = {
          currentPath: '/',
          history: ['/'],
          historyIndex: 0,
          treeData: [],
          expandedKeys: ['/'],
          fileList: [],
          loading: false,
          connected: false
        };
      }
    },
    setTreeData: (state: FileBrowserState, action: PayloadAction<{ tabId: string; data: DataNode[] }>) => {
      const tab = state.tabs[action.payload.tabId];
      if (tab) {
        tab.treeData = action.payload.data;
      }
    },
    setExpandedKeys: (state: FileBrowserState, action: PayloadAction<{ tabId: string; keys: string[] }>) => {
      const tab = state.tabs[action.payload.tabId];
      if (tab) {
        tab.expandedKeys = action.payload.keys;
      }
    },
    setFileList: (state: FileBrowserState, action: PayloadAction<{ tabId: string; files: FileEntry[] }>) => {
      const tab = state.tabs[action.payload.tabId];
      if (tab) {
        tab.fileList = action.payload.files;
      }
    },
    setCurrentPath: (state: FileBrowserState, action: PayloadAction<{ tabId: string; path: string }>) => {
      const tab = state.tabs[action.payload.tabId];
      if (tab) {
        tab.currentPath = action.payload.path;
        // 更新历史记录
        tab.history = [...tab.history.slice(0, tab.historyIndex + 1), action.payload.path];
        tab.historyIndex = tab.history.length - 1;
      }
    },
    setLoading: (state: FileBrowserState, action: PayloadAction<{ tabId: string; loading: boolean }>) => {
      const tab = state.tabs[action.payload.tabId];
      if (tab) {
        tab.loading = action.payload.loading;
      }
    },
    setConnected: (state: FileBrowserState, action: PayloadAction<{ tabId: string; connected: boolean }>) => {
      const tab = state.tabs[action.payload.tabId];
      if (tab) {
        tab.connected = action.payload.connected;
      }
    },
    navigateHistory: (state: FileBrowserState, action: PayloadAction<{ tabId: string; index: number }>) => {
      const tab = state.tabs[action.payload.tabId];
      if (tab && action.payload.index >= 0 && action.payload.index < tab.history.length) {
        tab.historyIndex = action.payload.index;
        tab.currentPath = tab.history[action.payload.index];
      }
    },
    removeTab: (state: FileBrowserState, action: PayloadAction<string>) => {
      delete state.tabs[action.payload];
    }
  }
});

export const {
  initTab,
  setTreeData,
  setExpandedKeys,
  setFileList,
  setCurrentPath,
  setLoading,
  setConnected,
  navigateHistory,
  removeTab
} = fileBrowserSlice.actions;

export default fileBrowserSlice.reducer; 