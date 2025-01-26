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
    startSuggestionTimer,
    clearSuggestion,
    acceptSuggestion,
    recordCommand
  } = useCompletion({
    terminalRef
  });

  // 使用 useCommandHandler hook
  const {
    handleInput,
    handleEnterKey,
    pendingCommandRef,
    updatePendingCommand
  } = useCommandHandler({
    terminalRef,
    shellIdRef,
    completionService,
    onSuggestionStart: startSuggestionTimer,
    onSuggestionClear: clearSuggestion
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
    shellIdRef
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

  return (
    <div className="terminal-wrapper">
      <div className="terminal-container">
        <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
          <div ref={containerRef} className="terminal-content" />
        </Dropdown>
      </div>
    </div>
  );
};

export default Terminal; 