import { useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { CompletionService } from '../../../../services/completion/CompletionService';
import { sshService } from '../../../services/ssh';
import { CollectorService } from '../../../../services/completion/learning/collector/CollectorService';
import { CommandOutputAnalyzer } from '../../../../services/terminal/analysis/CommandOutputAnalyzer';

interface UseCommandHandlerProps {
  terminalRef: React.MutableRefObject<XTerm | null>;
  shellIdRef: React.MutableRefObject<string | null>;
  completionService: CompletionService | null;
  onSuggestionClear: () => void;
  updatePendingCommand: (command: string) => void;
  pendingCommandRef: React.MutableRefObject<string>;
  acceptSuggestion: () => string | null | undefined;
}

interface UseCommandHandlerReturn {
  handleInput: (data: string) => Promise<void>;
  handleEnterKey: () => Promise<void>;
}

export const useCommandHandler = ({
  terminalRef,
  shellIdRef,
  completionService,
  onSuggestionClear,
  updatePendingCommand,
  pendingCommandRef,
  acceptSuggestion,
}: UseCommandHandlerProps): UseCommandHandlerReturn => {
  const handleInput = useCallback(async (data: string) => {
    console.log('[useCommandHandler] handleInput called with data:', data);
    if (!terminalRef.current) {
      console.log('[useCommandHandler] terminalRef.current is null');
      return;
    }

    const terminal = terminalRef.current;
    const shellId = shellIdRef.current;

    // 处理特殊键
    if (data === '\r') { // 回车键
      // 清除建议
      onSuggestionClear();
      
      // 获取当前命令
      const command = pendingCommandRef.current.trim();
      console.log('[useCommandHandler] Executing command:', command);
      
      // 发送命令到SSH服务
      if (shellId) {
        await sshService.write(shellId, '\r');
        try {
          if (command) {
            // 记录命令输出
            CommandOutputAnalyzer.getInstance().startCommand(shellId, command);
          } 
        } catch (error: any) {
          console.error('[useCommandHandler] Failed to send command:', error);
          if (terminalRef.current) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            terminalRef.current.write('\r\n\x1b[31m写入失败: ' + errorMessage + '\x1b[0m\r\n');
          }
          if (command) {
            CommandOutputAnalyzer.getInstance().clearCache(shellId);
          }
        }
      }
      
      // 清空当前命令
      updatePendingCommand('');
      return;
    }

    // 处理退格键
    if (data === '\x7f') { // Backspace
      const currentCommand = pendingCommandRef.current;
      if (currentCommand.length > 0) {
        // 删除最后一个字符
        const newCommand = currentCommand.slice(0, -1);
        updatePendingCommand(newCommand);
        // terminal.write('\b \b'); // 删除一个字符
      }
      // return;
    }

    // 处理普通输入
    const newCommand = pendingCommandRef.current + data;
    updatePendingCommand(newCommand);
    
    // 发送到 SSH 服务
    if (shellId) {
      try {
        await sshService.write(shellId, data);
      } catch (error) {
        console.error('[useCommandHandler] Failed to send input:', error);
      }
    }
  }, [terminalRef, shellIdRef, onSuggestionClear, updatePendingCommand, pendingCommandRef, acceptSuggestion]);

  // handleEnterKey 现在只是一个空函数，因为回车已经在 onData 中处理了
  const handleEnterKey = useCallback(async () => {
    // 不做任何事情，因为回车已经被 onData 处理了
  }, []);

  return {
    handleInput,
    handleEnterKey,
  };
};

export default useCommandHandler; 