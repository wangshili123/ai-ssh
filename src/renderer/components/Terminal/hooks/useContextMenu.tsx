import React, { useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { SearchAddon } from 'xterm-addon-search';
import type { MenuProps } from 'antd';
import { sshService } from '../../../services/ssh';
import { eventBus } from '../../../services/eventBus';
import { terminalOutputService } from '../../../services/terminalOutput';
import type { SessionInfo } from '../../../../renderer/types/index';
import { waitForConnection } from '../utils/terminal.utils';

interface UseContextMenuProps {
  terminalRef: React.MutableRefObject<XTerm | null>;
  searchAddonRef: React.MutableRefObject<SearchAddon | null>;
  shellIdRef: React.MutableRefObject<string | null>;
  sessionInfo?: SessionInfo;
  instanceId?: string;
  setIsConnected: (connected: boolean) => void;
  onOpenSearch: () => void;
}

interface UseContextMenuReturn {
  menuItems: NonNullable<MenuProps['items']>;
}

export const useContextMenu = ({
  terminalRef,
  searchAddonRef,
  shellIdRef,
  sessionInfo,
  instanceId,
  setIsConnected,
  onOpenSearch,
}: UseContextMenuProps): UseContextMenuReturn => {
  
  // 复制选中的文本
  const copySelectedText = useCallback(() => {
    console.log('[useContextMenu] Copying selected text');
    const selection = terminalRef.current?.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  }, [terminalRef]);

  // 粘贴文本
  const pasteText = useCallback(async () => {
    console.log('[useContextMenu] Pasting text from clipboard');
    try {
      // 检查终端和连接状态
      if (!terminalRef.current || !shellIdRef.current) {
        console.warn('[useContextMenu] Terminal not ready for paste operation');
        return;
      }

      // 从剪贴板读取文本
      const text = await navigator.clipboard.readText();
      if (text) {
        // 将文本发送到远程终端
        await sshService.write(shellIdRef.current, text);
        console.log('[useContextMenu] Text pasted successfully');
      } else {
        console.log('[useContextMenu] Clipboard is empty');
      }
    } catch (error) {
      console.error('[useContextMenu] Failed to paste text:', error);
      // 如果剪贴板访问失败，可以在终端显示提示
      if (terminalRef.current) {
        terminalRef.current.write('\r\n\x1b[33m粘贴失败: 无法访问剪贴板\x1b[0m\r\n');
      }
    } finally {
      // 重新聚焦到终端
      if (terminalRef.current) {
        terminalRef.current.focus();
      }
    }
  }, [terminalRef, shellIdRef]);

  // 搜索文本
  const searchText = useCallback(() => {
    console.log('[useContextMenu] Opening search panel');
    onOpenSearch();
  }, [onOpenSearch]);

  // 清空终端内容
  const clearTerminal = useCallback(() => {
    console.log('[useContextMenu] Clearing terminal content');
    if (terminalRef.current) {
      terminalRef.current.clear();
      console.log('[useContextMenu] Terminal content cleared successfully');
      // 重新聚焦到终端
      terminalRef.current.focus();
    }
  }, [terminalRef]);

  // 重新加载终端
  const reloadTerminal = useCallback(async () => {
    console.log('[useContextMenu] Reloading terminal');
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
        console.error('[useContextMenu] Failed to reload terminal:', error);
        terminalRef.current.write(`\r\n\x1b[31m重新连接失败: ${error}\x1b[0m\r\n`);
      }
    }
  }, [terminalRef, shellIdRef, sessionInfo, instanceId, setIsConnected]);

  // 右键菜单项
  const menuItems: NonNullable<MenuProps['items']> = [
    {
      key: 'copy',
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>复制</span>
          <span style={{ color: '#999', fontSize: '12px', marginLeft: '20px' }}>Ctrl+Shift+C</span>
        </div>
      ),
      onClick: copySelectedText
    },
    {
      key: 'paste',
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>粘贴</span>
          <span style={{ color: '#999', fontSize: '12px', marginLeft: '20px' }}>Ctrl+Shift+V</span>
        </div>
      ),
      onClick: pasteText
    },
    {
      key: 'search',
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>搜索</span>
          <span style={{ color: '#999', fontSize: '12px', marginLeft: '20px' }}>Ctrl+Shift+F</span>
        </div>
      ),
      onClick: searchText
    },
    {
      key: 'clear',
      label: (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>清空</span>
          <span style={{ color: '#999', fontSize: '12px', marginLeft: '20px' }}>Ctrl+Shift+L</span>
        </div>
      ),
      onClick: clearTerminal
    },
    {
      key: 'reload',
      label: '重新加载',
      onClick: reloadTerminal
    }
  ];

  return {
    menuItems,
  };
}; 