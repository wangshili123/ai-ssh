import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from 'antd';
import { Resizable } from 're-resizable';
import TerminalTabsManager from './components/Terminal/TerminalTabsManager/TerminalTabsManager';
import FileBrowserMain from './components/FileBrowser/FileBrowserMain/FileBrowserMain';
import AIAssistant from './components/AIAssistant';
import AppStatusBar from './components/StatusBar/AppStatusBar';
import AppToolbar from './components/Toolbar/AppToolbar';
import SessionListModal from './components/SessionListModal';
import type { SessionInfo } from '../main/services/storage';
import { eventBus } from './services/eventBus';
import { DatabaseService } from '../services/database/DatabaseService';
import './App.css';

const { Content, Sider } = Layout;

const App: React.FC = () => {
  const [activeSession, setActiveSession] = useState<SessionInfo | undefined>();
  const [triggerNewTab, setTriggerNewTab] = useState(0);
  const [fileBrowserHeight, setFileBrowserHeight] = useState(300);
  const [aiSiderWidth, setAiSiderWidth] = useState(400);
  const [currentTabId, setCurrentTabId] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [sessionListVisible, setSessionListVisible] = useState(false);

  // 初始化数据库和基础服务
  useEffect(() => {
    const initializeServices = async () => {
      try {
        console.log('[App] 开始初始化基础服务...');
        await DatabaseService.getInstance().init();
        console.log('[App] 基础服务初始化完成');
      } catch (error) {
        console.error('[App] 基础服务初始化失败:', error);
      }
    };

    initializeServices();
  }, []);

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
  const handleSessionSelect = useCallback((session: SessionInfo) => {
    console.log('[App] 会话选择:', session);
    setSessionListVisible(false);
    setActiveSession(session);
    setTriggerNewTab(prev => prev + 1);
  }, []);

  // 处理文件浏览器高度变化
  const handleFileBrowserResize = useCallback((height: number) => {
    document.documentElement.style.setProperty('--file-browser-height', `${height}px`);
  }, []);

  return (
    <Layout className="app-container">
      <AppToolbar 
        onSessionListOpen={() => setSessionListVisible(true)}
        isAICollapsed={isCollapsed}
        onAICollapse={setIsCollapsed}
      />
      <Layout>
        <Content className="main-content">
          <TerminalTabsManager 
            sessionInfo={activeSession}
            triggerNewTab={triggerNewTab}
            onTabChange={handleSessionSelect}
          />
        </Content>
        
        {!isCollapsed && (
          <Sider 
            width={aiSiderWidth}
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
                    const deltaX = startX - moveEvent.clientX;
                    const newWidth = Math.min(Math.max(370, startWidth + deltaX), 800);
                    setAiSiderWidth(newWidth);
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
              />
            </div>
          </Sider>
        )}
      </Layout>
      <AppStatusBar />
      <SessionListModal
        visible={sessionListVisible}
        onClose={() => setSessionListVisible(false)}
        onSelect={handleSessionSelect}
      />
    </Layout>
  );
};

export default App; 