import { FileBrowserTabState } from './FileBrowserTypes';

// 用于存储所有标签页的状态
const fileBrowserTabStates = new Map<string, FileBrowserTabState>();

/**
 * 文件浏览器状态管理类
 */
export class FileBrowserStateManager {
  /**
   * 初始化标签页状态
   */
  static initTabState(tabId: string, sessionId: string): void {
    console.log('[FileBrowserState] 初始化状态:', { tabId, sessionId });
    
    fileBrowserTabStates.set(tabId, {
      currentPath: '/',
      treeData: [],
      expandedKeys: [],
      fileList: [],
      isInitialized: false,
      isConnected: false,
      sessionId,
      history: ['/'],
      historyIndex: 0
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