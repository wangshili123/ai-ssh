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
  const tabUpdateRef = useRef(false);
  const [activeTab, setActiveTab] = useState<string>('');
  const [tabState, setTabState] = useState<Record<string, TabState>>({});
  const [sessionListVisible, setSessionListVisible] = useState(false);

  // 初始化默认标签页
  useEffect(() => {
    if (!mounted) {
      // console.log('[TerminalTabs] 初始化默认标签页');
      // eventBus.debugState();

      // const instanceId = Date.now().toString();
      // const tabId = `tab-${instanceId}`;
      // const defaultTab = {
      //   key: '1',
      //   title: sessionInfo?.name || '终端 1',
      //   sessionInfo,
      //   instanceId,
      //  tabId,
      //   connected: false
      // };

      // console.log('[TerminalTabs] 创建默认标签页:', defaultTab);

      // 先设置状态
      // setTabs([defaultTab]);
      // setActiveKey(defaultTab.key);

      // // 如果有会话信息，设置 shellId 和触发事件
      // if (sessionInfo) {
      //   const shellId = `${sessionInfo.id}-${instanceId}`;
        // console.log('[TerminalTabs] 设置初始状态:', { shellId, tabId });
        
        // 清理可能存在的临时状态
        // const tempTabId = `temp-${sessionInfo.id}`;
        // eventBus.removeTab(tempTabId);
        // sftpConnectionManager.closeConnection(tempTabId);

        // 先设置 tabId 和 shellId
        // eventBus.setCurrentTabId(tabId);
      //   eventBus.setCurrentShellId(shellId);
        // 再触发事件
        // eventBus.emit('tab-change', { shellId, tabId, sessionInfo });
      //   onTabChange?.(sessionInfo);

      //   console.log('[TerminalTabs] 初始化完成');
      //   eventBus.debugState();
      // }
    }
    setMounted(true);
  }, []);

  // 监听 triggerNewTab 的变化来创建新标签页
  useEffect(() => {
    if (mounted && sessionInfo && triggerNewTab && !tabUpdateRef.current) {
      console.log('[TerminalTabs] 触发新标签页创建:', { sessionInfo });
      tabUpdateRef.current = true;
      
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
        key: String(Date.now()), // 使用时间戳作为唯一key
        title: sessionInfo.name || `终端 ${tabs.length + 1}`,
        sessionInfo,
        instanceId,
        tabId,
        connected: false
      };

      // 先设置状态
      setTabs(prev => [...prev, newTab]);
      setActiveKey(newTab.key);

      // 先设置 tabId 和 shellId
      eventBus.setCurrentTabId(tabId);
      eventBus.setCurrentShellId(shellId);
      
      // 再触发事件，确保包含完整的会话信息
      eventBus.emit('tab-change', { 
        shellId, 
        tabId, 
        sessionInfo 
      });
      
      console.log('[TerminalTabs] 新标签页创建完成:', { tabId, shellId, sessionInfo });
      // 设置当前的shellId
      eventBus.setCurrentShellId(shellId);
      
      // 重置标记
      setTimeout(() => {
        tabUpdateRef.current = false;
      }, 0);
    }
  }, [triggerNewTab, sessionInfo, mounted, tabs.length, onTabChange]);

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