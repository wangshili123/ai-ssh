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
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [aiAssistantHeight, setAIAssistantHeight] = useState(200);
  const [siderWidth, setSiderWidth] = useState(300);
  const [triggerNewTab, setTriggerNewTab] = useState(0);

  // 处理会话选择
  const handleSessionSelect = useCallback((session: SessionInfo) => {
    setActiveSession(session);
    // 每次选择会话时增加 triggerNewTab 的值，触发新标签页创建
    setTriggerNewTab(prev => prev + 1);
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
            onSettings={() => setConfigModalVisible(true)}
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
            size={{ height: aiAssistantHeight, width: '100%' }}
            onResizeStop={(e, direction, ref, d) => {
              setAIAssistantHeight(aiAssistantHeight + d.height);
            }}
            minHeight={100}
            maxHeight={500}
            enable={{ top: true }}
          >
            <div className="ai-assistant-container" style={{ height: aiAssistantHeight }}>
              <AIAssistant sessionId={activeSession?.id} />
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
}

export default App; 