import React, { useState } from 'react';
import { Layout } from 'antd';
import Toolbar from './components/Toolbar';
import SessionList from './components/SessionList';
import Terminal from './components/Terminal';
import AIAssistant from './components/AIAssistant';
import './App.css';

const { Sider, Content } = Layout;

const App: React.FC = () => {
  const [activeSession, setActiveSession] = useState<string>();

  const handleSessionSelect = (sessionId: string) => {
    setActiveSession(sessionId);
  };

  const handleNewSession = () => {
    // TODO: 实现新建会话
  };

  const handleSave = () => {
    // TODO: 实现保存配置
  };

  const handleReload = () => {
    // TODO: 实现刷新
  };

  const handleImport = () => {
    // TODO: 实现导入配置
  };

  const handleExport = () => {
    // TODO: 实现导出配置
  };

  const handleSettings = () => {
    // TODO: 实现设置
  };

  return (
    <Layout style={{ height: '100vh' }}>
      <Toolbar
        onNewSession={handleNewSession}
        onSave={handleSave}
        onReload={handleReload}
        onImport={handleImport}
        onExport={handleExport}
        onSettings={handleSettings}
      />
      <Layout>
        <Sider width={300} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
          <SessionList
            activeSession={activeSession}
            onSessionSelect={handleSessionSelect}
          />
        </Sider>
        <Content style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Terminal sessionId={activeSession} />
          </div>
          <div style={{ height: 300 }}>
            <AIAssistant sessionId={activeSession} />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App; 