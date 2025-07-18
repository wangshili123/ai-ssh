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
import TransferNotificationManager from './components/Transfer/TransferNotificationManager';
import TransferManager from './components/Transfer/TransferManager';
import DownloadHistory from './components/Download/DownloadHistory';
import { AppLoadingScreen } from './components/Common/AppLoadingScreen';
import type { SessionInfo, SSHService } from './types';
import { eventBus } from './services/eventBus';
import { DatabaseService } from '../services/database/DatabaseService';
import { sshService } from './services/ssh';
import { initializeServices } from './services/monitor/serviceManager';
import { BaseConfig } from './services/config/BaseConfig';
import { uiSettingsManager } from './services/UISettingsManager';
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
  const [downloadHistoryVisible, setDownloadHistoryVisible] = useState(false);
  const [transferManagerVisible, setTransferManagerVisible] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [uiSettingsInitialized, setUiSettingsInitialized] = useState(false);

  // 初始化数据库和基础服务
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('[App] 开始初始化基础服务...');

        // 记录开始时间，确保最低展示时间
        const startTime = Date.now();
        const MIN_LOADING_TIME = 2000; // 最低展示3秒

        // 模拟初始化步骤，给加载页面足够的时间显示
        await new Promise(resolve => setTimeout(resolve, 800));

        await DatabaseService.getInstance().init();

        // 初始化监控服务
        initializeServices(sshService as SSHService);

        // 初始化基础配置
        BaseConfig.init();

        // 初始化并加载UI设置
        await uiSettingsManager.init();
        const settings = uiSettingsManager.getSettings();
        setIsFileBrowserVisible(settings.isFileBrowserVisible);
        setIsCollapsed(!settings.isAIVisible);
        setUiSettingsInitialized(true);

        console.log('[App] 基础服务初始化完成');

        // 计算已经过去的时间
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

        console.log(`[App] 加载耗时: ${elapsedTime}ms, 剩余等待时间: ${remainingTime}ms`);

        // 如果还没到最低展示时间，继续等待
        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }

        // 额外延迟一点时间，让用户看到加载完成的状态
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsAppLoading(false);
      } catch (error) {
        console.error('[App] 基础服务初始化失败:', error);
        // 即使出错也要隐藏加载页面，但仍然保证最低展示时间
        const startTime = Date.now();
        const MIN_LOADING_TIME = 2000; // 出错时最低展示2秒
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, MIN_LOADING_TIME - elapsedTime);

        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        setIsAppLoading(false);
      }
    };

    initializeApp();
  }, []);

  // 监听UI设置变化（只在UI设置初始化完成后才更新）
  useEffect(() => {
    if (!uiSettingsInitialized) return;

    console.log('[App] 更新UI设置:', { isFileBrowserVisible, isAIVisible: !isCollapsed });
    uiSettingsManager.updateSettings({
      isFileBrowserVisible,
      isAIVisible: !isCollapsed
    });
  }, [isFileBrowserVisible, isCollapsed, uiSettingsInitialized]);

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

  // 监听打开下载历史的 IPC 消息
  useEffect(() => {
    const handleOpenDownloadHistory = () => {
      console.log('[App] 收到打开下载历史的消息');
      setDownloadHistoryVisible(true);
    };

    ipcRenderer.on('open-download-history', handleOpenDownloadHistory);

    return () => {
      ipcRenderer.removeListener('open-download-history', handleOpenDownloadHistory);
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
    <>
      <AppLoadingScreen
        visible={isAppLoading}
        onComplete={() => setIsAppLoading(false)}
      />

      <Layout className="app-container">
        <Layout>
          <Sider width={48} className="app-toolbar-sider" theme="light">
            <AppToolbar
              onSessionListOpen={() => setSessionListVisible(true)}
              isAICollapsed={isCollapsed}
              onAICollapse={setIsCollapsed}
              isFileBrowserVisible={isFileBrowserVisible}
              onFileBrowserVisibleChange={setIsFileBrowserVisible}
              onTransferManagerOpen={() => setTransferManagerVisible(true)}
              onBaseConfigOpen={() => setBaseConfigVisible(true)}
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
                  // 检查点击的元素是否是拖拽手柄或其子元素
                  const target = e.target as HTMLElement;
                  const resizeHandle = e.currentTarget.querySelector('.resize-handle') as HTMLElement;

                  if (target === resizeHandle || resizeHandle?.contains(target)) {
                    e.preventDefault();
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
      <DownloadHistory
        visible={downloadHistoryVisible}
        onClose={() => setDownloadHistoryVisible(false)}
      />
      <TransferManager
        visible={transferManagerVisible}
        onClose={() => setTransferManagerVisible(false)}
      />

        {/* 统一传输通知管理器 */}
        <TransferNotificationManager />
      </Layout>
    </>
  );
};

export default App; 