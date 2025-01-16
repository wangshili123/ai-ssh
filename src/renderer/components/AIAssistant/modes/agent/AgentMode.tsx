import React, { useState, useEffect } from 'react';
import { agentModeService } from '@/renderer/services/modes/agent';
import { AgentResponse } from '@/renderer/services/modes/agent/types';
import AgentMessage from './AgentMessage';
import './index.css';
import { terminalOutputService } from '@/renderer/services/terminalOutput';

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
      
      // 等待命令执行完成（通过检查输出中是否包含命令提示符）
      const checkOutput = async () => {
        const history = terminalOutputService.getHistory();
        const lastOutput = history[history.length - 1];
        
        if (lastOutput?.output && (lastOutput.output.includes('$ ') || lastOutput.output.includes('# '))) {
          // 命令执行完成，发送结果给 Agent 分析
          await agentModeService.handleCommandExecuted(lastOutput.output || '');
        } else {
          // 继续等待
          setTimeout(checkOutput, 500);
        }
      };
      
      checkOutput();
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