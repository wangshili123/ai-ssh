import React, { useState, useEffect } from 'react';
import { agentModeService } from '@/renderer/services/modes/agent';
import { AgentResponse } from '@/renderer/services/modes/agent/types';
import AgentMessage from './AgentMessage';
import './index.css';

interface AgentModeProps {
  onExecute: (command: string) => void;
}

const AgentMode: React.FC<AgentModeProps> = ({ onExecute }) => {
  const [currentMessage, setCurrentMessage] = useState<AgentResponse | null>(null);

  // 监听Agent服务的消息更新
  useEffect(() => {
    const interval = setInterval(() => {
      const message = agentModeService.getCurrentMessage();
      if (message) {
        setCurrentMessage({ ...message });
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // 处理命令执行
  const handleExecuteCommand = async (command: string) => {
    try {
      await onExecute(command);
    } catch (error) {
      console.error('执行命令失败:', error);
    }
  };

  // 处理跳过命令
  const handleSkipCommand = () => {
    // TODO: 实现跳过命令的逻辑
    console.log('跳过当前命令');
  };

  return (
    <div className="agent-mode">
      {currentMessage && (
        <AgentMessage
          message={currentMessage}
          onExecuteCommand={handleExecuteCommand}
          onSkipCommand={handleSkipCommand}
        />
      )}
    </div>
  );
};

export default AgentMode; 