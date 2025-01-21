import React, { useState, useCallback } from 'react';
import { Layout } from 'antd';
import { Resizable } from 're-resizable';
import SessionList from './components/SessionList';
import TerminalTabs from './components/TerminalTabs';
import FileBrowserMain from './components/FileBrowser/FileBrowserMain';
import AIAssistant from './components/AIAssistant';
import type { SessionInfo } from '../main/services/storage';
import { eventBus } from './services/eventBus';
import './App.css';

const { Sider, Content } = Layout;

const App: React.FC = () => {
  const [activeSession, setActiveSession] = useState<SessionInfo>();
  const [currentTabSession, setCurrentTabSession] = useState<SessionInfo>();
  const [siderWidth, setSiderWidth] = useState(300);
  const [triggerNewTab, setTriggerNewTab] = useState(0);
  const [fileBrowserHeight, setFileBrowserHeight] = useState(300);
  const [aiAssistantHeight, setAIAssistantHeight] = useState(200);

  // 处理会话选择
  const handleSessionSelect = useCallback((session: SessionInfo) => {
    setActiveSession(session);
    setCurrentTabSession(session);
    // 每次选择会话时增加 triggerNewTab 的值，触发新标签页创建
    setTriggerNewTab(prev => prev + 1);
  }, []);

  // 处理标签页切换
  const handleTabChange = useCallback((session: SessionInfo) => {
    setCurrentTabSession(session);
  }, []);

  return (
    <Layout className="app-container">
      <Resizable
        size={{ width: siderWidth, height: '100%' }}
        onResizeStop={(e, direction, ref, d) => {
          setSiderWidth(siderWidth + d.width);
        }}
        minWidth={200}
        maxWidth={600}
        enable={{ right: true }}
      >
        <Sider width={siderWidth} className="app-sider">
          <SessionList
            onSelect={handleSessionSelect}
          />
        </Sider>
      </Resizable>
      <Layout>
        <Content className="app-content">
          <div className="terminal-container">
            <TerminalTabs 
              sessionInfo={activeSession}
              triggerNewTab={triggerNewTab}
              onTabChange={handleTabChange}
            />
          </div>
          <Resizable
            size={{ height: fileBrowserHeight, width: '100%' }}
            onResizeStop={(e, direction, ref, d) => {
              setFileBrowserHeight(fileBrowserHeight + d.height);
            }}
            minHeight={100}
            maxHeight={800}
            enable={{ top: true }}
          >
            <div className="file-browser-container">
              {currentTabSession && (
                <FileBrowserMain 
                  sessionInfo={currentTabSession}
                  tabId={eventBus.getCurrentShellId() || ''}
                />
              )}
            </div>
          </Resizable>
          <Resizable
            size={{ height: aiAssistantHeight, width: '100%' }}
            onResizeStop={(e, direction, ref, d) => {
              setAIAssistantHeight(aiAssistantHeight + d.height);
            }}
            minHeight={100}
            maxHeight={500}
            enable={{ top: true }}
          >
            <div className="ai-assistant-container">
              <AIAssistant sessionId={currentTabSession?.id} />
            </div>
          </Resizable>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App; 