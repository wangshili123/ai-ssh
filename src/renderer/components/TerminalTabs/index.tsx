import React, { useState, useEffect, useRef } from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import Terminal from '../Terminal';
import './index.css';

interface TerminalTab {
  key: string;
  title: string;
  sessionId?: string;
}

interface TerminalTabsProps {
  defaultActiveKey?: string;
}

const TerminalTabs: React.FC<TerminalTabsProps> = ({ defaultActiveKey }) => {
  const [activeKey, setActiveKey] = useState<string>();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [mounted, setMounted] = useState(false);

  // 初始化默认标签页
  useEffect(() => {
    if (tabs.length === 0) {
      const defaultTab: TerminalTab = {
        key: 'terminal-default',
        title: '新终端',
      };
      setTabs([defaultTab]);
      setActiveKey(defaultTab.key);
    }
    // 确保组件已挂载
    setMounted(true);
  }, []);

  // 添加新标签页
  const addTab = (sessionId?: string) => {
    const newTab: TerminalTab = {
      key: `terminal-${Date.now()}`,
      title: sessionId ? `会话: ${sessionId}` : '新终端',
      sessionId
    };
    setTabs([...tabs, newTab]);
    setActiveKey(newTab.key);
  };

  // 关闭标签页
  const removeTab = (targetKey: string) => {
    const targetIndex = tabs.findIndex(tab => tab.key === targetKey);
    const newTabs = tabs.filter(tab => tab.key !== targetKey);
    
    // 如果关闭的是当前标签页，需要设置新的活动标签页
    if (newTabs.length && targetKey === activeKey) {
      const newActiveKey = newTabs[targetIndex === newTabs.length ? targetIndex - 1 : targetIndex].key;
      setActiveKey(newActiveKey);
    }
    
    setTabs(newTabs);
  };

  // 编辑标签页（添加/删除）
  const onEdit: TabsProps['onEdit'] = (targetKey, action) => {
    if (action === 'add') {
      addTab();
    } else if (action === 'remove' && typeof targetKey === 'string') {
      removeTab(targetKey);
    }
  };

  // 切换标签页
  const onChange = (newActiveKey: string) => {
    setActiveKey(newActiveKey);
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="terminal-tabs">
      <Tabs
        type="editable-card"
        activeKey={activeKey}
        onChange={onChange}
        onEdit={onEdit}
        items={tabs.map(tab => ({
          key: tab.key,
          label: tab.title,
          children: (
            <div style={{ height: '100%', padding: '0 1px' }}>
              <Terminal sessionId={tab.sessionId} />
            </div>
          ),
          closable: tabs.length > 1
        }))}
      />
    </div>
  );
};

export default TerminalTabs; 