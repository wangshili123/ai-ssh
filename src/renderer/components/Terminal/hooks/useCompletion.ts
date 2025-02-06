import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { CompletionService } from '../../../../services/completion/CompletionService';
import { SessionState } from '../../../../services/completion/core/types/context.types';
import { eventBus } from '../../../services/eventBus';
import { CollectorService } from '../../../../services/completion/learning/collector/CollectorService';

interface UseCompletionProps {
  terminalRef: React.MutableRefObject<XTerm | null>;
}

interface UseCompletionReturn {
  completionService: CompletionService | null;
  clearSuggestion: () => void;
  acceptSuggestion: () => string | null | undefined;
  recordCommand: (command: string) => Promise<void>;
  pendingCommandRef: React.MutableRefObject<string>;
  updatePendingCommand: (newCommand: string) => void;
  dropdownVisible: boolean;
  suggestions: ICompletionSuggestion[];
  selectedIndex: number;
  dropdownPosition: { left: number; top: number };
  navigateSuggestions: (direction: 'up' | 'down') => void;
  updateDropdownPosition: (left: number, top: number) => void;
}

export interface ICompletionSuggestion {
  fullCommand: string;
  suggestion: string;
  source: 'history' | 'relation' | 'local';
  score: number;
}

export const useCompletion = ({
  terminalRef,
}: UseCompletionProps): UseCompletionReturn => {
  const [completionService, setCompletionService] = useState<CompletionService | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInputRef = useRef<string>('');
  const pendingCommandRef = useRef<string>('');
  
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<ICompletionSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ left: 0, top: 0 });
  const cursorPositionRef = useRef({ x: 0, y: 0 });

  // 计算光标位置
  const calculateCursorPosition = useCallback(() => {
    if (!terminalRef.current) {
      console.log('[useCompletion] calculateCursorPosition: terminalRef.current is null');
      return { left: 0, top: 0 };
    }

    const terminal = terminalRef.current;
    
    try {
      // 获取终端元素的位置
      const rect = terminal.element?.getBoundingClientRect();
      console.log('[useCompletion] rect:', {rect});
      if (!rect) {
        console.log('[useCompletion] Terminal element rect is null');
        return { left: 0, top: 0 };
      }

      // 使用 xterm.js 的 buffer 属性获取光标位置
      const cursorRow = terminal.buffer.active.cursorY;
      const cursorCol = terminal.buffer.active.cursorX;
      console.log('[useCompletion] terminal:', {terminal});
      // 获取字符单元格尺寸
      const core = (terminal as any)._core;
      if (!core || !core._renderService || !core._renderService.dimensions) {
        console.log('[useCompletion] Render service not found');
        return { left: 0, top: 0 };
      }

      const dims = core._renderService.dimensions;
      const cellWidth = dims.css.cell.width;
      const cellHeight = dims.css.cell.height;
      console.log('[useCompletion] dims:', {dims});
      console.log('[useCompletion] cell:', {cellWidth,cellHeight});
      
      // 计算下拉框位置
      const left = ((cursorCol+1) * cellWidth);
      
      // 计算下拉框的预期高度（包括内边距和边框）
      const dropdownHeight = Math.min(suggestions.length * 44, 300); // 每个选项约28px，最大高度300px
      
      // 获取终端的实际滚动位置和可见行数
      let viewportY = 0;
      try {
        // 尝试获取viewport的滚动位置
        if (core._renderService.viewportElement) {
          viewportY = core._renderService.viewportElement.scrollTop;
        } else if (core._renderService.viewport?._viewportElement) {
          // 备选路径
          viewportY = core._renderService.viewport._viewportElement.scrollTop;
        }
      } catch (e) {
        console.warn('[useCompletion] Unable to get viewport scroll position:', e);
      }

      // 计算实际可见行
      const rowInView = cursorRow - Math.floor(viewportY / cellHeight);
      
      // 计算在光标下方显示时的位置（考虑滚动位置）+1是因为cursorRow从0开始。+5是因为拉开一点，看情况
      const bottomPosition = ((cursorRow+1) * cellHeight)+5;
      console.log('[useCompletion] bottomPosition:', {bottomPosition,rowInView,cellHeight});
      // 检查是否会超出终端底部,用终端可视行数的高度来判断
      const terminalBottom = terminal.rows * cellHeight;
      const wouldExceedBottom = (bottomPosition + dropdownHeight) > terminalBottom;

      console.log('[useCompletion] Scroll info:', { 
        viewportY,
        rowInView,
        actualRow: cursorRow,
        bottomPosition,
        terminalBottom,
        dropdownHeight,
        wouldExceedBottom
      });
      
      // 如果会超出底部，则显示在光标上方
      const top = wouldExceedBottom
        ? bottomPosition - dropdownHeight // 上移一行高度
        : bottomPosition;

      console.log('[useCompletion] Terminal rect:', rect);
      console.log('[useCompletion] Current cursor:', { row: cursorRow, col: cursorCol });
      console.log('[useCompletion] Cell dimensions:', { cellWidth, cellHeight });
      console.log('[useCompletion] Dropdown dimensions:', { height: dropdownHeight });
      console.log('[useCompletion] Would exceed bottom:', wouldExceedBottom);
      console.log('[useCompletion] Calculated position:', { left, top });

      return { left, top };
    } catch (error) {
      console.error('[useCompletion] Error calculating cursor position:', error);
      return { left: 0, top: 0 };
    }
  }, [terminalRef, suggestions.length]);

  // 更新下拉框位置
  const updatePosition = useCallback(() => {
    if (!dropdownVisible) return;
    
    console.log('[useCompletion] Updating dropdown position');
    const position = calculateCursorPosition();
    console.log('[useCompletion] Setting dropdown position to:', position);
    setDropdownPosition(position);
  }, [calculateCursorPosition, dropdownVisible]);

  const updateDropdownPosition = useCallback((left: number, top: number) => {
    setDropdownPosition({ left, top });
  }, []);

  const navigateSuggestions = useCallback((direction: 'up' | 'down') => {
    setSelectedIndex(prev => {
      const total = suggestions.length;
      if (total === 0) return 0;
      
      if (direction === 'up') {
        return prev > 0 ? prev - 1 : total - 1;
      } else {
        return prev < total - 1 ? prev + 1 : 0;
      }
    });
  }, [suggestions.length]);

  const clearSuggestion = useCallback(() => {
    setDropdownVisible(false);
    setSuggestions([]);
    setSelectedIndex(0);
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = null;
    }
  }, []);

  const acceptSuggestion = useCallback(() => {
    if (!dropdownVisible || suggestions.length === 0) return null;
    
    const suggestion = suggestions[selectedIndex];
    if (!suggestion) return null;

    // 收集补全使用数据
    try {
      CollectorService.getInstance().collectCompletionUsage(
        currentInput,
        suggestion.fullCommand,
        true
      );
    } catch (error) {
      console.error('[useCompletion] 补全使用数据收集失败:', error);
    }

    setDropdownVisible(false);
    setSuggestions([]);
    return suggestion.fullCommand;
  }, [dropdownVisible, suggestions, selectedIndex, currentInput]);

  const recordCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;
    try {
      await completionService?.recordCommand(command);
      console.log('[useCompletion] Command recorded successfully:', command);
    } catch (error) {
      console.error('[useCompletion] Failed to record command:', error);
    }
  }, [completionService]);

  const updatePendingCommand = useCallback((newCommand: string) => {
    console.log('[useCompletion] Updating pending command to:', newCommand);
    pendingCommandRef.current = newCommand;
    setCurrentInput(newCommand);
  }, []);

  // 监听光标移动
  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;

    const disposable = terminal.onCursorMove(() => {
      try {
        const cursorX = terminal.buffer.active.cursorX;
        const cursorY = terminal.buffer.active.cursorY;

        cursorPositionRef.current = { x: cursorX, y: cursorY };
        
        // 如果下拉框可见，则立即更新位置
        if (dropdownVisible) {
          updatePosition();
        }
      } catch (error) {
        console.error('[useCompletion] Error in cursor move handler:', error);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [terminalRef, dropdownVisible, updatePosition]);

  useEffect(() => {
    const initializeServices = async () => {
      try {
        const service = await CompletionService.getInstance();
        setCompletionService(service);
      } catch (error) {
        console.error('[useCompletion] 初始化补全服务失败:', error);
      }
    };

    initializeServices();
  }, []);

  // 在显示建议时更新位置
  useEffect(() => {
    console.log('[useCompletion] dropdownVisible changed:', dropdownVisible);
    if (dropdownVisible) {
      console.log('[useCompletion] Dropdown is visible, updating position');
      updatePosition();
    }
  }, [dropdownVisible, updatePosition]);

  useEffect(() => {
    if (currentInput === lastInputRef.current) {
      return;
    }
    
    console.log('[useCompletion] Input changed from:', lastInputRef.current, 'to:', currentInput);
    lastInputRef.current = currentInput;

    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = null;
    }

    if (!currentInput) {
      setDropdownVisible(false);
      setSuggestions([]);
      return;
    }

    console.log('[useCompletion] Setting up suggestion timer for input:', currentInput);

    const timeout = setTimeout(async () => {
      if (!terminalRef.current) {
        console.log('[useCompletion] Terminal ref is null, skipping suggestions');
        return;
      }

      if (currentInput !== pendingCommandRef.current) {
        console.log('[useCompletion] Input changed during timeout, skipping suggestion');
        return;
      }

      console.log('[useCompletion] Suggestion timer triggered for input:', currentInput);
      
      try {
        console.log('[useCompletion] Getting suggestions from service');
        const sessionState: SessionState = {
          sessionId: eventBus.getCurrentSessionId(),
          currentWorkingDirectory: process.cwd(),
          environment: process.env as { [key: string]: string }
        };

        const newSuggestions = await completionService?.getSuggestions({
          input: currentInput,
          cursorPosition: cursorPositionRef.current.x,  // 只使用 x 坐标作为光标位置
          sessionState: sessionState,
          tabId: eventBus.getCurrentTabId() || ''  // 添加 tabId
        });
        console.log('[useCompletion] Got suggestions:', newSuggestions);
        
        if (newSuggestions && newSuggestions.length > 0) {
          console.log('[useCompletion] Setting suggestions and showing dropdown');
          setSuggestions(newSuggestions);
          setSelectedIndex(0);
          // 重置 CompletionService 的 selectedIndex
          completionService?.setSelectedIndex(0);
          setDropdownVisible(true);
          // 更新下拉框位置
          console.log('[useCompletion] Updating dropdown position after showing');
          updatePosition();
        } else {
          console.log('[useCompletion] No suggestions found, hiding dropdown');
          setDropdownVisible(false);
          setSuggestions([]);
        }
      } catch (error) {
        console.error('[useCompletion] Failed to get suggestions:', error);
        setDropdownVisible(false);
        setSuggestions([]);
      }
    }, 500);

    suggestionTimeoutRef.current = timeout;

    return () => {
      if (suggestionTimeoutRef.current) {
        clearTimeout(suggestionTimeoutRef.current);
      }
    };
  }, [currentInput, terminalRef, completionService, updatePosition]);

  return {
    completionService,
    clearSuggestion,
    acceptSuggestion,
    recordCommand,
    pendingCommandRef,
    updatePendingCommand,
    dropdownVisible,
    suggestions,
    selectedIndex,
    dropdownPosition,
    navigateSuggestions,
    updateDropdownPosition,
  };
}

export default useCompletion; 
