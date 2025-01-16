import React from 'react';
import { Button, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { AgentResponse, AgentResponseStatus, MessageContent, CommandRiskLevel, CommandInfo } from '@/renderer/services/modes/agent/types';
import './AgentMessage.css';

interface Props {
  message: AgentResponse;
  onExecuteCommand: (command: string) => void;
  onSkipCommand: () => void;
}

const StatusIndicator: React.FC<{ status: AgentResponseStatus }> = ({ status }) => {
  const getStatusText = () => {
    switch (status) {
      case AgentResponseStatus.THINKING:
        return '思考中...';
      case AgentResponseStatus.WAITING:
        return '等待执行命令';
      case AgentResponseStatus.EXECUTING:
        return '执行中...';
      case AgentResponseStatus.ANALYZING:
        return '分析中...';
      case AgentResponseStatus.COMPLETED:
        return '已完成';
      case AgentResponseStatus.ERROR:
        return '出错了';
      default:
        return '';
    }
  };

  const isLoading = [
    AgentResponseStatus.THINKING,
    AgentResponseStatus.EXECUTING,
    AgentResponseStatus.ANALYZING
  ].includes(status);

  return (
    <div className={`status-indicator ${status.toLowerCase()}`}>
      {isLoading && <Spin indicator={<LoadingOutlined />} />}
      <span className="status-text">{getStatusText()}</span>
    </div>
  );
};

const RiskBadge: React.FC<{ risk: CommandRiskLevel }> = ({ risk }) => {
  const getRiskText = () => {
    switch (risk) {
      case CommandRiskLevel.HIGH:
        return '高风险';
      case CommandRiskLevel.MEDIUM:
        return '中风险';
      case CommandRiskLevel.LOW:
        return '低风险';
      default:
        return '未知风险';
    }
  };

  return (
    <span className={`risk-badge ${risk}`}>
      {getRiskText()}
    </span>
  );
};

const CommandBlock: React.FC<{
  command: CommandInfo;
  onExecute: (command: string) => void;
  onSkip: () => void;
}> = ({ command, onExecute, onSkip }) => {
  if (command.executed) {
    return null;
  }

  return (
    <div className="command-block">
      <div className="command-info">
        <div className="description">{command.description}</div>
        <RiskBadge risk={command.risk} />
      </div>
      <div className="command-text">
        {command.text}
      </div>
      <div className="command-actions">
        <Button 
          type="primary"
          onClick={() => onExecute(command.text)}
        >
          执行命令
        </Button>
        <Button 
          type="text"
          onClick={onSkip}
        >
          跳过
        </Button>
      </div>
    </div>
  );
};

const AgentMessage: React.FC<Props> = ({ message, onExecuteCommand, onSkipCommand }) => {
  return (
    <div className="agent-message">
      <StatusIndicator status={message.status} />
      
      <div className="message-content">
        {message.contents.map((content, index) => {
          if (content.type === 'output') {
            return null;
          }
          
          return (
            <div key={index} className={`content-item ${content.type}`}>
              {content.analysis && (
                <div className="analysis-block">
                  <div className="analysis-title">执行结果分析：</div>
                  {content.analysis}
                </div>
              )}
              
              {content.commands && content.commands.map((cmd, cmdIndex) => (
                <CommandBlock
                  key={cmdIndex}
                  command={cmd}
                  onExecute={onExecuteCommand}
                  onSkip={onSkipCommand}
                />
              ))}
              
              {content.type === 'result' && (
                <div className="result-block">
                  {content.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgentMessage; 