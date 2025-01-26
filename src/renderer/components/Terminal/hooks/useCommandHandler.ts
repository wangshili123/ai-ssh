import { useCallback, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { CompletionService } from '../../../../services/completion/CompletionService';
import { sshService } from '../../../services/ssh';

interface UseCommandHandlerProps {
  terminalRef: React.MutableRefObject<XTerm | null>;
  shellIdRef: React.MutableRefObject<string | null>;
  completionService: CompletionService | null;
  onSuggestionClear: () => void;
  updatePendingCommand: (newCommand: string) => void;
  pendingCommandRef: React.MutableRefObject<string>;
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
}: UseCommandHandlerProps): UseCommandHandlerReturn => {
  // 处理命令输入
  const handleInput = useCallback(async (data: string) => {
    console.log('[useCommandHandler] handleInput called with data:', data);
    if (!terminalRef.current) return;
    console.log('[useCommandHandler] terminalRef.current:', terminalRef.current);
    const terminal = terminalRef.current;

    // 如果是回车键，直接返回（现在由 onKey 事件处理）
    if (data === '\r' || data === '\n' || data === '') {
      return;
    }

    // 如果是Tab键,接受当前建议
    if (data === '\t') {
      const suggestion = completionService?.acceptSuggestion();
      if (suggestion) {
        // 清除当前输入
        const linesToClear = pendingCommandRef.current.length;
        for (let i = 0; i < linesToClear; i++) {
          terminal.write('\b \b');
        }
        // 写入完整命令
        terminal.write(suggestion);
        updatePendingCommand(suggestion);
        
        // 发送到SSH
        if (shellIdRef.current) {
          sshService.write(shellIdRef.current, suggestion).catch((error) => {
            console.error('[useCommandHandler] Failed to write to shell:', error);
            terminal.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
          });
        }
        return;
      }
    }

    // 如果是退格键
    if (data === '\b' || data === '\x7f') {
      if (pendingCommandRef.current.length > 0) {
        // 发送到SSH
        if (shellIdRef.current) {
          sshService.write(shellIdRef.current, data).catch((error) => {
            console.error('[useCommandHandler] Failed to write to shell:', error);
            terminal.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
          });
        }
        
        // 更新待处理的命令
        const newInput = pendingCommandRef.current.slice(0, -1);
        console.log('[useCommandHandler] Updated pending command (backspace):', newInput);
        updatePendingCommand(newInput);
        
        // 清除当前建议
        onSuggestionClear();
      }
      return;
    }

    // 普通字符输入
    // 先更新待处理的命令
    const newInput = pendingCommandRef.current + data;
    updatePendingCommand(newInput);
    
    // 清除当前建议
    onSuggestionClear();
    
    // 然后发送到SSH
    if (shellIdRef.current) {
      await sshService.write(shellIdRef.current, data).catch((error) => {
        console.error('[useCommandHandler] Failed to write to shell:', error);
        terminal.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
      });
    }
  }, [terminalRef, shellIdRef, completionService, onSuggestionClear, updatePendingCommand, pendingCommandRef]);

  // 处理回车键
  const handleEnterKey = useCallback(async () => {
    console.log('[useCommandHandler] Enter key handler called, current pendingCommand:', pendingCommandRef.current);
    const commandToRecord = pendingCommandRef.current.trim();
    
    if (shellIdRef.current) {
      console.log('[useCommandHandler] Processing Enter key, command to record:', commandToRecord);
      // 发送回车到SSH
      try {
        await sshService.write(shellIdRef.current, '\r');
        
        // 如果有命令要记录
        if (commandToRecord) {
          console.log('[useCommandHandler] Recording command:', commandToRecord);
          try {
            await completionService?.recordCommand(commandToRecord);
            console.log('[useCommandHandler] Command recorded successfully');
          } catch (error: any) {
            console.error('[useCommandHandler] Failed to record command:', error);
          }
        }
        
        // 清除状态
        updatePendingCommand('');
        onSuggestionClear();
      } catch (error: any) {
        console.error('[useCommandHandler] Failed to write to shell:', error);
        if (terminalRef.current) {
          terminalRef.current.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
        }
      }
    }
  }, [terminalRef, shellIdRef, completionService, onSuggestionClear, updatePendingCommand, pendingCommandRef]);

  return {
    handleInput,
    handleEnterKey,
  };
}; 