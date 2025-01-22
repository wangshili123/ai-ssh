import React, { useState, useCallback, useEffect } from 'react';
import { Layout, Empty } from 'antd';
import { Resizable } from 're-resizable';
import SessionList from './components/SessionList';
import TerminalTabs from './components/TerminalTabs';
import FileBrowserMain from './components/FileBrowser/FileBrowserMain';
import AIAssistant from './components/AIAssistant';
import NewFileBrowser from './components/FileBrowser/NewFileBrowser';
import type { SessionInfo } from '../main/services/storage';
import { eventBus } from './services/eventBus';
import type { TabInfo } from './services/eventBus';
import './App.css';

const { Sider, Content } = Layout;

const App: React.FC = () => {
  const [activeSession, setActiveSession] = useState<SessionInfo>();
  const [sessionMap, setSessionMap] = useState<Record<string, SessionInfo>>({});
  const [siderWidth, setSiderWidth] = useState(300);
  const [triggerNewTab, setTriggerNewTab] = useState(0);
  const [fileBrowserHeight, setFileBrowserHeight] = useState(300);
  const [aiAssistantHeight, setAIAssistantHeight] = useState(200);

  // 处理会话选择
  const handleSessionSelect = useCallback((session: SessionInfo) => {
    setActiveSession(session);
    // 每次选择会话时增加 triggerNewTab 的值，触发新标签页创建
    setTriggerNewTab(prev => prev + 1);
  }, []);

  // 监听标签页变化
  useEffect(() => {
    console.log('[App] 监听标签页变化');
    eventBus.debugState();

    const handleTabChange = (info: TabInfo) => {
      console.log('[App] 标签页变化:', info);
      if (info.sessionInfo) {
        console.log('[App] 更新标签页会话:', info.tabId, info.sessionInfo);
        setSessionMap(prev => {
          const newMap = { ...prev };
          newMap[info.tabId] = info.sessionInfo as SessionInfo;
          return newMap;
        });
      } else {
        console.log('[App] 标签页变化事件中没有sessionInfo');
        const session = eventBus.getTabInfo(info.tabId)?.sessionInfo;
        console.log('[App] 从tabInfo获取会话:', session);
        if (session) {
          setSessionMap(prev => {
            const newMap = { ...prev };
            newMap[info.tabId] = session;
            return newMap;
          });
        }
      }
    };

    eventBus.on('tab-change', handleTabChange);
    return () => {
      eventBus.off('tab-change', handleTabChange);
    };
  }, []);

  // 渲染文件浏览器
  const renderFileBrowser = () => {
    const tabId = eventBus.getCurrentTabId() || '';
    const session = tabId ? sessionMap[tabId] : undefined;

    console.log('[App] 渲染文件浏览器:', { 
      tabId, 
      session: session?.name,
      tabInfo: tabId ? eventBus.getTabInfo(tabId) : undefined 
    });

    return (
      <NewFileBrowser
        sessionInfo={session}
        tabId={tabId}
      />
    );
  };

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
              {renderFileBrowser()}
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
              <AIAssistant sessionId={sessionMap[eventBus.getCurrentTabId() || '']?.id} />
            </div>
          </Resizable>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App; 