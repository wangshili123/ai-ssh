import React, { useState, useEffect } from 'react';
import { Input } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { agentModeService } from '@/renderer/services/modes/agent';
import { AgentResponse, AgentResponseStatus, AgentState } from '@/renderer/services/modes/agent/types';
import AgentMessage from './AgentMessage';
import './AgentMode.css';
import { terminalOutputService } from '@/renderer/services/terminalOutput';

interface AgentModeProps {
  onExecute: (command: string) => void;
}

const AgentMode: React.FC<AgentModeProps> = ({ onExecute }) => {
  const [currentMessage, setCurrentMessage] = useState<AgentResponse | null>(null);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [messageTime, setMessageTime] = useState<number>(0);

  // 监听Agent服务的消息更新
  useEffect(() => {
    const interval = setInterval(() => {
      const message = agentModeService.getCurrentMessage();
      if (message) {
        setCurrentMessage({ ...message });
        // 获取用户的输入消息和时间
        const task = agentModeService.getCurrentTask();
        if (task && task.userInput) {
          setUserMessage(task.userInput);
          // 使用第一条消息的时间戳
          if (message.contents.length > 0) {
            setMessageTime(message.contents[0].timestamp);
          }
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // 检查命令是否执行完成
  const isCommandComplete = (output: string): boolean => {
    // 检查是否有命令提示符
    const prompts = [
      /\[.*?\][#\$]\s*$/,  // 匹配 [user@host]# 或 [user@host]$ 格式
      /[$#>]\s*$/,         // 匹配行尾的 $、# 或 > 
      /\][$#>]\s*$/,       // 匹配 ]#、]$ 或 ]> 
    ];

    // 检查最后一行是否是提示符
    const lines = output.split('\n');
    const lastLine = lines[lines.length - 1].trim();
    return prompts.some(prompt => prompt.test(lastLine));
  };

  // 处理命令执行完成
  const handleCommandComplete = async (output: string) => {
    try {
      console.log('准备处理命令执行完成');
      
      // 确保 currentTask 存在且处于正确的状态
      const currentTask = agentModeService.getCurrentTask();
      if (!currentTask) {
        console.error('没有当前任务');
        return;
      }
      
      // 先设置状态为分析中
      agentModeService.setState(AgentState.ANALYZING);
      agentModeService.updateMessageStatus(AgentResponseStatus.ANALYZING);
      
      console.log('状态已更新为分析中');
      console.log('当前消息状态:', currentMessage?.status);
      
      // 发送结果给 Agent 分析
      console.log('开始调用 handleCommandExecuted');
      await agentModeService.handleCommandExecuted(output);
      console.log('handleCommandExecuted 调用完成');
      
      // 检查状态是否正确更新
      const message = agentModeService.getCurrentMessage();
      console.log('命令执行完成后的消息状态:', message?.status);
    } catch (error) {
      console.error('处理命令执行完成时出错:', error);
      agentModeService.setState(AgentState.ERROR);
      agentModeService.updateMessageStatus(AgentResponseStatus.ERROR);
    }
  };

  // 处理命令执行
  const handleExecuteCommand = async (command: string) => {
    try {
      // 如果是 Ctrl+C 信号，直接发送并返回，不进行后续处理
      if (command === '\x03') {
        await onExecute(command);
        return;
      }

      console.log('开始执行命令:', command);
      agentModeService.setState(AgentState.EXECUTING);
      agentModeService.updateMessageStatus(AgentResponseStatus.EXECUTING);
      
      const startHistoryLength = terminalOutputService.getHistory().length;
      console.log('初始历史记录长度:', startHistoryLength);
      
      await onExecute(command);
      console.log('命令已发送到终端');
      
      let isTerminated = false;
      
      const checkOutput = async () => {
        if (isTerminated) return;
        
        const history = terminalOutputService.getHistory();
        const newOutputs = history.slice(startHistoryLength);
        const fullOutput = newOutputs.map(output => output.output).join('\n');
        
        // 检查是否有命令提示符
        if (isCommandComplete(fullOutput)) {
          console.log('检测到命令提示符，命令执行完成');
          isTerminated = true;
          await handleCommandComplete(fullOutput);
          return;
        }
        
        // 继续检查
        setTimeout(checkOutput, 100);
      };
      
      console.log('开始检查输出');
      checkOutput();
    } catch (error) {
      console.error('执行命令失败:', error);
      agentModeService.setState(AgentState.ERROR);
      agentModeService.updateMessageStatus(AgentResponseStatus.ERROR);
    }
  };

  // 处理跳过命令
  const handleSkipCommand = () => {
    console.log('跳过当前命令');
    agentModeService.setState(AgentState.ANALYZING);
    agentModeService.updateMessageStatus(AgentResponseStatus.ANALYZING);
    agentModeService.handleCommandExecuted('Command skipped');
  };

  return (
    <div className="agent-mode">
      {userMessage && (
        <div className="message user">
          <div className="message-header">
            <div className="message-avatar">
              <UserOutlined />
            </div>
            <div className="message-time">
              {messageTime ? new Date(messageTime).toLocaleString() : ''}
            </div>
          </div>
          <div className="message-content">
            {userMessage}
          </div>
        </div>
      )}
      
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