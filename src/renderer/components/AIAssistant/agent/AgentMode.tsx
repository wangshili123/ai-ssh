import React from 'react';
import { Space } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { AgentResponse } from '../../../../services/agent/types';

interface AgentModeProps {
  content: string;
  response?: AgentResponse;
  onCopy: (text: string) => void;
  onExecute: (command: string) => void;
}

/**
 * Agent 模式组件
 * 继承现有的消息展示样式，添加 Agent 特有的交互
 */
const AgentMode: React.FC<AgentModeProps> = ({
  content,
  response,
  onCopy,
  onExecute
}) => {
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      {/* 复用现有的消息样式 */}
      <div className="message-content">
        {content}
      </div>
      
      {/* Agent 响应内容将在这里展示 */}
      {/* 后续根据 UI 设计文档实现具体内容 */}
    </Space>
  );
};

export default AgentMode; 