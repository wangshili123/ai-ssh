import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { CompletionService } from '../../../../services/completion/CompletionService';

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
}

export const useCompletion = ({
  terminalRef,
}: UseCompletionProps): UseCompletionReturn => {
  const [completionService, setCompletionService] = useState<CompletionService | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInputRef = useRef<string>('');
  const pendingCommandRef = useRef<string>('');

  // 初始化补全服务
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

  // 更新pendingCommand的方法
  const updatePendingCommand = useCallback((newCommand: string) => {
    console.log('[useCompletion] Updating pending command to:', newCommand);
    pendingCommandRef.current = newCommand;
    setCurrentInput(newCommand);
  }, []);

  // 监听输入变化，处理补全
  useEffect(() => {
    // 如果输入没有变化，直接返回
    if (currentInput === lastInputRef.current) {
      return;
    }
    
    console.log('[useCompletion] Input changed from:', lastInputRef.current, 'to:', currentInput);
    lastInputRef.current = currentInput;

    // 清除之前的计时器
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = null;
    }

    // 如果输入为空，不需要补全
    if (!currentInput) {
      return;
    }

    console.log('[useCompletion] Setting up suggestion timer for input:', currentInput);

    // 设置新的计时器，1秒后使用完整的输入进行查询
    const timeout = setTimeout(async () => {
      if (!terminalRef.current) return;

      // 再次检查输入是否已经改变
      if (currentInput !== pendingCommandRef.current) {
        console.log('[useCompletion] Input changed during timeout, skipping suggestion');
        return;
      }

      console.log('[useCompletion] Suggestion timer triggered for input:', currentInput);
      // 使用完整的输入进行查询
      const suggestion = await completionService?.getSuggestion(currentInput);
      if (suggestion) {
        // 显示建议(使用暗淡的颜色)
        terminalRef.current.write('\x1b[2m' + suggestion.suggestion + '\x1b[0m');
        // 将光标移回原位
        for (let i = 0; i < suggestion.suggestion.length; i++) {
          terminalRef.current.write('\b');
        }
      }
    }, 1000);

    suggestionTimeoutRef.current = timeout;
  }, [terminalRef, completionService, currentInput]);

  // 清除建议
  const clearSuggestion = useCallback(() => {
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
      suggestionTimeoutRef.current = null;
    }
  }, []);

  // 接受建议
  const acceptSuggestion = useCallback(() => {
    return completionService?.acceptSuggestion();
  }, [completionService]);

  // 记录命令
  const recordCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;
    try {
      await completionService?.recordCommand(command);
      console.log('[useCompletion] Command recorded successfully:', command);
    } catch (error) {
      console.error('[useCompletion] Failed to record command:', error);
    }
  }, [completionService]);

  return {
    completionService,
    clearSuggestion,
    acceptSuggestion,
    recordCommand,
    pendingCommandRef,
    updatePendingCommand,
  };
}; 
