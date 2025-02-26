import { makeObservable, observable, action } from 'mobx';
import { createContext, useContext } from 'react';
import { EventEmitter } from 'events';
import { EditorMode } from '../types/FileEditorTypes';

export interface TabInfo {
  id: string;
  filePath: string;
  sessionId: string;
  title: string;
  isActive: boolean;
  mode?: EditorMode;
}

export interface GlobalSettings {
  theme: 'light' | 'dark';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  showLineNumbers: boolean;
}

export class EditorTabStore extends EventEmitter {
  // 标签管理
  tabs = new Map<string, TabInfo>();
  activeTabId: string | null = null;

  // 全局设置
  settings: GlobalSettings = {
    theme: 'light',
    fontSize: 14,
    tabSize: 2,
    wordWrap: true,
    showLineNumbers: true
  };

  constructor() {
    super();
    makeObservable<EditorTabStore, 'tabs' | 'activeTabId' | 'settings'>(this, {
      tabs: observable,
      activeTabId: observable,
      settings: observable,
      addTab: action,
      removeTab: action,
      setActiveTab: action,
      updateTab: action,
      updateSettings: action
    });
  }

  // 标签操作
  addTab(tabInfo: TabInfo) {
    this.tabs.set(tabInfo.id, tabInfo);
    if (tabInfo.isActive) {
      this.setActiveTab(tabInfo.id);
    }
    this.emit('tabsChanged');
  }

  removeTab(tabId: string) {
    this.tabs.delete(tabId);
    if (this.activeTabId === tabId) {
      // 选择新的活动标签
      const remainingTabs = Array.from(this.tabs.values());
      if (remainingTabs.length > 0) {
        this.setActiveTab(remainingTabs[0].id);
      } else {
        this.activeTabId = null;
      }
    }
    this.emit('tabsChanged');
  }

  setActiveTab(tabId: string) {
    // 更新所有标签的激活状态
    for (const tab of this.tabs.values()) {
      tab.isActive = tab.id === tabId;
    }
    this.activeTabId = tabId;
    this.emit('activeTabChanged', tabId);
  }

  getTab(tabId: string): TabInfo | undefined {
    return this.tabs.get(tabId);
  }

  getActiveTab(): TabInfo | undefined {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : undefined;
  }

  getAllTabs(): TabInfo[] {
    return Array.from(this.tabs.values());
  }

  // 设置操作
  updateSettings(settings: Partial<GlobalSettings>) {
    this.settings = { ...this.settings, ...settings };
    this.emit('settingsChanged', this.settings);
  }

  getSettings(): GlobalSettings {
    return { ...this.settings };
  }

  /**
   * 更新标签信息
   * @param tabId 标签ID
   * @param updates 要更新的字段
   */
  updateTab(tabId: string, updates: Partial<TabInfo>): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    // 更新字段
    const updatedTab = { ...tab, ...updates };
    this.tabs.set(tabId, updatedTab);
    
    // 触发事件
    this.emit('tabUpdated', updatedTab);
  }
}

// 创建全局单例
export const editorTabStore = new EditorTabStore();

// 创建 Context
export const EditorTabContext = createContext<EditorTabStore>(editorTabStore);

// 创建 Hook
export const useEditorTabStore = () => {
  return useContext(EditorTabContext);
}; 