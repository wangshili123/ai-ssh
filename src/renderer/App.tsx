import React, { useState, useCallback } from 'react';
import { Layout, Button } from 'antd';
import { Resizable } from 're-resizable';
import { SettingOutlined } from '@ant-design/icons';
import SessionList from './components/SessionList';
import TerminalTabs from './components/TerminalTabs';
import AIAssistant from './components/AIAssistant';
import AIConfigModal from './components/AIConfigModal';
import type { SessionInfo } from '../main/services/storage';
import './App.css';

const { Sider, Content } = Layout;

const App: React.FC = () => {
  const [activeSession, setActiveSession] = useState<SessionInfo>();
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const [aiAssistantHeight, setAIAssistantHeight] = useState(200);
  const [configModalVisible, setConfigModalVisible] = useState(false);

  // 处理会话选择
  const handleSessionSelect = useCallback((session: SessionInfo) => {
    setActiveSession(session);
  }, []);

  // 处理会话保存
  const handleSessionSave = useCallback(() => {
    // 实现会话保存逻辑
  }, []);

  // 处理会话重新加载
  const handleSessionReload = useCallback(() => {
    // 实现会话重新加载逻辑
  }, []);

  // 处理会话导入
  const handleSessionImport = useCallback(() => {
    // 实现会话导入逻辑
  }, []);

  // 处理会话导出
  const handleSessionExport = useCallback(() => {
    // 实现会话导出逻辑
  }, []);

  // 处理设置
  const handleSettings = useCallback(() => {
    // 实现设置逻辑
  }, []);

  return (
    <Layout className="app-container">
      <Resizable
        size={{ width: sidebarWidth, height: '100%' }}
        onResizeStop={(e, direction, ref, d) => {
          setSidebarWidth(sidebarWidth + d.width);
        }}
        minWidth={200}
        maxWidth={600}
        enable={{ right: true }}
      >
        <Sider width={sidebarWidth} className="app-sider">
          <div className="toolbar">
            <Button
              icon={<SettingOutlined />}
              onClick={() => setConfigModalVisible(true)}
            >
              模型配置
            </Button>
          </div>
          <SessionList
            onSelect={handleSessionSelect}
            onSave={handleSessionSave}
            onReload={handleSessionReload}
            onImport={handleSessionImport}
            onExport={handleSessionExport}
            onSettings={handleSettings}
          />
        </Sider>
      </Resizable>
      <Layout>
        <Content className="app-content">
          <div className="terminal-container">
            <TerminalTabs sessionInfo={activeSession} />
          </div>
          <Resizable
            size={{ height: aiAssistantHeight, width: '100%' }}
            onResizeStop={(e, direction, ref, d) => {
              setAIAssistantHeight(aiAssistantHeight + d.height);
            }}
            minHeight={100}
            maxHeight={500}
            enable={{ top: true }}
          >
            <div className="ai-assistant-container" style={{ height: aiAssistantHeight }}>
              <AIAssistant />
            </div>
          </Resizable>
        </Content>
      </Layout>

      <AIConfigModal
        visible={configModalVisible}
        onClose={() => setConfigModalVisible(false)}
      />
    </Layout>
  );
};

export default App; 