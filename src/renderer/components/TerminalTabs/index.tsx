import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import type { SessionInfo } from '../../../main/services/storage';
import Terminal from '../Terminal';
import { eventBus } from '../../services/eventBus';
import './index.css';

interface TerminalTab {
  key: string;
  title: string;
  sessionInfo?: SessionInfo;
  instanceId: string;
}

interface TerminalTabsProps {
  sessionInfo?: SessionInfo;
  triggerNewTab?: number;
}

const TerminalTabs: React.FC<TerminalTabsProps> = ({ sessionInfo, triggerNewTab }) => {
  const [activeKey, setActiveKey] = useState<string>();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [mounted, setMounted] = useState(false);

  // 初始化默认标签页
  useEffect(() => {
    if (!mounted) {
      const defaultTab = {
        key: '1',
        title: sessionInfo?.name || '终端 1',
        sessionInfo,
        instanceId: Date.now().toString()
      };
      setTabs([defaultTab]);
      setActiveKey(defaultTab.key);
      // 设置初始的shellId
      if (sessionInfo) {
        const shellId = sessionInfo.id + (defaultTab.instanceId ? `-${defaultTab.instanceId}` : '');
        eventBus.setCurrentShellId(shellId);
      }
      setMounted(true);
    }
  }, []);

  // 监听 triggerNewTab 的变化来创建新标签页
  useEffect(() => {
    if (mounted && sessionInfo && triggerNewTab) {
      const newTab = {
        key: String(tabs.length + 1),
        title: sessionInfo.name || `终端 ${tabs.length + 1}`,
        sessionInfo,
        instanceId: Date.now().toString()
      };
      setTabs([...tabs, newTab]);
      setActiveKey(newTab.key);
    }
  }, [triggerNewTab, sessionInfo]);

  // 切换标签页
  const onChange = (newActiveKey: string) => {
    setActiveKey(newActiveKey);
    // 找到对应的标签页
    const activeTab = tabs.find(tab => tab.key === newActiveKey);
    if (activeTab && activeTab.sessionInfo) {
      // 更新当前活动的shellId
      const shellId = activeTab.sessionInfo.id + (activeTab.instanceId ? `-${activeTab.instanceId}` : '');
      eventBus.setCurrentShellId(shellId);
    }
  };

  // 编辑标签页（添加/删除）
  const onEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'add') {
      const newTab = {
        key: String(tabs.length + 1),
        title: sessionInfo?.name || `终端 ${tabs.length + 1}`,
        sessionInfo,
        instanceId: Date.now().toString()
      };
      setTabs([...tabs, newTab]);
      setActiveKey(newTab.key);
      // 更新当前活动的shellId
      if (sessionInfo) {
        const shellId = sessionInfo.id + (newTab.instanceId ? `-${newTab.instanceId}` : '');
        eventBus.setCurrentShellId(shellId);
      }
    } else if (action === 'remove' && typeof targetKey === 'string') {
      const newTabs = tabs.filter(tab => tab.key !== targetKey);
      setTabs(newTabs);
      if (newTabs.length && activeKey === targetKey) {
        const lastTab = newTabs[newTabs.length - 1];
        setActiveKey(lastTab.key);
        // 更新当前活动的shellId
        if (lastTab.sessionInfo) {
          const shellId = lastTab.sessionInfo.id + (lastTab.instanceId ? `-${lastTab.instanceId}` : '');
          eventBus.setCurrentShellId(shellId);
        }
      }
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="terminal-tabs">
      <Tabs
        type="editable-card"
        onChange={onChange}
        activeKey={activeKey}
        onEdit={onEdit}
        items={tabs.map(tab => ({
          key: tab.key,
          label: tab.title,
          children: (
            <div style={{ height: '100%', padding: '0 1px' }}>
              <Terminal 
                sessionInfo={tab.sessionInfo} 
                instanceId={tab.instanceId}
              />
            </div>
          ),
          closable: tabs.length > 1
        }))}
      />
    </div>
  );
};

export default TerminalTabs; 