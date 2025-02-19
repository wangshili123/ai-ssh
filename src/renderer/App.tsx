import React, { useState, useCallback, useEffect } from 'react';
import { Layout } from 'antd';
import { Resizable } from 're-resizable';
import TerminalTabsManager from './components/Terminal/TerminalTabsManager/TerminalTabsManager';
import FileBrowserMain from './components/FileBrowser/FileBrowserMain/FileBrowserMain';
import AIAssistant from './components/AIAssistant';
import AppStatusBar from './components/StatusBar/AppStatusBar';
import AppToolbar from './components/Toolbar/AppToolbar';
import SessionListModal from './components/SessionListModal';
import { BaseConfigModal } from './components/BaseConfigModal/BaseConfigModal';
import type { SessionInfo, SSHService } from './types';
import { eventBus } from './services/eventBus';
import { DatabaseService } from '../services/database/DatabaseService';
import { storageService } from './services/storage';
import { sshService } from './services/ssh';
import { initializeServices } from './services/monitor/serviceManager';
import { BaseConfig } from './services/config/BaseConfig';
import './App.css';
import { ipcRenderer } from 'electron';

const { Content, Sider } = Layout;

const App: React.FC = () => {
  const [activeSession, setActiveSession] = useState<SessionInfo | undefined>();
  const [triggerNewTab, setTriggerNewTab] = useState(0);
  const [fileBrowserHeight, setFileBrowserHeight] = useState(300);
  const [aiSiderWidth, setAiSiderWidth] = useState(400);
  const [currentTabId, setCurrentTabId] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [sessionListVisible, setSessionListVisible] = useState(false);
  const [isFileBrowserVisible, setIsFileBrowserVisible] = useState(true);
  const [baseConfigVisible, setBaseConfigVisible] = useState(false);

  // 初始化数据库和基础服务
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] 开始初始化基础服务...');
        await DatabaseService.getInstance().init();
        
        // 初始化监控服务
        initializeServices(sshService as SSHService);
        
        // 初始化基础配置
        BaseConfig.init();
        
        // 加载UI设置
        const settings = await storageService.loadUISettings();
        console.log('[App] 加载UI设置:', settings);
        setIsFileBrowserVisible(settings.isFileBrowserVisible);
        setIsCollapsed(!settings.isAIVisible);
        
        console.log('[App] 基础服务初始化完成');
      } catch (error) {
        console.error('[App] 基础服务初始化失败:', error);
      }
    };

    initializeApp();
  }, []);



  // 保存UI设置
  useEffect(() => {
    const saveSettings = async () => {
      try {
        // 添加延迟以避免过于频繁的保存
        const settings = {
          isFileBrowserVisible,
          isAIVisible: !isCollapsed
        };
        console.log('[App] 保存UI设置:', settings);
        await storageService.saveUISettings(settings);
      } catch (error) {
        console.error('[App] 保存UI设置失败:', error);
      }
    };

    // 使用延迟来避免过于频繁的保存
    const timeoutId = setTimeout(saveSettings, 500);
    return () => clearTimeout(timeoutId);
  }, [isFileBrowserVisible, isCollapsed]);

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

  // 监听打开基础配置对话框的 IPC 消息
  useEffect(() => {
    const handleOpenBaseConfig = () => {
      console.log('[App] 收到打开基础配置对话框的消息');
      setBaseConfigVisible(true);
    };

    ipcRenderer.on('open-base-config', handleOpenBaseConfig);

    return () => {
      ipcRenderer.removeListener('open-base-config', handleOpenBaseConfig);
    };
  }, []);

  // 处理会话选择
  const handleSessionSelect = useCallback((session: SessionInfo) => {
    console.log('[App] 会话选择:', session);
    setSessionListVisible(false);
    setActiveSession(session);
    setTriggerNewTab(prev => prev + 1);
  }, []);

  return (
    <Layout className="app-container">
      <Layout>
        <Sider width={48} className="app-toolbar-sider" theme="light">
          <AppToolbar 
            onSessionListOpen={() => setSessionListVisible(true)}
            isAICollapsed={isCollapsed}
            onAICollapse={setIsCollapsed}
            isFileBrowserVisible={isFileBrowserVisible}
            onFileBrowserVisibleChange={setIsFileBrowserVisible}
          />
        </Sider>
        <Layout>
          <Content className="main-content">
            <TerminalTabsManager 
              sessionInfo={activeSession}
              triggerNewTab={triggerNewTab}
              onTabChange={handleSessionSelect}
              isFileBrowserVisible={isFileBrowserVisible}
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
      </Layout>
      <AppStatusBar />
      <SessionListModal
        visible={sessionListVisible}
        onClose={() => setSessionListVisible(false)}
        onSelect={handleSessionSelect}
      />
      <BaseConfigModal
        visible={baseConfigVisible}
        onClose={() => setBaseConfigVisible(false)}
      />
    </Layout>
  );
};

export default App; 