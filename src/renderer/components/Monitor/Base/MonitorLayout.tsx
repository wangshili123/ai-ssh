import React from 'react';
import { Layout } from 'antd';
import { SessionInfo } from '../../../types';
import { MonitorControlPanel } from './MonitorControlPanel';
import { MonitorStatusBar } from './MonitorStatusBar';
import './MonitorLayout.css';

const { Header, Content, Footer } = Layout;

interface MonitorLayoutProps {
  /** 当前会话 */
  session: SessionInfo;
  /** 子组件 */
  children?: React.ReactNode;
}

/**
 * 监控布局组件
 */
export const MonitorLayout: React.FC<MonitorLayoutProps> = ({ session, children }) => {
  return (
    <Layout className="monitor-layout">
      <Header className="monitor-header">
        <MonitorControlPanel session={session} />
      </Header>
      <Content className="monitor-content">
        {children}
      </Content>
      <Footer className="monitor-footer">
        <MonitorStatusBar session={session} />
      </Footer>
    </Layout>
  );
}; 