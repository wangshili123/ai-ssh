import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from 'antd';
import { Resizable } from 're-resizable';
import TerminalTabs from './components/TerminalTabs';
import FileBrowserMain from './components/FileBrowser/FileBrowserMain/FileBrowserMain';
import AIAssistant from './components/AIAssistant';
import AppStatusBar from './components/StatusBar/AppStatusBar';
import type { SessionInfo } from '../main/services/storage';
import { eventBus } from './services/eventBus';
import './App.css';

const { Content, Sider } = Layout;

const App: React.FC = () => {
  const [activeSession, setActiveSession] = useState<SessionInfo | undefined>();
  const [triggerNewTab, setTriggerNewTab] = useState(0);
  const [fileBrowserHeight, setFileBrowserHeight] = useState(300);
  const [aiSiderWidth, setAiSiderWidth] = useState(400);
  const [currentTabId, setCurrentTabId] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 监听标签页ID变化
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

  // 处理会话选择
  const handleTabChange = useCallback((session: SessionInfo) => {
    console.log('[App] 会话选择:', session);
    setActiveSession(session);
    setTriggerNewTab(prev => prev + 1);
  }, []);

  // 处理文件浏览器高度变化
  const handleFileBrowserResize = useCallback((height: number) => {
    document.documentElement.style.setProperty('--file-browser-height', `${height}px`);
  }, []);

  return (
    <Layout className="app-container">
      <Layout>
        <Content className="main-content">
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
                <div
                  style={{
                    height: '100%',
                    width: '100%',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    backgroundColor: '#fff'
                  }}
                >
                  {currentTabId && activeSession && (
                    <FileBrowserMain
                      key={currentTabId}
                      sessionInfo={activeSession}
                      tabId={currentTabId}
                    />
                  )}
                </div>
              </div>
            </div>
          </Resizable>
        </Content>
        
        <Sider 
          width={aiSiderWidth} 
          collapsedWidth={40}
          collapsed={isCollapsed}
          className="ai-sider"
          trigger={null}
        >
          <div 
            className="ai-assistant-container"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget.querySelector('.resize-handle')) {
                const startX = e.clientX;
                const startWidth = aiSiderWidth;
                
                const handleMouseMove = (moveEvent: MouseEvent) => {
                  if (!isCollapsed) {
                    const deltaX = startX - moveEvent.clientX;
                    const newWidth = Math.min(Math.max(370, startWidth + deltaX), 800);
                    setAiSiderWidth(newWidth);
                  }
                };
                
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }
            }}
          >
            <div className="resize-handle" />
            <AIAssistant 
              sessionId={activeSession?.id} 
              isCollapsed={isCollapsed}
              onCollapse={setIsCollapsed}
            />
          </div>
        </Sider>
      </Layout>
      <AppStatusBar />
    </Layout>
  );
};

export default App; 