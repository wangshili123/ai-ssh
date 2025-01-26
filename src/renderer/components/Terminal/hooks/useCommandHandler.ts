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

    // 如果是控制字符（箭头键等），直接发送到 SSH
    if (data.charCodeAt(0) < 32 || data.charCodeAt(0) === 127) {
      // 如果是退格键，需要更新命令状态
      if (data === '\b' || data === '\x7f') {
        if (pendingCommandRef.current.length > 0) {
          // 更新待处理的命令
          const newInput = pendingCommandRef.current.slice(0, -1);
          console.log('[useCommandHandler] Updated pending command (backspace):', newInput);
          updatePendingCommand(newInput);
          
          // 清除当前建议
          onSuggestionClear();
        }
      }
      
      // 发送到SSH
      if (shellIdRef.current) {
        await sshService.write(shellIdRef.current, data).catch((error) => {
          console.error('[useCommandHandler] Failed to write to shell:', error);
          terminal.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
        });
      }
      return;
    }

    // 如果是Tab键,接受当前建议
    if (data === '\t') {
      console.log('[useCommandHandler] Tab key pressed, current pendingCommand:', pendingCommandRef.current);
      const suggestion = completionService?.acceptSuggestion();
      console.log('[useCommandHandler] Got suggestion:', suggestion);
      
      if (suggestion && suggestion !== pendingCommandRef.current) {
        console.log('[useCommandHandler] Suggestion differs from current input');
        // 确保建议不是当前输入的一部分
        if (suggestion.startsWith(pendingCommandRef.current)) {
          // 只写入补全的部分
          const completionPart = suggestion.slice(pendingCommandRef.current.length);
          console.log('[useCommandHandler] Completion part:', completionPart);
          
          if (completionPart) {
            // 先清除当前建议
            onSuggestionClear();
            
            // 更新状态
            console.log('[useCommandHandler] Updating pendingCommand from', pendingCommandRef.current, 'to', suggestion);

            updatePendingCommand(suggestion);
            
            // 清除补全提示（空格和暗色字符）
            terminal.write(' '.repeat(completionPart.length + 1)); // 用空格覆盖补全提示和分隔空格
            terminal.write('\b'.repeat(completionPart.length + 1)); // 移回光标位置

            
            // 发送到SSH
            if (shellIdRef.current) {
              // 写入补全部分
              console.log('[useCommandHandler] Writing completion part to SSH');
              sshService.write(shellIdRef.current, completionPart).catch((error) => {
                console.error('[useCommandHandler] Failed to write to shell:', error);
                terminal.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
              });
            }
          }
        }
        return;
      }
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