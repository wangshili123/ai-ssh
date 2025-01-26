import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { sshService } from '../../../services/ssh';
import { eventBus } from '../../../services/eventBus';
import { terminalOutputService } from '../../../services/terminalOutput';
import type { SessionInfo } from '../../../../main/services/storage';
import type { TerminalProps } from '../types/terminal.types';
import { waitForConnection } from '../utils/terminal.utils';

export interface UseTerminalInitProps {
  sessionInfo?: SessionInfo;
  config?: {
    fontSize?: number;
    fontFamily?: string;
    theme?: any;
  };
  instanceId?: string;
  isReady: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  setIsConnected: (connected: boolean) => void;
  handleInput: (data: string) => void | Promise<void>;
  handleEnterKey: () => void | Promise<void>;
}

export interface UseTerminalInitReturn {
  terminalRef: React.MutableRefObject<XTerm | null>;
  searchAddonRef: React.MutableRefObject<SearchAddon | null>;
  fitAddonRef: React.MutableRefObject<FitAddon | null>;
  shellIdRef: React.MutableRefObject<string | null>;
}

export const useTerminalInit = ({
  sessionInfo,
  config,
  instanceId,
  isReady,
  containerRef,
  setIsConnected,
  handleInput,
  handleEnterKey,
}: UseTerminalInitProps): UseTerminalInitReturn => {
  const terminalRef = useRef<XTerm | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const shellIdRef = useRef<string | null>(null);
  const initCountRef = useRef(0);
  const hasInitializedRef = useRef(false);

  // 使用 ref 存储回调函数，避免它们导致 useCallback 重新创建
  const callbacksRef = useRef({
    handleInput,
    handleEnterKey,
    setIsConnected
  });

  // 使用 ref 存储配置，避免配置变化导致重新初始化
  const configRef = useRef({
    sessionInfo,
    config,
    instanceId
  });

  // 更新回调函数和配置的引用
  useEffect(() => {
    callbacksRef.current = {
      handleInput,
      handleEnterKey,
      setIsConnected
    };
    configRef.current = {
      sessionInfo,
      config,
      instanceId
    };
  }, [handleInput, handleEnterKey, setIsConnected, sessionInfo, config, instanceId]);

  // 处理终端输入
  const handleTerminalInput = useCallback((data: string) => {
    void callbacksRef.current.handleInput(data);
  }, []);

  // 处理终端按键
  const handleTerminalKey = useCallback(({ key, domEvent }: { key: string, domEvent: KeyboardEvent }) => {
    if (domEvent.key === 'Enter') {
      void callbacksRef.current.handleEnterKey();
    }
  }, []);

  // 处理终端大小调整
  const handleResize = useCallback(async () => {
    if (!terminalRef.current || !fitAddonRef.current || !containerRef.current) {
      console.log('[useTerminalInit] handleResize: Terminal or fitAddon not ready');
      return;
    }

    const { clientHeight, clientWidth } = containerRef.current;
    console.log('[useTerminalInit] handleResize: Container size:', { clientHeight, clientWidth });

    try {
      fitAddonRef.current.fit();
      console.log('[useTerminalInit] handleResize: FitAddon.fit() executed');

      const { rows: newRows, cols: newCols } = terminalRef.current;
      console.log('[useTerminalInit] handleResize: New terminal size:', { newCols, newRows });

      if (shellIdRef.current) {
        console.log('[useTerminalInit] handleResize: Sending resize to server:', { shellId: shellIdRef.current, newCols, newRows });
        await sshService.resize(shellIdRef.current, newCols, newRows);
      }
    } catch (error) {
      console.error('[useTerminalInit] handleResize: Failed to resize terminal:', error);
    }
  }, []);

  // 初始化终端
  const initTerminal = useCallback(async () => {
    if (hasInitializedRef.current) {
      console.log('[useTerminalInit] Terminal already initialized, skipping');
      return;
    }

    initCountRef.current++;
    console.log('[useTerminalInit] initTerminal called:', {
      count: initCountRef.current,
      hasTerminal: !!terminalRef.current,
      hasContainer: !!containerRef.current,
      isReady,
      sessionInfo: configRef.current.sessionInfo?.id,
      instanceId: configRef.current.instanceId
    });

    if (!containerRef.current || !isReady) {
      console.log('[useTerminalInit] Skipping initialization - container or not ready:', { 
        hasContainer: !!containerRef.current, 
        isReady 
      });
      return;
    }

    // 如果已经有终端实例，先清理
    if (terminalRef.current) {
      console.log('[useTerminalInit] Cleaning up existing terminal instance');
      window.removeEventListener('resize', handleResize);
      terminalRef.current.dispose();
      terminalRef.current = null;
    }

    console.log('[useTerminalInit] Creating new terminal instance');

    // 创建终端实例
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: configRef.current.config?.fontSize || 14,
      fontFamily: configRef.current.config?.fontFamily || 'Consolas, "Courier New", monospace',
      theme: {
        background: configRef.current.config?.theme?.background || '#000000',
        foreground: configRef.current.config?.theme?.foreground || '#ffffff'
      },
      convertEol: true,
      rightClickSelectsWord: true,
      cols: 80,
      rows: 24
    });

    // 添加插件
    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;
    fitAddonRef.current = fitAddon;

    // 打开终端
    terminal.open(containerRef.current);
    terminalRef.current = terminal;
    
    // 初始化大小
    await handleResize();

    // 连接 SSH
    const { sessionInfo } = configRef.current;
    if (sessionInfo) {
      try {
        console.log('[useTerminalInit] Connecting to SSH:', { sessionId: sessionInfo.id, instanceId: configRef.current.instanceId });
        // 等待连接就绪
        await waitForConnection(sessionInfo);
        
        const shellId = `${sessionInfo.id}-${configRef.current.instanceId}`;
        console.log('[useTerminalInit] Creating shell:', { shellId });
        shellIdRef.current = shellId;

        // 创建 shell
        await sshService.createShell(
          shellId,
          (data) => {
            terminal.write(data);
            // 收集终端输出
            terminalOutputService.addOutput(shellId, data);
          },
          () => {
            console.log('[useTerminalInit] Shell connection closed:', { shellId });
            callbacksRef.current.setIsConnected(false);
            shellIdRef.current = null;
            eventBus.setCurrentShellId('');
            terminal.write('\r\n\x1b[31m连接已关闭\x1b[0m\r\n');
            // 清除终端输出缓存
            terminalOutputService.clearOutput(shellId);
            // 发送连接状态变化事件
            eventBus.emit('terminal-connection-change', { shellId, connected: false });
          }
        );

        callbacksRef.current.setIsConnected(true);
        eventBus.setCurrentShellId(shellId);
        // 发送连接状态变化事件
        eventBus.emit('terminal-connection-change', { shellId, connected: true });

        // 自动聚焦终端
        terminal.focus();

        // 设置终端事件处理
        terminal.onData(handleTerminalInput);
        terminal.onKey(handleTerminalKey);

        // 监听窗口大小变化
        window.addEventListener('resize', handleResize);

        console.log('[useTerminalInit] Terminal initialization completed:', { shellId });
        hasInitializedRef.current = true;

      } catch (error) {
        console.error('[useTerminalInit] Failed to connect:', error);
        terminal.write(`\r\n\x1b[31m连接失败: ${error}\x1b[0m\r\n`);
        return () => {
          terminal.dispose();
        };
      }
    } else {
      console.log('[useTerminalInit] No session info provided');
      terminal.write('请选择一个会话连接...\r\n');
      return () => {
        terminal.dispose();
      };
    }

    // 返回清理函数
    return () => {
      console.log('[useTerminalInit] Cleanup function called:', { 
        hasTerminal: !!terminalRef.current,
        shellId: shellIdRef.current 
      });
      window.removeEventListener('resize', handleResize);
      if (shellIdRef.current) {
        sshService.disconnect(shellIdRef.current).catch(console.error);
        shellIdRef.current = null;
      }
      callbacksRef.current.setIsConnected(false);
      terminal.dispose();
      hasInitializedRef.current = false;
    };
  }, [isReady, containerRef, handleResize, handleTerminalInput, handleTerminalKey]);

  // 执行初始化
  useEffect(() => {
    console.log('[useTerminalInit] Initialization effect triggered');
    const cleanup = initTerminal();
    return () => {
      console.log('[useTerminalInit] Cleanup effect triggered');
      cleanup?.then((fn) => fn?.());
    };
  }, [initTerminal]);

  return {
    terminalRef,
    searchAddonRef,
    fitAddonRef,
    shellIdRef,
  };
}; 

