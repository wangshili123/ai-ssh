import React, { useState } from 'react';
import { Layout } from 'antd';
import Toolbar from './components/Toolbar';
import SessionList from './components/SessionList';
import TerminalTabs from './components/TerminalTabs';
import AIAssistant from './components/AIAssistant';
import type { ResizableProps } from 're-resizable';
import { Resizable } from 're-resizable';
import './App.css';

const { Sider, Content } = Layout;

type ResizeCallback = (
  e: MouseEvent | TouchEvent,
  direction: string,
  ref: HTMLElement,
  d: {
    width: number;
    height: number;
  }
) => void;

const App: React.FC = () => {
  const [activeSession, setActiveSession] = useState<string>();
  const [siderWidth, setSiderWidth] = useState(300);
  const [aiHeight, setAiHeight] = useState(300);

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

  const handleSiderResize: ResizeCallback = (e, direction, ref, d) => {
    setSiderWidth(siderWidth + d.width);
  };

  const handleAIResize: ResizeCallback = (e, direction, ref, d) => {
    setAiHeight(aiHeight + d.height);
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
        <Resizable
          enable={{ right: true }}
          size={{ width: siderWidth, height: '100%' }}
          minWidth={200}
          maxWidth={600}
          onResizeStop={handleSiderResize}
        >
          <Sider width={siderWidth} theme="light" style={{ 
            borderRight: '1px solid #f0f0f0',
            height: '100%',
            overflow: 'auto'
          }}>
            <SessionList
              activeSession={activeSession}
              onSessionSelect={handleSessionSelect}
            />
          </Sider>
        </Resizable>
        <Content style={{ 
          display: 'flex', 
          flexDirection: 'column',
          position: 'relative',
          padding: '0 1px'
        }}>
          <div style={{ 
            flex: 1,
            position: 'relative',
            minHeight: 0,
            backgroundColor: '#000000'
          }}>
            <TerminalTabs />
          </div>
          <Resizable
            enable={{ top: true }}
            size={{ height: aiHeight, width: '100%' }}
            minHeight={100}
            maxHeight={500}
            onResizeStop={handleAIResize}
          >
            <div style={{ 
              height: '100%',
              backgroundColor: '#ffffff',
              borderTop: '1px solid #f0f0f0',
              overflow: 'auto'
            }}>
              <AIAssistant sessionId={activeSession} />
            </div>
          </Resizable>
        </Content>
      </Layout>
    </Layout>
  );
};

export default App; 