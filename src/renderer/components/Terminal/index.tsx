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
      }
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
    fitAddon.fit();
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
        shellIdRef.current = shellId;
        eventBus.setCurrentShellId(shellId);
        // 发送连接状态变化事件
        eventBus.emit('terminal-connection-change', { shellId, connected: true });

        // 自动聚焦终端
        terminal.focus();

        // 处理终端输入
        terminal.onData((data) => {
          if (shellIdRef.current) {
            console.log('Terminal input:', data);
            sshService.write(shellIdRef.current, data).catch((error) => {
              console.error('Failed to write to shell:', error);
              terminal.write('\r\n\x1b[31m写入失败: ' + error.message + '\x1b[0m\r\n');
            });
          }
        });

        // 处理终端大小调整
        const handleResize = () => {
          if (fitAddon && terminal && shellIdRef.current && isConnected) {
            fitAddon.fit();
            const { rows, cols } = terminal;
            sshService.resize(shellIdRef.current, rows, cols).catch(console.error);
          }
        };

        // 延迟一下再调整大小，确保 shell 已经准备好
        setTimeout(handleResize, 500);

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