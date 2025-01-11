import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { CopyOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import 'xterm/css/xterm.css';
import './index.css';

interface TerminalProps {
  sessionId?: string;
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

const Terminal: React.FC<TerminalProps> = ({ sessionId, config }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm>();
  const searchAddonRef = useRef<SearchAddon>();
  const fitAddonRef = useRef<FitAddon>();
  const [isReady, setIsReady] = useState(false);

  // 复制选中的文本
  const handleCopy = useCallback(() => {
    const selection = xtermRef.current?.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  }, []);

  // 搜索文本
  const handleSearch = useCallback(() => {
    const searchText = prompt('请输入要搜索的文本：');
    if (searchText && searchAddonRef.current) {
      searchAddonRef.current.findNext(searchText);
    }
  }, []);

  // 重新加载终端
  const handleReload = useCallback(() => {
    xtermRef.current?.clear();
    if (sessionId) {
      xtermRef.current?.writeln('重新连接到会话: ' + sessionId);
    } else {
      xtermRef.current?.writeln('欢迎使用 AI SSH Tool!');
      xtermRef.current?.writeln('请选择或创建一个会话来开始。');
    }
  }, [sessionId]);

  // 右键菜单项
  const menuItems: MenuProps['items'] = [
    {
      key: 'copy',
      label: '复制',
      icon: <CopyOutlined />,
      onClick: handleCopy
    },
    {
      key: 'search',
      label: '搜索',
      icon: <SearchOutlined />,
      onClick: handleSearch
    },
    {
      key: 'reload',
      label: '重新加载',
      icon: <ReloadOutlined />,
      onClick: handleReload
    }
  ];

  // 初始化终端
  const initTerminal = useCallback(() => {
    if (!terminalRef.current || !isReady) return;

    try {
      // 初始化 xterm
      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: config?.fontSize || 14,
        fontFamily: config?.fontFamily || 'Consolas, "Courier New", monospace',
        theme: {
          background: config?.theme?.background || '#1e1e1e',
          foreground: config?.theme?.foreground || '#ffffff',
          cursor: config?.theme?.cursor || '#ffffff',
          selectionBackground: config?.theme?.selectionBackground || 'rgba(255, 255, 255, 0.3)'
        }
      });

      // 添加插件
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();

      // 保存引用
      xtermRef.current = xterm;
      searchAddonRef.current = searchAddon;
      fitAddonRef.current = fitAddon;

      // 打开终端
      xterm.open(terminalRef.current);

      // 加载插件
      xterm.loadAddon(fitAddon);
      xterm.loadAddon(webLinksAddon);
      xterm.loadAddon(searchAddon);

      // 调整大小
      requestAnimationFrame(() => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
          } catch (error) {
            console.error('终端大小调整失败:', error);
          }
        }
      });

      // 如果有会话ID，连接到SSH
      if (sessionId) {
        xterm.writeln('连接到会话: ' + sessionId);
      } else {
        xterm.writeln('欢迎使用 AI SSH Tool!');
        xterm.writeln('请选择或创建一个会话来开始。');
      }

      // 监听窗口大小变化
      const handleResize = () => {
        if (fitAddonRef.current) {
          try {
            fitAddonRef.current.fit();
          } catch (error) {
            console.error('终端大小调整失败:', error);
          }
        }
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        xterm.dispose();
      };
    } catch (error) {
      console.error('终端初始化失败:', error);
    }
  }, [sessionId, config, isReady]);

  // 等待DOM准备就绪
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // 初始化终端
  useEffect(() => {
    const cleanup = initTerminal();
    return () => {
      cleanup?.();
    };
  }, [initTerminal]);

  return (
    <div className="terminal-container">
      <Dropdown menu={{ items: menuItems }} trigger={['contextMenu']}>
        <div ref={terminalRef} className="terminal" />
      </Dropdown>
    </div>
  );
};

export default Terminal; 