import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import 'xterm/css/xterm.css';
import './index.css';

interface TerminalProps {
  sessionId?: string;
}

const Terminal: React.FC<TerminalProps> = ({ sessionId }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm>();

  useEffect(() => {
    if (!terminalRef.current) return;

    // 初始化 xterm
    const xterm = new XTerm({
      cursorBlink: true,
      theme: {
        background: '#1e1e1e',
        foreground: '#ffffff'
      }
    });

    // 添加插件
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    // 打开终端
    xterm.open(terminalRef.current);
    fitAddon.fit();

    // 保存引用
    xtermRef.current = xterm;

    // 监听窗口大小变化
    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    // 如果有会话ID，连接到SSH
    if (sessionId) {
      // TODO: 实现SSH连接
      xterm.writeln('Connected to session: ' + sessionId);
    } else {
      xterm.writeln('Welcome to AI SSH Tool!');
      xterm.writeln('Please select or create a session to start.');
    }

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
      xterm.dispose();
    };
  }, [sessionId]);

  return (
    <div className="terminal-container">
      <div ref={terminalRef} className="terminal" />
    </div>
  );
};

export default Terminal; 