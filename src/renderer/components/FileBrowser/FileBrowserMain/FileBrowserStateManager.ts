import { loadHistory, saveHistory, addToHistory, clearHistory, type HistoryState } from '../Navigation/History/HistoryStorageService';
import { FileBrowserTabState } from './FileBrowserTypes';

// 用于存储所有标签页的状态
const fileBrowserTabStates = new Map<string, FileBrowserTabState>();

/**
 * 文件浏览器状态管理类
 */
export class FileBrowserStateManager {
  private static getStorageKey(tabId: string): string {
    return `file-browser-history-${tabId}`;
  }

  /**
   * 初始化标签页状态
   */
  static initTabState(tabId: string, sessionId: string): void {
    console.log('[FileBrowserState] 初始化状态:', { tabId, sessionId });
    
    // 从本地存储加载历史记录
    const historyState = loadHistory();
    
    fileBrowserTabStates.set(tabId, {
      currentPath: historyState.items[historyState.currentIndex]?.path || '/',
      treeData: [],
      expandedKeys: [],
      fileList: [],
      isInitialized: false,
      isConnected: false,
      sessionId,
      history: historyState.items.length > 0 ? historyState.items.map(item => item.path) : ['/'],
      historyIndex: historyState.currentIndex >= 0 ? historyState.currentIndex : 0
    });
  }

  /**
   * 获取标签页状态
   */
  static getTabState(tabId: string): FileBrowserTabState | undefined {
    const state = fileBrowserTabStates.get(tabId);
    console.log('[FileBrowserState] 获取状态:', { 
      tabId, 
      hasState: !!state,
      allTabIds: Array.from(fileBrowserTabStates.keys())
    });
    return state;
  }

  /**
   * 设置标签页状态
   */
  static setTabState(tabId: string, state: FileBrowserTabState): void {
    console.log('[FileBrowserState] 设置状态:', { 
      tabId, 
      state,
      allTabIds: Array.from(fileBrowserTabStates.keys())
    });
    
    // 保存历史记录到本地存储
    saveHistory({
      items: state.history.map((path, index) => ({
        id: `${path}-${Date.now()}-${index}`,
        path,
        timestamp: Date.now()
      })),
      currentIndex: state.historyIndex
    });
    
    fileBrowserTabStates.set(tabId, state);
  }

  /**
   * 更新标签页状态
   */
  static updateTabState(tabId: string, updates: Partial<FileBrowserTabState>): void {
    console.log('[FileBrowserState] 更新前状态:', { 
      tabId, 
      currentState: fileBrowserTabStates.get(tabId),
      updates
    });

    // 如果状态不存在，先初始化
    if (!fileBrowserTabStates.has(tabId) && updates.sessionId) {
      this.initTabState(tabId, updates.sessionId);
    }

    const currentState = fileBrowserTabStates.get(tabId);
    if (currentState) {
      const newState = { ...currentState, ...updates };
      
      // 如果更新包含历史相关的字段，同步到本地存储
      if (updates.history || updates.historyIndex !== undefined) {
        saveHistory({
          items: newState.history.map((path, index) => ({
            id: `${path}-${Date.now()}-${index}`,
            path,
            timestamp: Date.now()
          })),
          currentIndex: newState.historyIndex
        });
      }
      
      fileBrowserTabStates.set(tabId, newState);
      console.log('[FileBrowserState] 更新后状态:', { 
        tabId, 
        newState
      });
    } else {
      console.error('[FileBrowserState] 无法更新状态，状态不存在:', tabId);
    }
  }

  /**
   * 删除标签页状态
   */
  static removeTabState(tabId: string): void {
    console.log('[FileBrowserState] 删除状态:', { 
      tabId,
      hadState: fileBrowserTabStates.has(tabId)
    });
    fileBrowserTabStates.delete(tabId);
  }

  /**
   * 检查标签页状态是否存在
   */
  static hasTabState(tabId: string): boolean {
    const hasState = fileBrowserTabStates.has(tabId);
    console.log('[FileBrowserState] 检查状态:', { 
      tabId, 
      hasState,
      allTabIds: Array.from(fileBrowserTabStates.keys())
    });
    return hasState;
  }

  /**
   * 获取所有标签页状态
   */
  static getAllTabStates(): Map<string, FileBrowserTabState> {
    return fileBrowserTabStates;
  }
} 