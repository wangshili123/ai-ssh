import { useState, useEffect, useRef } from 'react';
import { CompletionService, ICompletionSuggestion } from '../services/completion/CompletionService';

let completionService: CompletionService;

/**
 * 初始化补全服务
 */
const initializeServices = async () => {
  try {
    console.log('[useCompletion] 开始初始化补全服务');
    completionService = await CompletionService.getInstance();
    console.log('[useCompletion] 补全服务初始化完成');
  } catch (error) {
    console.error('[useCompletion] 初始化补全服务失败:', error);
  }
};

/**
 * 命令补全钩子
 */
export const useCompletion = () => {
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<ICompletionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingCommand, setPendingCommand] = useState('');
  const suggestionTimer = useRef<NodeJS.Timeout>();

  // 初始化补全服务
  useEffect(() => {
    initializeServices().catch(error => {
      console.error('[useCompletion] 初始化失败:', error);
    });
  }, []);
} 