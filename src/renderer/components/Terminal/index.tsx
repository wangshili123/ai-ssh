import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { sshService } from '../../services/ssh';
import { eventBus } from '../../services/eventBus';
import { terminalOutputService } from '../../services/terminalOutput';
import { CompletionService } from '../../../services/completion/CompletionService';
import type { SessionInfo } from '../../../main/services/storage';
import { TerminalProps } from './types/terminal.types';
import { useTerminalInit } from './hooks/useTerminalInit';
import { useCommandHandler } from './hooks/useCommandHandler';
import { waitForConnection } from './utils/terminal.utils';
import 'xterm/css/xterm.css';
import './index.css';

const Terminal: React.FC<TerminalProps> = ({ sessionInfo, config, instanceId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [suggestionTimeout, setSuggestionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [completionService, setCompletionService] = useState<CompletionService | null>(null);

  // 开始补全计时器
  const startSuggestionTimer = (input: string) => {
    // 清除之前的计时器
    if (suggestionTimeout) {
      clearTimeout(suggestionTimeout);
    }

    // 设置新的计时器，1秒后使用完整的输入进行查询
    const timeout = setTimeout(async () => {
      if (!terminalRef.current) return;

      console.log('Suggestion timer triggered for input:', input);
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

    setSuggestionTimeout(timeout);
  };

  // 创建终端引用
  const terminalRef = useRef<XTerm | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellIdRef = useRef<string | null>(null);

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
    onSuggestionClear: () => {
      if (suggestionTimeout) {
        clearTimeout(suggestionTimeout);
        setSuggestionTimeout(null);
      }
    }
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

  // 复制选中的文本
  const copySelectedText = () => {
    const selection = terminalRef.current?.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  };

  // 搜索文本
  const searchText = () => {
    const text = prompt('请输入要搜索的文本:');
    if (text && searchAddonRef.current) {
      searchAddonRef.current.findNext(text);
    }
  };

  // 重新加载终端
  const reloadTerminal = async () => {
    if (terminalRef.current && sessionInfo) {
      terminalRef.current.clear();
      try {
        if (shellIdRef.current) {
          // 清除终端输出缓存
          terminalOutputService.clearOutput(shellIdRef.current);
          await sshService.disconnect(shellIdRef.current);
          shellIdRef.current = '';
        }
        setIsConnected(false);
        eventBus.emit('terminal-connection-change', { 
          shellId: shellIdRef.current || '', 
          connected: false 
        });

        // 等待连接就绪
        await waitForConnection(sessionInfo);
        
        const shellId = sessionInfo.id + (instanceId ? `-${instanceId}` : '');
        shellIdRef.current = shellId;

        await sshService.createShell(
          shellId,
          (data) => {
            terminalRef.current?.write(data);
            // 收集终端输出
            terminalOutputService.addOutput(shellId, data);
          },
          () => {
            setIsConnected(false);
            shellIdRef.current = '';
            eventBus.setCurrentShellId('');
            terminalRef.current?.write('\r\n\x1b[31m连接已关闭\x1b[0m\r\n');
            // 清除终端输出缓存
            terminalOutputService.clearOutput(shellId);
            // 发送连接状态变化事件
            eventBus.emit('terminal-connection-change', { 
              shellId: shellIdRef.current || '', 
              connected: false 
            });
          }
        );

        setIsConnected(true);
        eventBus.setCurrentShellId(shellId);
        // 发送连接状态变化事件
        eventBus.emit('terminal-connection-change', { 
          shellId: shellIdRef.current || '', 
          connected: true 
        });
      } catch (error: any) {
        console.error('Failed to reload terminal:', error);
        terminalRef.current.write(`\r\n\x1b[31m重新连接失败: ${error}\x1b[0m\r\n`);
      }
    }
  };

  // 右键菜单项
  const menuItems: MenuProps['items'] = [
    {
      key: 'copy',
      label: '复制',
      onClick: copySelectedText
    },
    {
      key: 'search',
      label: '搜索',
      onClick: searchText
    },
    {
      key: 'reload',
      label: '重新加载',
      onClick: reloadTerminal
    }
  ];

  useEffect(() => {
    const initializeServices = async () => {
      try {
        const service = await CompletionService.getInstance();
        setCompletionService(service);
      } catch (error) {
        console.error('初始化补全服务失败:', error);
      }
    };

    initializeServices();
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