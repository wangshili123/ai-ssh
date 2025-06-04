import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { Dropdown } from 'antd';
import { eventBus } from '../../services/eventBus';
import type { SessionInfo } from '../../../renderer/types/index';
import { TerminalProps } from './types/terminal.types';
import { useTerminalInit } from './hooks/useTerminalInit';
import { useCommandHandler } from './hooks/useCommandHandler';
import { useCompletion } from './hooks/useCompletion';
import { useContextMenu } from './hooks/useContextMenu';
import { TerminalSearchPanel } from './components/TerminalSearchPanel';

import { sshService } from '../../services/ssh';
import CompletionDropdown from './completion/CompletionDropdown';
import 'xterm/css/xterm.css';
import './index.css';

const Terminal: React.FC<TerminalProps> = ({ sessionInfo, config, instanceId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isSearchPanelVisible, setIsSearchPanelVisible] = useState(false);

  // 创建终端引用
  const terminalRef = useRef<XTerm | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellIdRef = useRef<string | null>(null);

  // 使用 useCompletion hook
  const {
    completionService,
    clearSuggestion,
    acceptSuggestion,
    pendingCommandRef,
    updatePendingCommand,
    dropdownVisible,
    suggestions,
    selectedIndex,
    dropdownPosition,
    navigateSuggestions,
    updateDropdownPosition,
  } = useCompletion({
    terminalRef,
  });

  const {
    handleInput,
    handleEnterKey,
  } = useCommandHandler({
    terminalRef,
    shellIdRef,
    completionService,
    onSuggestionClear: clearSuggestion,
    updatePendingCommand,
    pendingCommandRef,
    acceptSuggestion,
  });

  // 搜索面板处理函数
  const handleOpenSearch = useCallback(() => {
    setIsSearchPanelVisible(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setIsSearchPanelVisible(false);
  }, []);



  // 复制选中的文本
  const handleCopy = useCallback(() => {
    console.log('[Terminal] Copying selected text');
    const selection = terminalRef.current?.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  }, [terminalRef]);

  // 粘贴文本
  const handlePaste = useCallback(async () => {
    console.log('[Terminal] Pasting text from clipboard');
    try {
      // 检查终端和连接状态
      if (!terminalRef.current || !shellIdRef.current) {
        console.warn('[Terminal] Terminal not ready for paste operation');
        return;
      }

      // 从剪贴板读取文本
      const text = await navigator.clipboard.readText();
      if (text) {
        // 将文本发送到远程终端
        await sshService.write(shellIdRef.current, text);
        console.log('[Terminal] Text pasted successfully');
      } else {
        console.log('[Terminal] Clipboard is empty');
      }
    } catch (error) {
      console.error('[Terminal] Failed to paste text:', error);
      // 如果剪贴板访问失败，可以在终端显示提示
      if (terminalRef.current) {
        terminalRef.current.write('\r\n\x1b[33m粘贴失败: 无法访问剪贴板\x1b[0m\r\n');
      }
    } finally {
      // 重新聚焦到终端
      if (terminalRef.current) {
        terminalRef.current.focus();
      }
    }
  }, [terminalRef, shellIdRef]);

  // 清空终端内容
  const handleClear = useCallback(() => {
    console.log('[Terminal] Clearing terminal content');
    if (terminalRef.current) {
      terminalRef.current.clear();
      console.log('[Terminal] Terminal content cleared successfully');
      // 重新聚焦到终端
      terminalRef.current.focus();
    }
  }, [terminalRef]);

  // 使用 useContextMenu hook
  const { menuItems } = useContextMenu({
    terminalRef,
    searchAddonRef,
    shellIdRef,
    sessionInfo,
    instanceId,
    setIsConnected,
    onOpenSearch: handleOpenSearch,
  });

  // 使用 useTerminalInit hook
  useTerminalInit({
    sessionInfo,
    config,
    instanceId,
    isReady,
    containerRef,
    setIsConnected,
    handleInput,
    handleEnterKey,
    acceptSuggestion,
    updatePendingCommand,
    clearSuggestion,
    onOpenSearch: handleOpenSearch,
    onCopy: handleCopy,
    onPaste: handlePaste,
    onClear: handleClear,
    terminalRef,
    searchAddonRef,
    fitAddonRef,
    shellIdRef,
    pendingCommandRef,
  });

  // 在组件挂载后设置 isReady
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // 鼠标定位事件监听器
  useEffect(() => {
    if (!isReady || !containerRef.current) {
      return;
    }

    const container = containerRef.current;
    
              // 鼠标点击处理器
     const handleMouseClick = (event: MouseEvent) => {
       // 检查点击是否在终端容器内
       const isInTerminal = container.contains(event.target as Node);
       if (!isInTerminal || event.button !== 0) {
         return; // 只处理终端内的左键点击
       }
       
       // 处理鼠标定位
       if (terminalRef.current && shellIdRef.current) {
         const terminal = terminalRef.current;
         
         // 获取当前光标位置
         const currentPos = {
           row: terminal.buffer.active.cursorY + 1,
           col: terminal.buffer.active.cursorX + 1,
         };
         
         // 计算点击位置
         const xtermScreen = container.querySelector('.xterm-screen') as HTMLElement;
         if (!xtermScreen) return;
         
         const screenRect = xtermScreen.getBoundingClientRect();
         const relativeX = event.clientX - screenRect.left;
         const relativeY = event.clientY - screenRect.top;
         
         // 计算字符尺寸
         const charWidth = screenRect.width / terminal.cols;
         const charHeight = screenRect.height / terminal.rows;
         
         const targetCol = Math.max(1, Math.floor(relativeX / charWidth) + 1);
         const targetRow = Math.max(1, Math.floor(relativeY / charHeight) + 1);
         
         // 计算移动距离
         const deltaRow = targetRow - currentPos.row;
         const deltaCol = targetCol - currentPos.col;
         
         // 生成移动序列
         let movementSequence = '';
         
         // 垂直移动 - 只允许向下移动到当前行或更下方，避免触发历史命令
         if (deltaRow > 0) {
           movementSequence += '\x1b[B'.repeat(deltaRow); // 下移
         } else if (deltaRow < 0) {
           // 不发送上移命令，避免触发历史命令导航
           console.log('[Terminal] Ignoring upward movement to prevent history navigation');
           return; // 直接返回，不执行任何移动
         }
         
         // 水平移动
         if (deltaCol > 0) {
           movementSequence += '\x1b[C'.repeat(deltaCol); // 右移
         } else if (deltaCol < 0) {
           movementSequence += '\x1b[D'.repeat(-deltaCol); // 左移
         }
         
         // 确保终端获得焦点
         terminal.focus();
         
         // 发送移动序列
         if (movementSequence && shellIdRef.current) {
           sshService.write(shellIdRef.current, movementSequence).catch(error => {
             console.error('[Terminal] Failed to send cursor movement:', error);
           });
         }
         
         // 阻止事件传播
         event.preventDefault();
         event.stopPropagation();
       }
     };
    
     // 添加鼠标点击监听器（使用mouseup事件确保兼容性）
     document.addEventListener('mouseup', handleMouseClick);

    return () => {
      document.removeEventListener('mouseup', handleMouseClick);
    };
  }, [isReady]);

  // 监听标签切换，自动聚焦当前终端
  useEffect(() => {
    const handleTabChange = () => {
      if (terminalRef.current) {
        // 添加一个小延迟，确保 DOM 已经更新
        setTimeout(() => {
          terminalRef.current?.focus();
        }, 100);
      }
    };

    eventBus.on('tab-change', handleTabChange);
    return () => {
      eventBus.off('tab-change', handleTabChange);
    };
  }, []);

  // 处理补全建议选择
  const handleSuggestionSelect = (suggestion: any) => {
    if (terminalRef.current) {
      const terminal = terminalRef.current;
      const completionPart = suggestion.fullCommand.slice(pendingCommandRef.current.length);
      
      // 清除当前建议
      clearSuggestion();
      
      // 更新命令状态
      updatePendingCommand(suggestion.fullCommand);
      
      // 写入补全部分
      if (shellIdRef.current) {
        terminal.write(completionPart);
      }
    }
  };

  return (
    <div className="terminal-wrapper">
      <div className="terminal-container">
        <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
          <div ref={containerRef} className="terminal-content" />
        </Dropdown>
        <div className="completion-container">
          <CompletionDropdown
            visible={dropdownVisible}
            suggestions={suggestions}
            selectedIndex={selectedIndex}
            position={dropdownPosition}
            onSelect={handleSuggestionSelect}
            terminalRef={terminalRef}
            navigateSuggestions={navigateSuggestions}
            completionService={completionService}
          />
        </div>
        {/* 搜索面板 */}
        {searchAddonRef.current && terminalRef.current && (
          <TerminalSearchPanel
            searchAddon={searchAddonRef.current}
            terminal={terminalRef.current}
            onClose={handleCloseSearch}
            visible={isSearchPanelVisible}
          />
        )}
      </div>
    </div>
  );
};

export default Terminal; 