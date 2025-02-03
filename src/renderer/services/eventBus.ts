import { EventEmitter } from 'events';
import type { SessionInfo } from '../../main/services/storage';

export interface TabInfo {
  tabId: string;
  shellId: string | null;
  sessionInfo?: SessionInfo;
}

export interface ConnectionInfo {
  shellId: string;
  connected: boolean;
}

export interface EventMap {
  'tab-change': TabInfo;
  'tab-create': TabInfo & { isNew: boolean };
  'terminal-connection-change': ConnectionInfo;
  'terminal-data': { shellId: string; data: string };
  'terminal-close': string;
  'tabIdChanged': string;
  'shellIdChanged': string;
  'completion:tab-remove': string;
  'ssh:directory-change': { shellId: string; directory: string };
  'terminal:directory-change': { tabId: string; command: string };
}

class EventBus extends EventEmitter {
  private static instance: EventBus;
  private currentShellId: string | null = null;
  private currentTabId: string | null = null;
  private tabMap: Map<string, TabInfo> = new Map();

  private constructor() {
    super();
    // 监听自己的事件，确保状态一致性
    this.on('tab-change', (info: TabInfo) => {
      console.log('[EventBus] 收到标签页变化事件:', info);
      this.currentShellId = info.shellId;
      this.currentTabId = info.tabId;
      this.tabMap.set(info.tabId, info);
    });
  }

  //添加会话信息
  addTabInfo(tabInfo: TabInfo) {
    this.tabMap.set(tabInfo.tabId, tabInfo);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  setCurrentShellId(shellId: string) {
    console.log('[EventBus] 设置当前 shellId:', shellId);
    if (this.currentShellId !== shellId) {
      this.currentShellId = shellId;
      this.emit('shellIdChanged', shellId);
    }
  }

  setCurrentTabId(tabId: string) {
    console.log('[EventBus] 设置当前 tabId:', tabId);
    if (this.currentTabId !== tabId) {
      this.currentTabId = tabId;
      this.emit('tabIdChanged', tabId);
    }
  }

  getCurrentShellId(): string | null {
    return this.currentShellId;
  }

  getCurrentTabId(): string | null {
    const tabId = this.currentTabId;
    console.log('[EventBus] 获取当前 tabId:', tabId);
    return tabId;
  }

  // 重写 EventEmitter 的方法，添加类型支持
  on<K extends keyof EventMap>(event: K, listener: (arg: EventMap[K]) => void): this;
  on(event: string, listener: (...args: any[]) => void): this {
    return super.on(event, listener);
  }

  emit<K extends keyof EventMap>(event: K, arg: EventMap[K]): boolean;
  emit(event: string, ...args: any[]): boolean {
    console.log('[EventBus] 触发事件:', event, args);
    return super.emit(event, ...args);
  }

  off<K extends keyof EventMap>(event: K, listener: (arg: EventMap[K]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this {
    return super.off(event, listener);
  }

  // 处理标签页切换事件
  handleTabChange(info: TabInfo) {
    console.log('[EventBus] 处理标签页切换:', info);
    this.currentShellId = info.shellId;
    this.currentTabId = info.tabId;
    this.tabMap.set(info.tabId, info);
    this.emit('tab-change', info);
  }

  // 移除标签页
  removeTab(tabId: string) {
    console.log('[EventBus] 移除标签页:', tabId);
    if (this.currentTabId === tabId) {
      this.currentTabId = null;
      this.currentShellId = null;
    }
    this.tabMap.delete(tabId);
  }

  // 获取标签页信息
  getTabInfo(tabId: string): TabInfo | undefined {
    console.log('[EventBus] 获取标签页信息:', tabId);
    console.log('[EventBus] 当前标签页映射:', this.tabMap);
    return this.tabMap.get(tabId);
  }

  // 调试用：打印当前状态
  debugState() {
    console.log('[EventBus] 当前状态:', {
      currentShellId: this.currentShellId,
      currentTabId: this.currentTabId,
      tabMap: Array.from(this.tabMap.entries())
    });
  }

  /**
   * 获取当前会话信息
   */
  getCurrentSessionInfo(): SessionInfo | undefined {
    const currentTabId = this.getCurrentTabId();
    console.log('[EventBus] getCurrentSessionInfo - currentTabId:', currentTabId);
    
    if (!currentTabId) {
      console.log('[EventBus] getCurrentSessionInfo - No current tab ID');
      return undefined;
    }
    
    const tabInfo = this.getTabInfo(currentTabId);
    console.log('[EventBus] getCurrentSessionInfo - tabInfo:', tabInfo);
    
    if (!tabInfo?.sessionInfo) {
      console.log('[EventBus] getCurrentSessionInfo - No session info in tab');
    }
    
    return tabInfo?.sessionInfo;
  }

  /**
   * 获取当前会话ID
   */
  getCurrentSessionId(): string {
    const sessionInfo = this.getCurrentSessionInfo();
    console.log('[EventBus] getCurrentSessionId - sessionInfo:', sessionInfo);
    return sessionInfo?.id || 'default-session';
  }
}

export const eventBus = EventBus.getInstance(); 