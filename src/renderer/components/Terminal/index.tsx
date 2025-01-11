import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { sshService } from '../../services/ssh';
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
}

const Terminal: React.FC<TerminalProps> = ({ sessionInfo, config }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm>();
  const fitAddonRef = useRef<FitAddon>();
  const searchAddonRef = useRef<SearchAddon>();
  const [isReady, setIsReady] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  // 初始化终端
  const initTerminal = useCallback(async () => {
    if (!containerRef.current || !isReady) return;

    try {
      // 创建终端实例
      const terminal = new XTerm({
        fontSize: config?.fontSize || 14,
        fontFamily: config?.fontFamily || 'Consolas, monospace',
        theme: {
          background: config?.theme?.background || '#1e1e1e',
          foreground: config?.theme?.foreground || '#ffffff',
          cursor: config?.theme?.cursor || '#ffffff',
          selectionBackground: config?.theme?.selectionBackground || 'rgba(255, 255, 255, 0.3)'
        },
        cursorBlink: true,
        cursorStyle: 'block',
        allowTransparency: true,
        scrollback: 1000,
        cols: 80,
        rows: 24
      });

      // 添加插件
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      fitAddonRef.current = fitAddon;

      const webLinksAddon = new WebLinksAddon();
      terminal.loadAddon(webLinksAddon);

      const searchAddon = new SearchAddon();
      terminal.loadAddon(searchAddon);
      searchAddonRef.current = searchAddon;

      // 打开终端
      terminal.open(containerRef.current);
      terminalRef.current = terminal;

      // 调整大小
      fitAddon.fit();

      // 如果有会话信息,尝试连接
      if (sessionInfo) {
        try {
          console.log('Connecting to SSH server...');
          await sshService.connect(sessionInfo);
          console.log('SSH connection established');
          setIsConnected(true);

          // 创建shell并处理数据
          console.log('Creating shell session...');
          await sshService.createShell(
            sessionInfo.id,
            (data) => {
              console.log('Terminal received data:', data);
              terminal.write(data);
            },
            () => {
              console.log('SSH connection closed');
              setIsConnected(false);
              terminal.write('\r\n\x1b[31m连接已关闭\x1b[0m\r\n');
            }
          );
          console.log('Shell session created');

          // 发送初始终端大小
          const { cols, rows } = terminal;
          console.log('Setting initial terminal size:', { cols, rows });
          await sshService.resize(sessionInfo.id, cols, rows);

          // 监听用户输入
          terminal.onData((data) => {
            if (isConnected) {
              console.log('Terminal sending data:', data);
              sshService.write(sessionInfo.id, data).catch(console.error);
            }
          });

          // 监听终端大小变化
          terminal.onResize(({ cols, rows }) => {
            if (isConnected) {
              console.log('Terminal resized:', { cols, rows });
              sshService.resize(sessionInfo.id, cols, rows).catch(console.error);
            }
          });

        } catch (error) {
          console.error('Failed to connect:', error);
          terminal.write(`\r\n\x1b[31m连接失败: ${error}\x1b[0m\r\n`);
        }
      } else {
        terminal.write('请选择一个会话连接...\r\n');
      }

      // 监听窗口大小变化
      const resizeObserver = new ResizeObserver(() => {
        fitAddon.fit();
        if (sessionInfo && isConnected) {
          const { cols, rows } = terminal;
          sshService.resize(sessionInfo.id, cols, rows).catch(console.error);
        }
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
        if (isConnected && sessionInfo) {
          sshService.disconnect(sessionInfo.id).catch(console.error);
        }
        terminal.dispose();
      };
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
    }
  }, [sessionInfo, config, isReady, isConnected]);

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
    if (terminalRef.current) {
      terminalRef.current.clear();
      if (sessionInfo && isConnected) {
        try {
          await sshService.disconnect(sessionInfo.id);
          await sshService.connect(sessionInfo);
          await sshService.createShell(
            sessionInfo.id,
            (data) => {
              terminalRef.current?.write(data);
            },
            () => {
              setIsConnected(false);
              terminalRef.current?.write('\r\n\x1b[31m连接已关闭\x1b[0m\r\n');
            }
          );
        } catch (error) {
          console.error('Failed to reload terminal:', error);
          terminalRef.current.write(`\r\n\x1b[31m重新连接失败: ${error}\x1b[0m\r\n`);
        }
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
    <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
      <div ref={containerRef} className="terminal-container" />
    </Dropdown>
  );
};

export default Terminal; 