import React, { useCallback, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { eventBus } from '@/renderer/services/eventBus';

interface TerminalProps {
  id: string;
}

const Terminal: React.FC<TerminalProps> = (props) => {
  const terminalRef = useRef<XTerm | null>(null);
  const [commandBuffer, setCommandBuffer] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);

  // 处理键盘输入
  const handleKeyInput = useCallback((key: string) => {
    setCommandBuffer(prev => {
      // 处理退格键
      if (key === '\b' || key === '\x7f') {
        if (cursorPosition > 0) {
          const newBuffer = prev.slice(0, cursorPosition - 1) + prev.slice(cursorPosition);
          setCursorPosition(cursorPosition - 1);
          return newBuffer;
        }
        return prev;
      }
      
      // 处理回车键
      if (key === '\r' || key === '\n') {
        const command = commandBuffer.trim();
        if (command.startsWith('cd ')) {
          eventBus.emit('terminal:directory-change', {
            tabId: props.id,
            command: command,
          });
        }
        setCommandBuffer('');
        setCursorPosition(0);
        return '';
      }

      // 处理普通字符输入
      const newBuffer = prev.slice(0, cursorPosition) + key + prev.slice(cursorPosition);
      setCursorPosition(cursorPosition + 1);
      return newBuffer;
    });
  }, [props.id, commandBuffer, cursorPosition]);

  // 处理光标移动
  const handleCursorMove = useCallback((newPosition: number) => {
    setCursorPosition(Math.min(Math.max(0, newPosition), commandBuffer.length));
  }, [commandBuffer.length]);

  // 初始化终端
  const initTerminal = useCallback(() => {
    if (!terminalRef.current) return;

    const terminal = terminalRef.current;
    
    // 监听数据输入
    terminal.onData(data => {
      handleKeyInput(data);
    });

    // 监听光标移动
    terminal.onCursorMove(() => {
      if (terminal.buffer.active) {
        const newPos = terminal.buffer.active.cursorX;
        handleCursorMove(newPos);
      }
    });
  }, [handleKeyInput, handleCursorMove]);

  // 组件挂载时初始化终端
  React.useEffect(() => {
    initTerminal();
  }, [initTerminal]);

  return (
    <div className="terminal-container">
      {/* 终端渲染代码 */}
    </div>
  );
};

export default Terminal; 
