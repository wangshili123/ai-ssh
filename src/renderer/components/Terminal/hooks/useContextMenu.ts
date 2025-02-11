import { useCallback } from 'react';
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
}: UseContextMenuProps): UseContextMenuReturn => {
  // 复制选中的文本
  const copySelectedText = useCallback(() => {
    console.log('[useContextMenu] Copying selected text');
    const selection = terminalRef.current?.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection);
    }
  }, [terminalRef]);

  // 搜索文本
  const searchText = useCallback(() => {
    console.log('[useContextMenu] Opening search dialog');
    const text = prompt('请输入要搜索的文本:');
    if (text && searchAddonRef.current) {
      searchAddonRef.current.findNext(text);
    }
  }, [searchAddonRef]);

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

  return {
    menuItems
  };
}; 