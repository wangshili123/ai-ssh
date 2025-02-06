import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { Dropdown } from 'antd';
import { eventBus } from '../../services/eventBus';
import type { SessionInfo } from '../../../main/services/storage';
import { TerminalProps } from './types/terminal.types';
import { useTerminalInit } from './hooks/useTerminalInit';
import { useCommandHandler } from './hooks/useCommandHandler';
import { useCompletion } from './hooks/useCompletion';
import { useContextMenu } from './hooks/useContextMenu';
import CompletionDropdown from './completion/CompletionDropdown';
import 'xterm/css/xterm.css';
import './index.css';

const Terminal: React.FC<TerminalProps> = ({ sessionInfo, config, instanceId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

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
    recordCommand,
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

  // 使用 useContextMenu hook
  const { menuItems } = useContextMenu({
    terminalRef,
    searchAddonRef,
    shellIdRef,
    sessionInfo,
    instanceId,
    setIsConnected
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
    }, 0);
    return () => clearTimeout(timer);
  }, []);

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
      </div>
    </div>
  );
};

export default Terminal; 