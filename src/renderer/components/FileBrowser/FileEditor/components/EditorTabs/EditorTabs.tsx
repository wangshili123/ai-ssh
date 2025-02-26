import React, { useEffect, useState } from 'react';
import { Tabs } from 'antd';
import { observer } from 'mobx-react';
import { useEditorTabStore } from '../../store/EditorTabStore';
import { FileEditorMain } from '../FileEditorMain/FileEditorMain';
import './EditorTabs.css';

const { TabPane } = Tabs;

export const EditorTabs: React.FC = observer(() => {
  const tabStore = useEditorTabStore();
  const [activeKey, setActiveKey] = useState<string>('');

  useEffect(() => {
    const activeTab = tabStore.getActiveTab();
    if (activeTab) {
      setActiveKey(activeTab.id);
    }
  }, [tabStore]);

  // 处理标签切换
  const handleTabChange = (tabId: string) => {
    tabStore.setActiveTab(tabId);
    setActiveKey(tabId);
  };

  // 处理标签关闭
  const handleTabClose = async (tabId: string) => {
    // TODO: 检查是否需要保存
    tabStore.removeTab(tabId);
  };

  const tabs = tabStore.getAllTabs();

  return (
    <div className="editor-tabs">
      <Tabs
        type="editable-card"
        activeKey={activeKey}
        onChange={handleTabChange}
        onEdit={(targetKey, action) => {
          if (action === 'remove' && typeof targetKey === 'string') {
            handleTabClose(targetKey);
          }
        }}
      >
        {tabs.map(tab => (
          <TabPane
            key={tab.id}
            tab={tab.title}
            closable={true}
          >
            <FileEditorMain
              filePath={tab.filePath}
              sessionId={tab.sessionId}
              tabId={tab.id}
            />
          </TabPane>
        ))}
      </Tabs>
    </div>
  );
}); 