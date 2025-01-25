/**
 * 历史记录存储服务
 * 负责管理文件浏览器的历史记录，包括本地存储的读写和历史记录的管理
 */

const HISTORY_STORAGE_KEY = 'file-browser-history';
const MAX_HISTORY_LENGTH = 100;  // 最大历史记录数量

export interface HistoryItem {
  id: string;        // 唯一标识符
  path: string;      // 路径
  timestamp: number; // 时间戳
}

export interface HistoryState {
  items: HistoryItem[];  // 历史记录项列表
  currentIndex: number;  // 当前位置索引
}

/**
 * 生成唯一的历史记录项ID
 * @param {string} path - 路径
 * @returns {string} 唯一ID
 */
const generateHistoryItemId = (path: string): string => {
  return `${path}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 从本地存储加载历史记录
 * @returns {HistoryState} 历史记录状态，如果没有则返回初始状态
 */
export const loadHistory = (): HistoryState => {
  try {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      // 兼容旧版本的历史记录格式
      if (Array.isArray(parsed.paths)) {
        const items = parsed.paths.map((path: string) => ({
          id: generateHistoryItemId(path),
          path,
          timestamp: Date.now()
        }));
        return {
          items,
          currentIndex: parsed.currentIndex
        };
      }
      return parsed;
    }
  } catch (error) {
    console.error('Failed to load history from localStorage:', error);
  }
  return { items: [], currentIndex: -1 };
};

/**
 * 保存历史记录到本地存储
 * @param {HistoryState} historyState - 要保存的历史记录状态
 */
export const saveHistory = (historyState: HistoryState): void => {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyState));
  } catch (error) {
    console.error('Failed to save history to localStorage:', error);
  }
};

/**
 * 添加新的路径到历史记录
 * @param {string} path - 要添加的路径
 * @param {HistoryState} currentState - 当前的历史记录状态
 * @returns {HistoryState} 更新后的历史记录状态
 */
export const addToHistory = (path: string, currentState: HistoryState): HistoryState => {
  const { items, currentIndex } = currentState;
  
  // 如果新路径与当前路径相同，不做任何改变
  if (items[currentIndex]?.path === path) {
    return currentState;
  }

  // 创建新的历史记录项
  const newItem = {
    id: generateHistoryItemId(path),
    path,
    timestamp: Date.now()
  };

  // 移除当前位置之后的所有记录
  const newItems = items.slice(0, currentIndex + 1);
  newItems.push(newItem);

  // 如果超出最大长度，移除最早的记录
  if (newItems.length > MAX_HISTORY_LENGTH) {
    newItems.shift();
  }

  const newState = {
    items: newItems,
    currentIndex: newItems.length - 1
  };

  // 保存到本地存储
  saveHistory(newState);
  return newState;
};

/**
 * 清除所有历史记录
 * @returns {HistoryState} 初始的历史记录状态
 */
export const clearHistory = (): HistoryState => {
  const initialState = { items: [], currentIndex: -1 };
  saveHistory(initialState);
  return initialState;
};

/**
 * 获取可以前进或后退的路径数量
 * @param {HistoryState} historyState - 当前的历史记录状态
 * @returns {{ canGoBack: number, canGoForward: number }} 可前进和后退的步数
 */
export const getNavigationAvailability = (historyState: HistoryState) => {
  const { items, currentIndex } = historyState;
  return {
    canGoBack: currentIndex,
    canGoForward: items.length - currentIndex - 1
  };
}; 