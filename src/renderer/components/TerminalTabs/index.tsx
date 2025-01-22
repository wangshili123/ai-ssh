import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tabs, Badge, Button } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import type { SessionInfo } from '../../../main/services/storage';
import Terminal from '../Terminal';
import SessionListModal from '../SessionListModal';
import { eventBus } from '../../services/eventBus';
import { sftpConnectionManager } from '../../services/sftpConnectionManager';
import { generateUniqueId } from '../../utils';
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

interface TabState {
  shellId: string | null;
  sessionInfo?: SessionInfo;
}

const TerminalTabs: React.FC<TerminalTabsProps> = ({ 
  sessionInfo, 
  triggerNewTab,
  onTabChange 
}) => {
  const [activeKey, setActiveKey] = useState<string>();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [mounted, setMounted] = useState(false);
  const prevTriggerRef = useRef<number>();
  const [sessionListVisible, setSessionListVisible] = useState(false);

  // 初始化默认标签页
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
    }
  }, []);

  // 监听 triggerNewTab 的变化来创建新标签页
  useEffect(() => {
    // 如果 triggerNewTab 没有变化,或者与上一次相同,则不处理
    if (!mounted || !sessionInfo || !triggerNewTab || triggerNewTab === prevTriggerRef.current) {
      return;
    }
    
    // 更新上一次的值
    prevTriggerRef.current = triggerNewTab;
    
    console.log('[TerminalTabs] 触发新标签页创建:', { sessionInfo });
    
    // 生成唯一的实例ID和标签ID
    const instanceId = Date.now().toString();
    const tabId = `tab-${instanceId}`;
    const shellId = `${sessionInfo.id}-${instanceId}`;

    // 先清理可能存在的临时状态
    const tempTabId = `temp-${sessionInfo.id}`;
    eventBus.removeTab(tempTabId);
    sftpConnectionManager.closeConnection(tempTabId);

    // 创建新标签页
    const newTab = {
      key: String(Date.now()),
      title: sessionInfo.name || `终端 ${tabs.length + 1}`,
      sessionInfo,
      instanceId,
      tabId,
      connected: false
    };

    // 更新状态
    setTabs(prev => [...prev, newTab]);
    setActiveKey(newTab.key);

    // 设置当前标签页和shell
    eventBus.setCurrentTabId(tabId);
    eventBus.setCurrentShellId(shellId);
    
    // 触发事件
    eventBus.emit('tab-change', { 
      shellId, 
      tabId, 
      sessionInfo 
    });
    
    console.log('[TerminalTabs] 新标签页创建完成:', { tabId, shellId, sessionInfo });
    
  }, [triggerNewTab, sessionInfo, mounted, tabs.length]);

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
  const handleTabChange = useCallback((activeKey: string) => {
    const tab = tabs.find(t => t.key === activeKey);
    if (tab && tab.sessionInfo) {
      console.log('[TerminalTabs] 切换标签页:', tab);
      const shellId = `${tab.sessionInfo.id}-${tab.instanceId}`;
      
      // 先设置当前标签页和 shell
      eventBus.setCurrentTabId(tab.tabId);
      eventBus.setCurrentShellId(shellId);
      setActiveKey(activeKey);
      
      // 触发标签页切换事件，通知文件浏览器更新显示
      eventBus.emit('tab-change', {
        shellId,
        tabId: tab.tabId,
        sessionInfo: tab.sessionInfo
      });
    }
  }, [tabs]);

  // 处理会话选择
  const handleSessionSelect = useCallback((session: SessionInfo) => {
    console.log('[TerminalTabs] 选择会话:', session);
    // 通知父组件创建新标签
    onTabChange?.(session);
  }, [onTabChange]);

  // 编辑标签页（添加/删除）
  const onEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'add' && sessionInfo) {
      // 打开会话列表
      setSessionListVisible(true);
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
    <div 
      className="terminal-tabs" 
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div className="terminal-tabs-nav">
        <div className="terminal-tabs-header">
          <Button
            type="text"
            icon={<FolderOutlined />}
            onClick={() => setSessionListVisible(true)}
            className="session-list-btn"
          />
          <Tabs
            type="editable-card"
            onChange={handleTabChange}
            activeKey={activeKey}
            onEdit={onEdit}
            hideAdd={true}
            animated={false}
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
      </div>
      <div className="terminal-tabs-content">
        {tabs.map(tab => (
          <div 
            key={tab.key} 
            style={{ 
              height: '100%', 
              display: activeKey === tab.key ? 'block' : 'none',
              position: 'relative'
            }}
          >
            <Terminal 
              sessionInfo={tab.sessionInfo} 
              instanceId={tab.instanceId}
            />
          </div>
        ))}
      </div>
      <SessionListModal
        visible={sessionListVisible}
        onClose={() => setSessionListVisible(false)}
        onSelect={handleSessionSelect}
      />
    </div>
  );
};

export default TerminalTabs; 