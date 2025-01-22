import React, { useState, useEffect } from 'react';
import { Tabs, Badge } from 'antd';
import type { SessionInfo } from '../../../main/services/storage';
import Terminal from '../Terminal';
import { eventBus } from '../../services/eventBus';
import { sftpConnectionManager } from '../../services/sftpConnectionManager';
import './index.css';

interface TerminalTab {
  key: string;
  title: string;
  sessionInfo?: SessionInfo;
  instanceId: string;
  tabId: string;
  connected: boolean;
}

interface TerminalTabsProps {
  sessionInfo?: SessionInfo;
  triggerNewTab?: number;
  onTabChange?: (session: SessionInfo) => void;
}

const TerminalTabs: React.FC<TerminalTabsProps> = ({ 
  sessionInfo, 
  triggerNewTab,
  onTabChange 
}) => {
  const [activeKey, setActiveKey] = useState<string>();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [mounted, setMounted] = useState(false);

  // 初始化默认标签页
  useEffect(() => {
    if (!mounted) {
      console.log('[TerminalTabs] 初始化默认标签页');
      eventBus.debugState();

      const instanceId = Date.now().toString();
      const tabId = `tab-${instanceId}`;
      const defaultTab = {
        key: '1',
        title: sessionInfo?.name || '终端 1',
        sessionInfo,
        instanceId,
        tabId,
        connected: false
      };

      console.log('[TerminalTabs] 创建默认标签页:', defaultTab);

      // 先设置状态
      setTabs([defaultTab]);
      setActiveKey(defaultTab.key);

      // 如果有会话信息，设置 shellId 和触发事件
      if (sessionInfo) {
        const shellId = `${sessionInfo.id}-${instanceId}`;
        console.log('[TerminalTabs] 设置初始状态:', { shellId, tabId });
        
        // 清理可能存在的临时状态
        const tempTabId = `temp-${sessionInfo.id}`;
        eventBus.removeTab(tempTabId);
        sftpConnectionManager.closeConnection(tempTabId);

        // 先设置 tabId 和 shellId
        eventBus.setCurrentTabId(tabId);
        eventBus.setCurrentShellId(shellId);
        // 再触发事件
        eventBus.emit('tab-change', { shellId, tabId, sessionInfo });
        onTabChange?.(sessionInfo);

        console.log('[TerminalTabs] 初始化完成');
        eventBus.debugState();
      }
      setMounted(true);
    }
  }, []);

  // 监听 triggerNewTab 的变化来创建新标签页
  useEffect(() => {
    if (mounted && sessionInfo && triggerNewTab) {
      const instanceId = Date.now().toString();
      const tabId = `tab-${instanceId}`;
      const newTab = {
        key: String(tabs.length + 1),
        title: sessionInfo.name || `终端 ${tabs.length + 1}`,
        sessionInfo,
        instanceId,
        tabId,
        connected: false
      };

      // 先设置状态
      setTabs(prev => [...prev, newTab]);
      setActiveKey(newTab.key);

      // 设置 shellId 和触发事件
      const shellId = `${sessionInfo.id}-${instanceId}`;
      // 先设置 tabId 和 shellId
      eventBus.setCurrentTabId(tabId);
      eventBus.setCurrentShellId(shellId);
      // 再触发事件
      eventBus.emit('tab-change', { shellId, tabId });
      onTabChange?.(sessionInfo);
    }
  }, [triggerNewTab, sessionInfo]);

  // 监听连接状态变化
  useEffect(() => {
    const handleConnectionChange = (data: { shellId: string; connected: boolean }) => {
      setTabs(prevTabs => 
        prevTabs.map(tab => {
          const tabShellId = tab.sessionInfo?.id + (tab.instanceId ? `-${tab.instanceId}` : '');
          if (tabShellId === data.shellId) {
            return { ...tab, connected: data.connected };
          }
          return tab;
        })
      );
    };

    eventBus.on('terminal-connection-change', handleConnectionChange);
    return () => {
      eventBus.off('terminal-connection-change', handleConnectionChange);
    };
  }, []);

  // 处理标签页切换
  const handleTabChange = (activeKey: string) => {
    console.log('[TerminalTabs] 切换标签页:', activeKey);
    setActiveKey(activeKey);

    const tab = tabs.find(t => t.key === activeKey);
    if (tab && tab.sessionInfo) {
      console.log('[TerminalTabs] 找到标签页:', tab);
      const shellId = `${tab.sessionInfo.id}-${tab.instanceId}`;
      eventBus.setCurrentTabId(tab.tabId);
      eventBus.setCurrentShellId(shellId);
      eventBus.emit('tab-change', { 
        shellId, 
        tabId: tab.tabId,
        sessionInfo: tab.sessionInfo 
      });
      onTabChange?.(tab.sessionInfo);
    } else {
      console.log('[TerminalTabs] 未找到标签页或会话信息:', activeKey);
    }
  };

  // 编辑标签页（添加/删除）
  const onEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'add' && sessionInfo) {
      const instanceId = Date.now().toString();
      const tabId = `tab-${instanceId}`;
      const newTab = {
        key: String(tabs.length + 1),
        title: sessionInfo.name || `终端 ${tabs.length + 1}`,
        sessionInfo,
        instanceId,
        tabId,
        connected: false
      };

      // 先设置状态
      const newTabs = [...tabs, newTab];
      setTabs(newTabs);
      setActiveKey(newTab.key);

      // 设置 shellId 和触发事件
      const shellId = `${sessionInfo.id}-${instanceId}`;
      // 先设置 tabId 和 shellId
      eventBus.setCurrentTabId(tabId);
      eventBus.setCurrentShellId(shellId);
      // 再触发事件
      eventBus.emit('tab-change', { shellId, tabId, sessionInfo });
      onTabChange?.(sessionInfo);
    } else if (action === 'remove' && typeof targetKey === 'string') {
      const tabToRemove = tabs.find(tab => tab.key === targetKey);
      if (tabToRemove) {
        // 先移除标签页
        const newTabs = tabs.filter(tab => tab.key !== targetKey);
        setTabs(newTabs);

        // 如果删除的是当前活动标签页，需要切换到最后一个标签页
        if (newTabs.length && activeKey === targetKey) {
          const lastTab = newTabs[newTabs.length - 1];
          setActiveKey(lastTab.key);
          if (lastTab.sessionInfo) {
            const shellId = `${lastTab.sessionInfo.id}-${lastTab.instanceId}`;
            // 先设置 tabId 和 shellId
            eventBus.setCurrentTabId(lastTab.tabId);
            eventBus.setCurrentShellId(shellId);
            // 再触发事件
            eventBus.emit('tab-change', { 
              shellId, 
              tabId: lastTab.tabId,
              sessionInfo: lastTab.sessionInfo 
            });
            onTabChange?.(lastTab.sessionInfo);
          }
        }

        // 清理被删除标签页的状态
        eventBus.removeTab(tabToRemove.tabId);
        sftpConnectionManager.closeConnection(tabToRemove.tabId);
      }
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="terminal-tabs" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="terminal-tabs-nav">
        <Tabs
          type="editable-card"
          onChange={handleTabChange}
          activeKey={activeKey}
          onEdit={onEdit}
          items={tabs.map(tab => ({
            key: tab.key,
            label: (
              <Badge 
                status={tab.connected ? 'success' : 'error'} 
                text={tab.title} 
                className="tab-badge"
              />
            ),
            children: null
          }))}
        />
      </div>
      <div className="terminal-tabs-content">
        {tabs.map(tab => (
          <div 
            key={tab.key} 
            style={{ 
              height: '100%', 
              display: activeKey === tab.key ? 'block' : 'none' 
            }}
          >
            <Terminal 
              sessionInfo={tab.sessionInfo} 
              instanceId={tab.instanceId}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default TerminalTabs; 