import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from 'antd';
import { Resizable } from 're-resizable';
import TerminalTabs from './components/TerminalTabs';
import NewFileBrowser from './components/FileBrowser/NewFileBrowser';
import AIAssistant from './components/AIAssistant';
import AppStatusBar from './components/StatusBar/AppStatusBar';
import type { SessionInfo } from '../main/services/storage';
import { eventBus } from './services/eventBus';
import type { TabInfo } from './services/eventBus';
import './App.css';

const { Content } = Layout;

const App: React.FC = () => {
  const [activeSession, setActiveSession] = useState<SessionInfo>();
  const [sessionMap, setSessionMap] = useState<Record<string, SessionInfo>>({});
  const [currentTabSession, setCurrentTabSession] = useState<SessionInfo>();
  const [triggerNewTab, setTriggerNewTab] = useState(0);
  const [fileBrowserHeight, setFileBrowserHeight] = useState(300);
  const [aiAssistantHeight, setAIAssistantHeight] = useState(200);
  const [currentTabId, setCurrentTabId] = useState<string>('');

  // 监听标签页变化
  useEffect(() => {
    const handleTabIdChanged = (tabId: string) => {
      console.log('[App] 标签页ID变化:', tabId);
      setCurrentTabId(tabId);
    };

    eventBus.on('tabIdChanged', handleTabIdChanged);
    return () => {
      eventBus.off('tabIdChanged', handleTabIdChanged);
    };
  }, []);

  // 处理标签页切换
  const handleTabChange = useCallback((info: TabInfo | SessionInfo) => {
    console.log('[App] 标签页变化:', info);
    
    // 如果是从会话列表选择的会话
    if ('id' in info && !('tabId' in info)) {
      // 这是一个新的会话选择
      setActiveSession(info);
      setTriggerNewTab(prev => prev + 1);
      
      // 更新会话映射（使用临时ID）
      const tempTabId = `temp-${info.id}`;
      setSessionMap(prev => {
        const newMap = { ...prev };
        newMap[tempTabId] = info;
        return newMap;
      });

      // 监听一次性的 tab-change 事件，用于更新新标签页的映射
      const handleNewTab = (tabInfo: TabInfo) => {
        const sessionInfo = tabInfo.sessionInfo;
        if (sessionInfo && 'id' in sessionInfo && sessionInfo.id === info.id) {
          console.log('[App] 新标签页创建完成，更新映射:', tabInfo);
          setSessionMap(prev => {
            const newMap = { ...prev };
            // 删除临时映射
            delete newMap[tempTabId];
            // 添加新的映射
            newMap[tabInfo.tabId] = sessionInfo;
            return newMap;
          });
          // 移除监听器
          eventBus.off('tab-change', handleNewTab);
        }
      };
      eventBus.on('tab-change', handleNewTab);
    } 
    // 如果是标签页切换事件
    else if ('tabId' in info) {
      const tabInfo = info as TabInfo;
      const sessionInfo = tabInfo.sessionInfo;
      if (sessionInfo && 'id' in sessionInfo) {
        setActiveSession(sessionInfo);
        
        // 更新会话映射
        setSessionMap(prev => {
          const newMap = { ...prev };
          // 确保当前标签页的会话信息存在于映射中
          newMap[tabInfo.tabId] = sessionInfo;
          return newMap;
        });
      }
    }
  }, []);

  // 处理文件浏览器高度变化
  const handleFileBrowserResize = useCallback((height: number) => {
    document.documentElement.style.setProperty('--file-browser-height', `${height}px`);
  }, []);

  return (
    <Layout className="app-container">
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
            onResize={(e, direction, ref) => {
              handleFileBrowserResize(ref.offsetHeight);
            }}
            onResizeStop={(e, direction, ref, d) => {
              setFileBrowserHeight(fileBrowserHeight + d.height);
            }}
            minHeight={100}
            maxHeight={800}
            enable={{ top: true }}
          >
            <div className="file-browser-container" style={{ height: 'var(--file-browser-height, 300px)' }}>
              <div className="file-browser-instances" style={{ position: 'relative', height: '100%' }}>
                {Object.entries(sessionMap).map(([tabId, session]) => (
                  <div
                    key={tabId}
                    style={{
                      height: '100%',
                      width: '100%',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      display: eventBus.getCurrentTabId() === tabId ? 'block' : 'none',
                      backgroundColor: '#fff'
                    }}
                  >
                    <NewFileBrowser
                      key={tabId}
                      sessionInfo={session}
                      tabId={tabId}
                    />
                  </div>
                ))}
              </div>
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
      <AppStatusBar />
    </Layout>
  );
};

export default App; 