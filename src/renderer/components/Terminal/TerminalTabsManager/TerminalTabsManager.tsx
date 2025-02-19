import React, { useState, useEffect, useRef } from 'react';
import { Tabs, Badge, message } from 'antd';
import TerminalTabContent from '../TerminalTabContent/TerminalTabContent';
import { MonitorPage } from '../../Monitor/MonitorPage';
import { eventBus, TabInfo } from '../../../services/eventBus';
import { sftpConnectionManager } from '../../../services/sftpConnectionManager';
import { FileBrowserConnectionManager } from '../../FileBrowser/FileBrowserMain/FileBrowserConnectionManager';
import { getServiceManager } from '../../../services/monitor/serviceManager';
import { MonitorConfigManager } from '../../../services/config/MonitorConfig';
import type { SessionInfo } from '../../../types';
import type { TerminalTab, TerminalTabsManagerProps } from '../types/terminal.types';
import './TerminalTabsManager.css';

/**
 * 终端标签页管理器组件
 * 负责管理所有终端标签页的创建、切换、关闭等操作
 */
const TerminalTabsManager: React.FC<TerminalTabsManagerProps> = ({ 
  sessionInfo, 
  triggerNewTab,
  onTabChange,
  isFileBrowserVisible
}) => {
  console.log('[TerminalTabsManager] 组件渲染:', { sessionInfo, triggerNewTab });

  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeKey, setActiveKey] = useState<string>();
  const [mounted, setMounted] = useState(false);
  const prevTriggerRef = useRef<number>();

  // 初始化默认标签页
  useEffect(() => {
    console.log('[TerminalTabsManager] mounted状态:', mounted);
    if (!mounted) {
      setMounted(true);
    }
  }, []);

  // 处理标签切换
  const handleTabChange = (key: string) => {
    console.log('[TerminalTabsManager] 切换标签页:', { key, tabs });
    const tab = tabs.find(t => t.key === key);
    if (tab && tab.sessionInfo) {
      const shellId = `${tab.sessionInfo.id}-${tab.instanceId}`;
      
      // 设置当前标签页和shell
      eventBus.setCurrentTabId(tab.tabId);
      eventBus.setCurrentShellId(shellId);
      setActiveKey(key);
    }
  };

  // 初始化监控会话
  const initMonitorSession = async (tab: TerminalTab) => {
    if (!tab.sessionInfo) return;
    
    console.time(`[Performance] 监控页面初始化总耗时 ${tab.sessionInfo.id}`);
    try {
      const monitorManager = getServiceManager().getMonitorManager();
      const refreshService = getServiceManager().getRefreshService();

      // 创建监控会话
      console.time(`[Performance] 创建监控会话耗时 ${tab.sessionInfo.id}`);
      const monitorSession = monitorManager.createSession({
        ...tab.sessionInfo
      });
      console.timeEnd(`[Performance] 创建监控会话耗时 ${tab.sessionInfo.id}`);

      // 连接监控会话
      console.time(`[Performance] 连接监控会话耗时 ${tab.sessionInfo.id}`);
      await monitorManager.connectSession(monitorSession.id);
      console.timeEnd(`[Performance] 连接监控会话耗时 ${tab.sessionInfo.id}`);

      // 启动自动刷新
      console.time(`[Performance] 启动自动刷新耗时 ${tab.sessionInfo.id}`);
      refreshService.startRefresh(monitorSession, tab.tabId);
      console.timeEnd(`[Performance] 启动自动刷新耗时 ${tab.sessionInfo.id}`);

      console.timeEnd(`[Performance] 监控页面初始化总耗时 ${tab.sessionInfo.id}`);
    } catch (error) {
      console.error('[TerminalTabsManager] 监控连接失败:', error);
      message.error('监控连接失败: ' + (error as Error).message);
    }
  };

  // 监听 triggerNewTab 的变化来创建新标签页
  useEffect(() => {
    console.log('[TerminalTabsManager] triggerNewTab变化:', { 
      triggerNewTab, 
      prevTrigger: prevTriggerRef.current,
      mounted,
      sessionInfo
    });

    // 如果 triggerNewTab 没有变化,或者与上一次相同,则不处理
    if (!mounted || !sessionInfo || !triggerNewTab || triggerNewTab === prevTriggerRef.current) {
      console.log('[TerminalTabsManager] 跳过创建新标签页');
      return;
    }
    
    // 更新上一次的值
    prevTriggerRef.current = triggerNewTab;
    
    console.log('[TerminalTabsManager] 触发新标签页创建:', { sessionInfo });
    
    // 生成唯一的实例ID和标签ID
    const instanceId = Date.now().toString();
    const tabId = `tab-${instanceId}`;
    const shellId = `${sessionInfo.id}-${instanceId}`;

    // 创建新标签页
    const newTab: TerminalTab = {
      key: String(Date.now()),
      title: sessionInfo.name || `终端 ${tabs.length + 1}`,
      sessionInfo,
      instanceId,
      tabId,
      connected: false
    };

    console.log('[TerminalTabsManager] 新标签页数据:', newTab);

    // 更新状态
    setTabs(prev => {
      console.log('[TerminalTabsManager] 更新标签页列表:', { prev, newTab });
      return [...prev, newTab];
    });
    setActiveKey(newTab.key);

    // 设置当前标签页和shell
    eventBus.setCurrentTabId(tabId);
    eventBus.setCurrentShellId(shellId);
    const tabInfo: TabInfo = {
      tabId,
      shellId,
      sessionInfo
    };
    eventBus.addTabInfo(tabInfo);
    eventBus.emit('tab-create', tabInfo as TabInfo & { isNew: boolean });

    // 如果是监控会话，初始化监控
    if (sessionInfo.type === 'monitor') {
      void initMonitorSession(newTab);
    } else {
      // 预初始化SSH连接
      void (async () => {
        const { CommandExecutor } = await import('@/services/completion/analyzers/execution/CommandExecutor');
        await CommandExecutor.initializeConnection();
      })();
    }

    console.log('[TerminalTabsManager] 新标签页创建完成:', { tabId, shellId, sessionInfo });
    
  }, [triggerNewTab]);

  // 监听连接状态变化
  useEffect(() => {
    const handleConnectionChange = (data: { shellId: string; connected: boolean }) => {
      console.log('[TerminalTabsManager] 连接状态变化:', data);
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

  // 处理标签编辑（添加/删除）
  const handleEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    console.log('[TerminalTabsManager] 编辑标签页:', { targetKey, action });
    if (action === 'add') {
      // 打开会话列表
      if (onTabChange) {
        onTabChange({} as SessionInfo);
      }
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
            // 设置当前标签页和shell
            eventBus.setCurrentTabId(lastTab.tabId);
            eventBus.setCurrentShellId(shellId);
          }
        }

        // 清理被删除标签页的状态
        eventBus.removeTab(tabToRemove.tabId);
        sftpConnectionManager.closeConnection(tabToRemove.tabId);
        
        // 如果是监控会话，停止刷新并断开连接
        if (tabToRemove.sessionInfo?.type === 'monitor') {
          const monitorManager = getServiceManager().getMonitorManager();
          const refreshService = getServiceManager().getRefreshService();
          refreshService.stopRefresh(tabToRemove.sessionInfo.id);
          monitorManager.disconnectSession(tabToRemove.sessionInfo.id);
        }

        eventBus.emit('completion:tab-remove', {
          tabId: tabToRemove.tabId,
          shellId:`${tabToRemove.sessionInfo?.id}-${tabToRemove.instanceId}`,
          sessionInfo: tabToRemove.sessionInfo
        });
      }
    }
  };

  // 修改渲染标签页内容的逻辑
  const renderTabContent = (tab: TerminalTab) => {
    if (!tab.sessionInfo) return null;

    // 根据会话类型渲染不同的内容
    if (tab.sessionInfo.type === 'monitor') {
      return (
        <MonitorPage sessionInfo={tab.sessionInfo} />
      );
    }

    return (
      <TerminalTabContent
        sessionInfo={tab.sessionInfo}
        instanceId={tab.instanceId}
        tabId={tab.tabId}
        isFileBrowserVisible={isFileBrowserVisible}
      />
    );
  };

  if (!mounted) {
    console.log('[TerminalTabsManager] 组件未挂载，返回null');
    return null;
  }

  console.log('[TerminalTabsManager] 渲染组件:', { 
    tabs, 
    activeKey
  });
  
  return (
    <div className="terminal-tabs-manager">
      <div className="terminal-tabs-header">
        <Tabs
          type="editable-card"
          onChange={handleTabChange}
          activeKey={activeKey}
          onEdit={handleEdit}
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
            children: renderTabContent(tab)
          }))}
        />
      </div>
    </div>
  );
};

export default TerminalTabsManager; 