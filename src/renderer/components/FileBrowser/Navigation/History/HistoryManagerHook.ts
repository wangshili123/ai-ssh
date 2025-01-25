import { useState, useEffect, useCallback } from 'react';
import {
  loadHistory,
  addToHistory,
  clearHistory,
  getNavigationAvailability,
  type HistoryState
} from './HistoryStorageService';

/**
 * 历史记录管理 Hook
 * 提供历史记录的状态管理和操作方法
 * @returns {Object} 历史记录状态和操作方法
 */
export const useHistoryManager = () => {
  // 初始化状态
  const [historyState, setHistoryState] = useState<HistoryState>(() => loadHistory());

  // 当前路径
  const currentPath = historyState.paths[historyState.currentIndex] || '';

  /**
   * 添加新路径到历史记录
   * @param {string} path - 要添加的路径
   */
  const addPath = useCallback((path: string) => {
    setHistoryState((currentState: HistoryState) => addToHistory(path, currentState));
  }, []);

  /**
   * 清除历史记录
   */
  const handleClearHistory = useCallback(() => {
    setHistoryState(clearHistory());
  }, []);

  /**
   * 后退到上一个路径
   * @returns {string} 后退后的路径
   */
  const goBack = useCallback(() => {
    if (historyState.currentIndex > 0) {
      setHistoryState((current: HistoryState) => ({
        ...current,
        currentIndex: current.currentIndex - 1
      }));
      return historyState.paths[historyState.currentIndex - 1];
    }
    return currentPath;
  }, [historyState, currentPath]);

  /**
   * 前进到下一个路径
   * @returns {string} 前进后的路径
   */
  const goForward = useCallback(() => {
    if (historyState.currentIndex < historyState.paths.length - 1) {
      setHistoryState((current: HistoryState) => ({
        ...current,
        currentIndex: current.currentIndex + 1
      }));
      return historyState.paths[historyState.currentIndex + 1];
    }
    return currentPath;
  }, [historyState, currentPath]);

  // 计算导航可用性
  const { canGoBack, canGoForward } = getNavigationAvailability(historyState);

  return {
    currentPath,
    history: historyState.paths,
    historyIndex: historyState.currentIndex,
    canGoBack,
    canGoForward,
    addPath,
    goBack,
    goForward,
    clearHistory: handleClearHistory
  };
}; 