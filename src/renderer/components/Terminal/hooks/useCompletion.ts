import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { CompletionService } from '../../../../services/completion/CompletionService';

interface UseCompletionProps {
  terminalRef: React.MutableRefObject<XTerm | null>;
}

interface UseCompletionReturn {
  completionService: CompletionService | null;
  startSuggestionTimer: (input: string) => void;
  clearSuggestion: () => void;
  acceptSuggestion: () => string | null | undefined;
  recordCommand: (command: string) => Promise<void>;
}

export const useCompletion = ({
  terminalRef,
}: UseCompletionProps): UseCompletionReturn => {
  const [completionService, setCompletionService] = useState<CompletionService | null>(null);
  const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // 开始补全计时器
  const startSuggestionTimer = useCallback((input: string) => {
    // 清除之前的计时器
    if (suggestionTimeoutRef.current) {
      clearTimeout(suggestionTimeoutRef.current);
    }

    // 设置新的计时器，1秒后使用完整的输入进行查询
    const timeout = setTimeout(async () => {
      if (!terminalRef.current) return;

      console.log('[useCompletion] Suggestion timer triggered for input:', input);
      // 使用完整的输入进行查询
      const suggestion = await completionService?.getSuggestion(input);
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
  }, [terminalRef, completionService]);

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
    startSuggestionTimer,
    clearSuggestion,
    acceptSuggestion,
    recordCommand,
  };
}; 
