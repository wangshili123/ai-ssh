import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import type { SessionInfo } from '../../../main/services/storage';
import Terminal from '../Terminal';
import './index.css';

interface TerminalTab {
  key: string;
  title: string;
  sessionInfo?: SessionInfo;
}

interface TerminalTabsProps {
  sessionInfo?: SessionInfo;
}

const TerminalTabs: React.FC<TerminalTabsProps> = ({ sessionInfo }) => {
  const [activeKey, setActiveKey] = useState<string>();
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [mounted, setMounted] = useState(false);

  // 初始化默认标签页
  useEffect(() => {
    const defaultTab = {
      key: '1',
      title: '终端 1',
      sessionInfo
    };
    setTabs([defaultTab]);
    setActiveKey(defaultTab.key);
    setMounted(true);
  }, [sessionInfo]);

  // 切换标签页
  const onChange = (newActiveKey: string) => {
    setActiveKey(newActiveKey);
  };

  // 编辑标签页（添加/删除）
  const onEdit = (targetKey: React.MouseEvent | React.KeyboardEvent | string, action: 'add' | 'remove') => {
    if (action === 'add') {
      const newTab = {
        key: String(tabs.length + 1),
        title: `终端 ${tabs.length + 1}`,
        sessionInfo
      };
      setTabs([...tabs, newTab]);
      setActiveKey(newTab.key);
    } else if (action === 'remove' && typeof targetKey === 'string') {
      const newTabs = tabs.filter(tab => tab.key !== targetKey);
      setTabs(newTabs);
      if (newTabs.length && activeKey === targetKey) {
        setActiveKey(newTabs[newTabs.length - 1].key);
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
              <Terminal sessionInfo={tab.sessionInfo} />
            </div>
          ),
          closable: tabs.length > 1
        }))}
      />
    </div>
  );
};

export default TerminalTabs; 