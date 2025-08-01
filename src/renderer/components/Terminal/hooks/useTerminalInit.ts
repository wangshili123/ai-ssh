import { useCallback, useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { sshService } from '../../../services/ssh';
import { eventBus } from '../../../services/eventBus';
import { TerminalShortcutConfigManager } from '../../../services/config/TerminalShortcutConfig';
import { terminalOutputService } from '../../../services/terminalOutput';
import type { SessionInfo } from '../../../../renderer/types/index';
import type { TerminalProps } from '../types/terminal.types';
import { waitForConnection } from '../utils/terminal.utils';
import { CompletionSSHManager } from '@/services/completion/CompletionSSHManager';
import { CommandOutputAnalyzer } from '../../../../services/terminal/analysis/CommandOutputAnalyzer';
import { CompletionService } from '@/services/completion/CompletionService';
import { debounce } from 'lodash';

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
  acceptSuggestion?: () => string | null;
  updatePendingCommand?: (newCommand: string) => void;
  clearSuggestion?: () => void;
  navigateSuggestions?: (direction: 'up' | 'down') => void;
  onOpenSearch?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onClear?: () => void;
  terminalRef: React.MutableRefObject<XTerm | null>;
  searchAddonRef: React.MutableRefObject<SearchAddon | null>;
  fitAddonRef: React.MutableRefObject<FitAddon | null>;
  shellIdRef: React.MutableRefObject<string | null>;
  pendingCommandRef: React.MutableRefObject<string>;
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
  acceptSuggestion,
  updatePendingCommand,
  clearSuggestion,
  navigateSuggestions,
  onOpenSearch,
  onCopy,
  onPaste,
  onClear,
  terminalRef,
  searchAddonRef,
  fitAddonRef,
  shellIdRef,
  pendingCommandRef,
}: UseTerminalInitProps) => {
  // 使用 ref 来跟踪初始化状态
  const hasInitializedRef = useRef(false);
  const initializingRef = useRef(false);

  // 使用 ref 存储回调函数，避免它们导致 useEffect 重新创建
  const callbacksRef = useRef({
    handleInput,
    handleEnterKey,
    setIsConnected,
    acceptSuggestion,
    updatePendingCommand,
    clearSuggestion,
    navigateSuggestions,
    onOpenSearch,
    onCopy,
    onPaste,
    onClear
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
      setIsConnected,
      acceptSuggestion,
      updatePendingCommand,
      clearSuggestion,
      navigateSuggestions,
      onOpenSearch,
      onCopy,
      onPaste,
      onClear
    };
    configRef.current = {
      sessionInfo,
      config,
      instanceId
    };
  }, [handleInput, handleEnterKey, setIsConnected, acceptSuggestion, updatePendingCommand, clearSuggestion, navigateSuggestions, onOpenSearch, onCopy, onPaste, onClear, sessionInfo, config, instanceId]);

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
      scrollback: 3000,
      convertEol: false,
      disableStdin: false,
      wordSeparator: ' ()[]{}\'"',
      windowsMode: process.platform === 'win32',
      lineHeight: 1.2,
      rightClickSelectsWord: false,
      scrollSensitivity: 0.3,
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 3,
      smoothScrollDuration: 200
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
    
    // 立即执行一次 fit 来设置正确的大小
    try {
      fitAddon.fit();
      console.log('[useTerminalInit] Initial terminal size:', { 
        cols: terminal.cols, 
        rows: terminal.rows 
      });
    } catch (error) {
      console.error('[useTerminalInit] Failed to fit terminal:', error);
    }

    // 保存引用
    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // 注册事件处理器
    terminal.onData(callbacksRef.current.handleInput);

    // 获取终端快捷键配置
    let shortcutConfig = {
      acceptCompletion: 'Ctrl+Tab',
      acceptCompletionAlt: 'Alt+/',
      clearCompletion: 'Escape',
      navigateUp: 'Alt+ArrowUp',
      navigateDown: 'Alt+ArrowDown',
      copy: 'Ctrl+Shift+C',
      paste: 'Ctrl+Shift+V',
      clear: 'Ctrl+Shift+L',
      search: 'Ctrl+Shift+F'
    };

    // 异步加载配置
    TerminalShortcutConfigManager.getInstance().getConfig().then(config => {
      shortcutConfig = config;
      console.log('[useTerminalInit] 快捷键配置已加载:', shortcutConfig);
    }).catch(error => {
      console.error('[useTerminalInit] 加载快捷键配置失败:', error);
    });

    // 添加全局键盘事件监听器作为备用方案
    const handleGlobalKeyDown = async (ev: KeyboardEvent) => {
      // 检查是否在终端容器内或终端有焦点
      const terminalContainer = containerRef.current;
      const isTerminalFocused = terminalContainer && (
        terminalContainer.contains(document.activeElement) ||
        document.activeElement === terminalContainer ||
        terminal.hasSelection()
      );

      if (!isTerminalFocused) {
        return;
      }

      // 处理复制快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.copy)) {
        const selection = terminal.getSelection();
        if (selection) {
          ev.preventDefault();
          console.log('[useTerminalInit] Global copy shortcut pressed:', shortcutConfig.copy);
          if (callbacksRef.current.onCopy) {
            callbacksRef.current.onCopy();
          }
        }
        return;
      }

      // 处理粘贴快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.paste)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Global paste shortcut pressed:', shortcutConfig.paste);
        if (callbacksRef.current.onPaste) {
          callbacksRef.current.onPaste();
        }
        return;
      }

      // 处理清空终端快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.clear)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Global clear shortcut pressed:', shortcutConfig.clear);
        if (callbacksRef.current.onClear) {
          callbacksRef.current.onClear();
        }
        return;
      }

      // 处理搜索快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.search)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Global search shortcut pressed:', shortcutConfig.search);
        if (callbacksRef.current.onOpenSearch) {
          callbacksRef.current.onOpenSearch();
        }
        return;
      }
    };

    // 注册全局键盘事件监听器
    document.addEventListener('keydown', handleGlobalKeyDown);

    // 移除currentCommand变量，直接使用pendingCommandRef
    const tabId = eventBus.getCurrentTabId() || '';

    terminal.onKey(async (event) => {
      const ev = event.domEvent;

      // 添加调试信息
      if (ev.ctrlKey && ev.shiftKey) {
        console.log('[useTerminalInit] Ctrl+Shift key detected:', {
          key: ev.key,
          ctrlKey: ev.ctrlKey,
          shiftKey: ev.shiftKey,
          altKey: ev.altKey,
          metaKey: ev.metaKey
        });
      }

      // 处理接受补全建议的快捷键（主要快捷键）
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.acceptCompletion)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Accept completion shortcut pressed:', shortcutConfig.acceptCompletion);

        // 尝试接受当前的补全建议
        const currentCommand = pendingCommandRef.current;
        const acceptedCommand = callbacksRef.current.acceptSuggestion?.();
        if (acceptedCommand) {
          console.log('[useTerminalInit] Accepted suggestion:', acceptedCommand);
          // 计算需要写入的补全部分
          const completionPart = acceptedCommand.slice(currentCommand.length);
          console.log('[useTerminalInit] Writing completion part:', { currentCommand, acceptedCommand, completionPart });

          // 只发送补全部分到SSH服务，让SSH回显显示，避免重复
          if (completionPart) {
            const shellId = shellIdRef.current;
            if (shellId) {
              try {
                await sshService.write(shellId, completionPart);
              } catch (error) {
                console.error('[useTerminalInit] Failed to send completion to SSH:', error);
                // 如果SSH发送失败，则在本地显示
                terminal.write(completionPart);
              }
            } else {
              // 如果没有SSH连接，则在本地显示
              terminal.write(completionPart);
            }
          }
        } else {
          console.log('[useTerminalInit] No suggestion to accept');
          // 如果没有补全建议且是Tab键，发送Tab字符到终端
          if (shortcutConfig.acceptCompletion === 'Tab') {
            await callbacksRef.current.handleInput('\t');
          }
        }
        return;
      }

      // 处理接受补全建议的备用快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.acceptCompletionAlt)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Accept completion alt shortcut pressed:', shortcutConfig.acceptCompletionAlt);

        // 尝试接受当前的补全建议
        const currentCommand = pendingCommandRef.current;
        const acceptedCommand = callbacksRef.current.acceptSuggestion?.();
        if (acceptedCommand) {
          console.log('[useTerminalInit] Accepted suggestion via alt shortcut:', acceptedCommand);
          // 计算需要写入的补全部分
          const completionPart = acceptedCommand.slice(currentCommand.length);
          console.log('[useTerminalInit] Writing completion part via alt shortcut:', { currentCommand, acceptedCommand, completionPart });

          // 只发送补全部分到SSH服务，让SSH回显显示，避免重复
          if (completionPart) {
            const shellId = shellIdRef.current;
            if (shellId) {
              try {
                await sshService.write(shellId, completionPart);
              } catch (error) {
                console.error('[useTerminalInit] Failed to send completion to SSH:', error);
                // 如果SSH发送失败，则在本地显示
                terminal.write(completionPart);
              }
            } else {
              // 如果没有SSH连接，则在本地显示
              terminal.write(completionPart);
            }
          }
        } else {
          console.log('[useTerminalInit] No suggestion to accept via alt shortcut');
        }
        return;
      }

      // 处理清除补全建议的快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.clearCompletion)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Clear completion shortcut pressed:', shortcutConfig.clearCompletion);
        // 清除补全建议
        if (callbacksRef.current.clearSuggestion) {
          callbacksRef.current.clearSuggestion();
        }
        return;
      }

      // 处理向上导航补全建议的快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.navigateUp)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Navigate up shortcut pressed:', shortcutConfig.navigateUp);
        if (callbacksRef.current.navigateSuggestions) {
          callbacksRef.current.navigateSuggestions('up');
        }
        return;
      }

      // 处理向下导航补全建议的快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.navigateDown)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Navigate down shortcut pressed:', shortcutConfig.navigateDown);
        if (callbacksRef.current.navigateSuggestions) {
          callbacksRef.current.navigateSuggestions('down');
        }
        return;
      }

      // 处理搜索快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.search)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Search shortcut pressed:', shortcutConfig.search);
        if (callbacksRef.current.onOpenSearch) {
          callbacksRef.current.onOpenSearch();
        }
        return;
      }

      // 处理复制快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.copy)) {
        // 只有当有选中文本时才处理复制
        const selection = terminal.getSelection();
        if (selection) {
          ev.preventDefault();
          console.log('[useTerminalInit] Copy shortcut pressed:', shortcutConfig.copy);
          if (callbacksRef.current.onCopy) {
            callbacksRef.current.onCopy();
          }
          return;
        }
      }

      // 处理粘贴快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.paste)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Paste shortcut pressed:', shortcutConfig.paste);
        if (callbacksRef.current.onPaste) {
          callbacksRef.current.onPaste();
        }
        return;
      }

      // 处理清空终端快捷键
      if (TerminalShortcutConfigManager.matchesShortcut(ev, shortcutConfig.clear)) {
        ev.preventDefault();
        console.log('[useTerminalInit] Clear shortcut pressed:', shortcutConfig.clear);
        if (callbacksRef.current.onClear) {
          callbacksRef.current.onClear();
        }
        return;
      }
      
      // 处理回车键 - 不再在这里处理回车，让onData处理
      if (ev.key === 'Enter') {
        // 使用pendingCommandRef获取完整命令
        const command = pendingCommandRef.current.trim();
        
        // 如果是 cd 命令则发送事件
        if (command.startsWith('cd ') || command === 'cd' || command === '..' || command === '.') {
          // 等待一小段时间确保 cd 命令执行完成
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 标准化 cd 命令
          const normalizedCommand = command === '..' ? 'cd ..' : 
                                  command === '.' ? 'cd .' :
                                  command;
          
          // 发送目录变更事件到补全服务
          console.log('[useTerminalInit] Sending directory change event for tab:', tabId, 'command:', normalizedCommand);
          eventBus.emit('terminal:directory-change', {
            tabId,
            command: normalizedCommand
          });
        }
        return;
      }
    });

    // 优化resize处理函数
    const resizeHandler = async () => {
      if (!containerRef.current || !terminal || !fitAddon) return;
      
      try {
        // 获取容器尺寸
        const { width, height } = containerRef.current.getBoundingClientRect();
        console.log('[useTerminalInit] Container size:', { width, height });
        
        // 先获取当前尺寸
        const oldCols = terminal.cols;
        const oldRows = terminal.rows;
        
        // 执行fit
        fitAddon.fit();
        
        // 获取新的尺寸
        const newCols = terminal.cols;
        const newRows = terminal.rows;
        
        // 只有当尺寸真的变化时才进行处理
        if (oldCols !== newCols || oldRows !== newRows) {
          console.log('[useTerminalInit] Size changed:', { 
            old: { cols: oldCols, rows: oldRows },
            new: { cols: newCols, rows: newRows }
          });
          
          // 如果已连接，先发送新的尺寸到SSH服务
          if (shellIdRef.current) {
            try {
              await sshService.resize(shellIdRef.current, newCols, newRows);
              console.log('[useTerminalInit] SSH resize successful');
            } catch (error) {
              console.error('[useTerminalInit] Failed to resize SSH:', error);
            }
          }
          
          // 刷新终端显示
          terminal.refresh(0, terminal.rows - 1);
        }
      } catch (error) {
        console.error('[useTerminalInit] Error in resize handler:', error);
      }
    };

    // 添加防抖处理，使用较短的延迟时间
    const debouncedResize = debounce(resizeHandler, 50);

    // 注册resize事件
    window.addEventListener('resize', debouncedResize);
    // 监听容器大小变化
    const resizeObserver = new ResizeObserver(debouncedResize);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    // 监听终端大小变化
    terminal.onResize(({ cols, rows }) => {
      console.log('[useTerminalInit] Terminal resized:', { cols, rows });
      if (shellIdRef.current) {
        // 直接调用 resizeHandler 而不是单独发送 resize 命令
        resizeHandler().catch(error => {
          console.error('[useTerminalInit] Failed to handle terminal resize:', error);
        });
      }
    });

    // 如果有会话信息，创建 SSH 连接
    if (configRef.current.sessionInfo) {
      console.log('[useTerminalInit] Creating SSH connection...');
      const shellId = configRef.current.sessionInfo.id + (configRef.current.instanceId ? `-${configRef.current.instanceId}` : '');
      shellIdRef.current = shellId;

      // 设置补全服务的会话信息

      const completionSSHManager = CompletionSSHManager.getInstance();
      completionSSHManager.setSessionForTab(tabId, configRef.current.sessionInfo);

      // 等待连接就绪（添加超时处理）
      Promise.race([
        waitForConnection(configRef.current.sessionInfo),
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Connection timeout after 30 seconds'));
          }, 30000); // 30秒超时
        })
      ])
        .then(() => {
          return sshService.createShell(
            shellId,
            (data) => {
              terminal.write(data);
              // 收集终端输出
              terminalOutputService.addOutput(shellId, data);
              // 添加到命令分析器
              CommandOutputAnalyzer.getInstance().addOutput(shellId, data);

              // 如果看到提示符，说明命令执行完成
              if (data.includes('$') || data.includes('#') || data.includes('>')) {
                CommandOutputAnalyzer.getInstance().analyzeAndCollect(shellId, {
                  shouldCollectHistory: true,
                  shouldCollectUsage: true
                }).catch(error => {
                  console.error('[useTerminalInit] Failed to analyze command:', error);
                });
              }
            },
            () => {
              console.log('[useTerminalInit] Shell连接关闭回调触发');
              callbacksRef.current.setIsConnected(false);
              shellIdRef.current = '';
              eventBus.setCurrentShellId('');
              // terminal.write('\r\n\x1b[31m连接已关闭\x1b[0m\r\n');
              // terminal.write('\x1b[33m提示：可以右键选择"重新加载"尝试重新连接\x1b[0m\r\n');
              // 清除终端输出缓存
              terminalOutputService.clearOutput(shellId);
              // 发送连接状态变化事件
              eventBus.emit('terminal-connection-change', {
                shellId: shellIdRef.current || '',
                connected: false
              });
            },
            {
              cols: terminal.cols,
              rows: terminal.rows
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
      window.removeEventListener('resize', debouncedResize);
      document.removeEventListener('keydown', handleGlobalKeyDown);
      resizeObserver.disconnect();

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

