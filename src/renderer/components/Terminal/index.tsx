import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import 'xterm/css/xterm.css';
import './index.css';

interface TerminalProps {
  sessionInfo?: SessionInfo;
  config?: {
    fontSize?: number;
    fontFamily?: string;
    theme?: {
      background?: string;
      foreground?: string;
      cursor?: string;
      selectionBackground?: string;
    };
  };
  instanceId?: string;
}

const Terminal: React.FC<TerminalProps> = ({ sessionInfo, config, instanceId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm>();
  const fitAddonRef = useRef<FitAddon>();
  const searchAddonRef = useRef<SearchAddon>();
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const shellIdRef = useRef<string>('');
  const [currentInput, setCurrentInput] = useState('');
  const [suggestionTimeout, setSuggestionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [completionService, setCompletionService] = useState<CompletionService | null>(null);
  const pendingCommandRef = useRef('');

  // 等待 SSH 连接就绪
  const waitForConnection = async (sessionInfo: SessionInfo): Promise<void> => {
    let retries = 5;
    while (retries > 0) {
      try {
        await sshService.connect(sessionInfo);
        return;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  };

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

  // 更新命令的函数
  const updatePendingCommand = useCallback((newCommand: string) => {
    console.log('Updating pending command from:', pendingCommandRef.current, 'to:', newCommand);
    pendingCommandRef.current = newCommand;
  }, []);

  // 处理命令输入
  const handleInput = async (data: string) => {
    console.log('handleInput called with data:', data);
    if (!terminalRef.current) return;
    console.log('terminalRef.current:', terminalRef.current);
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
            console.error('Failed to write to shell:', error);
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
            console.error('Failed to write to shell:', error);
            terminal.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
          });
        }
        
        // 更新待处理的命令
        const newInput = pendingCommandRef.current.slice(0, -1);
        console.log('Updated pending command (backspace):', newInput);
        updatePendingCommand(newInput);
        
        // 清除当前建议
        completionService?.clearSuggestion();
        // 重新开始补全计时
        if (newInput) {
          startSuggestionTimer(newInput);
        }
      }
      return;
    }

    // 普通字符输入
    // 先更新待处理的命令
    const newInput = pendingCommandRef.current + data;
    updatePendingCommand(newInput);
    
    // 清除当前建议并重新开始补全计时器
    completionService?.clearSuggestion();
    startSuggestionTimer(newInput);
    
    // 然后发送到SSH
    if (shellIdRef.current) {
      await sshService.write(shellIdRef.current, data).catch((error) => {
        console.error('Failed to write to shell:', error);
        terminal.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
      });
    }
  };

  // 计算补全弹窗位置
  const calculatePopupPosition = () => {
    if (!terminalRef.current || !containerRef.current) {
      return { left: 0, top: 0 };
    }

    const terminal = terminalRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // 获取当前光标位置
    const cursorElement = container.querySelector('.xterm-cursor');
    if (!cursorElement) {
      return { left: rect.left, top: rect.bottom };
    }

    const cursorRect = cursorElement.getBoundingClientRect();
    return {
      left: cursorRect.left,
      top: cursorRect.bottom + 5
    };
  };

  // 处理补全选择
  const handleCompletionSelect = (suggestion: string) => {
    if (!terminalRef.current) return;

    // 清除当前输入
    const terminal = terminalRef.current;
    const linesToClear = currentInput.length;
    for (let i = 0; i < linesToClear; i++) {
      terminal.write('\b \b');
    }

    // 写入选中的补全
    terminal.write(suggestion);
    setCurrentInput(suggestion);
  };

  // 处理补全取消
  const handleCompletionCancel = () => {
    // No need to handle completion cancel as it's removed from the component
  };

  // 处理命令执行
  const handleCommandExecution = async (command: string) => {
    if (!command.trim()) return;

    // 记录命令
    await completionService?.recordCommand(command);
    setCurrentInput('');
  };

  // 处理回车键
  const handleEnterKey = useCallback(async () => {
    console.log('Enter key handler called, current pendingCommand:', pendingCommandRef.current);
    const commandToRecord = pendingCommandRef.current.trim();
    
    if (shellIdRef.current) {
      console.log('Processing Enter key, command to record:', commandToRecord);
      // 发送回车到SSH
      try {
        await sshService.write(shellIdRef.current, '\r');
        
        // 如果有命令要记录
        if (commandToRecord) {
          console.log('Recording command:', commandToRecord);
          try {
            await completionService?.recordCommand(commandToRecord);
            console.log('Command recorded successfully');
          } catch (error: any) {
            console.error('Failed to record command:', error);
          }
        }
        
        // 清除状态
        updatePendingCommand('');
        completionService?.clearSuggestion();
        if (suggestionTimeout) {
          clearTimeout(suggestionTimeout);
          setSuggestionTimeout(null);
        }
      } catch (error: any) {
        console.error('Failed to write to shell:', error);
        if (terminalRef.current) {
          terminalRef.current.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
        }
      }
    }
  }, [completionService, suggestionTimeout, updatePendingCommand]);

  // 初始化终端
  const initTerminal = useCallback(async () => {
    if (!containerRef.current || !isReady) {
      return;
    }

    // 创建终端实例
    const terminal = new XTerm({
      cursorBlink: true,
      fontSize: config?.fontSize || 14,
      fontFamily: config?.fontFamily || 'Consolas, "Courier New", monospace',
      theme: {
        background: config?.theme?.background || '#000000',
        foreground: config?.theme?.foreground || '#ffffff'
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
    
    // 处理终端大小调整
    const handleResize = () => {
      console.log('Terminal handleResize called');
      if (!fitAddon || !terminal || !containerRef.current) {
        console.log('Terminal or fitAddon not ready');
        return;
      }

      const currentCols = terminal.cols;
      const currentRows = terminal.rows;
      
      // 获取容器大小
      const { clientHeight, clientWidth } = containerRef.current;
      console.log('Container size:', { clientHeight, clientWidth });
      
      // 执行自适应
      try {
        fitAddon.fit();
        console.log('FitAddon.fit() executed');
      } catch (error) {
        console.error('FitAddon.fit() failed:', error);
        return;
      }
      
      // 获取自适应后的大小
      const newCols = terminal.cols;
      const newRows = terminal.rows;
      
      console.log('New terminal size:', { newCols, newRows });
      
      // 如果大小有变化且已连接，通知服务器
      if ((newCols !== currentCols || newRows !== currentRows) && shellIdRef.current && isConnected) {
        console.log('Sending resize to server:', { shellId: shellIdRef.current, newCols, newRows });
        sshService.resize(shellIdRef.current, newRows, newCols).catch(error => {
          console.error('Failed to resize terminal:', error);
        });
      }
    };

    // 初始化大小
    handleResize();
    terminalRef.current = terminal;

    // 连接 SSH
    if (sessionInfo) {
      try {
        // 等待连接就绪
        await waitForConnection(sessionInfo);
        
        const shellId = sessionInfo.id + (instanceId ? `-${instanceId}` : '');
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
            setIsConnected(false);
            shellIdRef.current = '';
            eventBus.setCurrentShellId('');
            terminal.write('\r\n\x1b[31m连接已关闭\x1b[0m\r\n');
            // 清除终端输出缓存
            terminalOutputService.clearOutput(shellId);
            // 发送连接状态变化事件
            eventBus.emit('terminal-connection-change', { shellId, connected: false });
          }
        );

        setIsConnected(true);
        eventBus.setCurrentShellId(shellId);
        // 发送连接状态变化事件
        eventBus.emit('terminal-connection-change', { shellId, connected: true });

        // 自动聚焦终端
        terminal.focus();

        // 设置终端事件处理
        terminal.onData(handleInput);
        
        // 添加键盘事件监听器
        terminal.onKey(({ key, domEvent }) => {
          // 如果是回车键
          if (domEvent.key === 'Enter') {
            handleEnterKey();
          }
        });

        // 监听窗口大小变化
        window.addEventListener('resize', handleResize);

        // 清理函数
        return () => {
          window.removeEventListener('resize', handleResize);
          if (shellIdRef.current) {
            sshService.disconnect(shellIdRef.current).catch(console.error);
            shellIdRef.current = '';
          }
          setIsConnected(false);
          terminal.dispose();
        };
      } catch (error) {
        console.error('Failed to connect:', error);
        terminal.write(`\r\n\x1b[31m连接失败: ${error}\x1b[0m\r\n`);
        return () => {
          terminal.dispose();
        };
      }
    } else {
      terminal.write('请选择一个会话连接...\r\n');
      return () => {
        terminal.dispose();
      };
    }
  }, [sessionInfo, config, isReady, instanceId]);

  // 在组件挂载后设置 isReady
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // 初始化终端
  useEffect(() => {
    const cleanup = initTerminal();
    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, [initTerminal]);

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
        eventBus.emit('terminal-connection-change', { shellId: shellIdRef.current, connected: false });

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
            eventBus.emit('terminal-connection-change', { shellId, connected: false });
          }
        );

        setIsConnected(true);
        eventBus.setCurrentShellId(shellId);
        // 发送连接状态变化事件
        eventBus.emit('terminal-connection-change', { shellId, connected: true });
      } catch (error) {
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