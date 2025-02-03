import { useCallback, useEffect, useRef } from 'react';
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
import { CompletionSSHManager } from '@/services/completion/CompletionSSHManager';

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
  terminalRef,
  searchAddonRef,
  fitAddonRef,
  shellIdRef,
}: UseTerminalInitProps) => {
  // 使用 ref 来跟踪初始化状态
  const hasInitializedRef = useRef(false);
  const initializingRef = useRef(false);

  // 使用 ref 存储回调函数，避免它们导致 useEffect 重新创建
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

  // 初始化终端
  useEffect(() => {
    if (!isReady || !containerRef.current) return;

    // 如果已经初始化或正在初始化，则跳过
    if (hasInitializedRef.current || initializingRef.current) {
      console.log('[useTerminalInit] Terminal already initialized or initializing, skipping');
      return;
    }

    // 标记正在初始化
    initializingRef.current = true;
    console.log('[useTerminalInit] Initializing terminal...');

    // 创建终端实例
    const terminal = new XTerm({
      fontSize: configRef.current.config?.fontSize || 14,
      fontFamily: configRef.current.config?.fontFamily || 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
      theme: configRef.current.config?.theme || {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78'
      },
      cursorBlink: true,
      cursorStyle: 'block',
      allowTransparency: true,
    });

    // 创建插件
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    // 加载插件
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    // 打开终端
    terminal.open(containerRef.current);
    fitAddon.fit();

    // 保存引用
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // 注册事件处理器
    terminal.onData(callbacksRef.current.handleInput);
    
    let currentCommand = '';

    terminal.onKey(async (event) => {
      const ev = event.domEvent;
      
      // 处理退格键
      if (ev.key === 'Backspace') {
        if (currentCommand.length > 0) {
          currentCommand = currentCommand.slice(0, -1);
          console.log('[useTerminalInit] Command after backspace:', currentCommand);
        }
        return;
      }
      
      // 处理回车键
      if (ev.key === 'Enter') {
        const command = currentCommand.trim();
        console.log('[useTerminalInit] Executing command:', command);
        
        // 先执行命令
        await callbacksRef.current.handleEnterKey();
        
        // 如果是 cd 命令则发送事件
        if (command.startsWith('cd ')) {
          // 等待一小段时间确保 cd 命令执行完成
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 发送目录变更事件到补全服务
          const tabId = configRef.current.instanceId || configRef.current.sessionInfo?.id || '';
          console.log('[useTerminalInit] Sending directory change event for tab:', tabId, 'command:', command);
          eventBus.emit('terminal:directory-change', {
            tabId,
            command: command
          });
        }
        
        // 重置当前命令
        currentCommand = '';
        return;
      }

      // 处理普通字符输入
      const printable = !ev.altKey && !ev.ctrlKey && !ev.metaKey;
      if (printable && ev.key.length === 1) {
        currentCommand += ev.key;
        console.log('[useTerminalInit] Command after input:', currentCommand);
      }
    });

    // 处理窗口大小变化
    const resizeHandler = () => {
      fitAddon.fit();
      // 如果已连接，发送新的尺寸
      if (shellIdRef.current) {
        const { rows, cols } = terminal;
        sshService.resize(shellIdRef.current, rows, cols).catch((error) => {
          console.error('[useTerminalInit] Failed to resize terminal:', error);
        });
      }
    };

    window.addEventListener('resize', resizeHandler);

    // 如果有会话信息，创建 SSH 连接
    if (configRef.current.sessionInfo) {
      console.log('[useTerminalInit] Creating SSH connection...');
      const shellId = configRef.current.sessionInfo.id + (configRef.current.instanceId ? `-${configRef.current.instanceId}` : '');
      shellIdRef.current = shellId;

      // 设置补全服务的会话信息
      const tabId = configRef.current.instanceId || configRef.current.sessionInfo.id;
      const completionSSHManager = CompletionSSHManager.getInstance();
      completionSSHManager.setSessionForTab(tabId, configRef.current.sessionInfo);

      // 等待连接就绪
      waitForConnection(configRef.current.sessionInfo)
        .then(() => {
          return sshService.createShell(
            shellId,
            (data) => {
              terminal.write(data);
              // 收集终端输出
              terminalOutputService.addOutput(shellId, data);
            },
            () => {
              callbacksRef.current.setIsConnected(false);
              shellIdRef.current = '';
              eventBus.setCurrentShellId('');
              terminal.write('\r\n\x1b[31m连接已关闭\x1b[0m\r\n');
              // 清除终端输出缓存
              terminalOutputService.clearOutput(shellId);
              // 发送连接状态变化事件
              eventBus.emit('terminal-connection-change', { 
                shellId: shellIdRef.current || '', 
                connected: false 
              });
            }
          );
        })
        .then(() => {
          callbacksRef.current.setIsConnected(true);
          eventBus.setCurrentShellId(shellId);
          // 发送连接状态变化事件
          eventBus.emit('terminal-connection-change', { 
            shellId: shellIdRef.current || '', 
            connected: true 
          });
          // 标记初始化完成
          hasInitializedRef.current = true;
          initializingRef.current = false;
        })
        .catch((error) => {
          console.error('[useTerminalInit] Failed to create shell:', error);
          terminal.write(`\r\n\x1b[31m连接失败: ${error}\x1b[0m\r\n`);
          // 重置初始化状态，允许重试
          hasInitializedRef.current = false;
          initializingRef.current = false;
        });
    } else {
      // 如果没有会话信息，也标记为初始化完成
      hasInitializedRef.current = true;
      initializingRef.current = false;
    }

    // 清理函数
    return () => {
      console.log('[useTerminalInit] Cleaning up terminal...');
      window.removeEventListener('resize', resizeHandler);

      // 断开 SSH 连接
      if (shellIdRef.current) {
        sshService.disconnect(shellIdRef.current).catch((error) => {
          console.error('[useTerminalInit] Failed to disconnect:', error);
        });
        // 清除终端输出缓存
        terminalOutputService.clearOutput(shellIdRef.current);
      }

      // 销毁终端和插件
      if (terminal) {
        terminal.dispose();
      }
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
      shellIdRef.current = null;

      // 重置初始化状态
      hasInitializedRef.current = false;
      initializingRef.current = false;
    };
  }, [isReady, containerRef]);
}; 

