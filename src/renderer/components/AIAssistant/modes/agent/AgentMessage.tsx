import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Button, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { AgentResponse, AgentResponseStatus, MessageContent, CommandRiskLevel, CommandInfo } from '@/renderer/services/modes/agent/types';
import './AgentMessage.css';

interface Props {
  message: AgentResponse;
  onExecuteCommand?: (command: string) => void;
  onSkipCommand?: () => void;
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
  onExecute?: (command: string) => void;
  onSkip?: () => void;
}> = ({ command, onExecute, onSkip }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(command.executed);

  // 监听命令状态变化
  useEffect(() => {
    if (command.executed) {
      setIsExecuting(false);
      setIsCompleted(true);
    }
  }, [command.executed]);

  const handleExecute = async () => {
    if (!onExecute) return;
    setIsExecuting(true);
    await onExecute(command.text);
  };

  // 暴露 setIsExecuting 方法
  (command as any).setIsExecuting = setIsExecuting;

  const handleStop = async () => {
    if (!onExecute) return;
    await onExecute('\x03'); // 发送 Ctrl+C 信号
    setIsExecuting(false);
    setIsCompleted(true);
  };

  // 如果命令已执行或已停止，只显示禁用的"已执行"按钮
  if (isCompleted || command.executed) {
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
            type="text"
            disabled
          >
            已执行
          </Button>
        </div>
      </div>
    );
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
        {isExecuting ? (
          <>
            <div className="executing-status">
              <Spin size="small" />
              <span>执行中...</span>
            </div>
            <Button 
              danger
              onClick={handleStop}
            >
              停止
            </Button>
          </>
        ) : (
          <>
            <Button 
              type="primary"
              onClick={handleExecute}
            >
              执行
            </Button>
            <Button 
              type="text"
              onClick={onSkip}
            >
              跳过
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export const AgentMessage: React.FC<Props> = ({ message, onExecuteCommand, onSkipCommand }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [executingCommandIndex, setExecutingCommandIndex] = useState<number | null>(null);

  const handleExecute = async (command: CommandInfo) => {
    if (!onExecuteCommand) return;
    setExecutingCommandIndex(message.contents.findIndex(content => 
      content.type === 'command' && content.commands?.some(cmd => cmd === command)
    ));
    await onExecuteCommand(command.text);
  };

  const scrollToBottom = useCallback(() => {
    if (contentRef.current) {
      const element = contentRef.current;
      requestAnimationFrame(() => {
        element.scrollTop = element.scrollHeight;
      });
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('AgentMessage useEffect 触发:', {
        status: message.status,
        contentsLength: message.contents.length,
        contents: message.contents.map(c => ({
          type: c.type,
          hasAnalysis: !!c.analysis,
          hasCommands: c.commands?.length || 0,
          timestamp: c.timestamp
        }))
      });
    }
    scrollToBottom();
  }, [message.contents, message.status, scrollToBottom]);

  const renderContent = useCallback((content: MessageContent, index: number) => {
    // if (process.env.NODE_ENV === 'development') {
    //   console.log(`渲染第 ${index + 1}/${message.contents.length} 个内容块:`, {
    //     type: content.type,
    //     hasAnalysis: !!content.analysis,
    //     hasCommands: content.commands?.length || 0,
    //     timestamp: content.timestamp,
    //     content: content.content,
    //     analysis: content.analysis
    //   });
    // }

    if (content.type === 'output') {
      return null;
    }
    
    const hasAnalysis = content.analysis;
    const hasCommands = content.commands && content.commands.length > 0;
    const hasResult = content.type === 'result' && content.content;
    
    if (!hasAnalysis && !hasCommands && !hasResult) {
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
        
        {content.commands && content.commands.map((cmd, cmdIndex) => {
          // if (process.env.NODE_ENV === 'development') {
          //   console.log(`渲染命令 ${cmdIndex + 1}/${content.commands?.length}:`, {
          //     text: cmd.text,
          //     description: cmd.description,
          //     risk: cmd.risk,
          //     executed: cmd.executed
          //   });
          // }
          return (
            <CommandBlock
              key={cmdIndex}
              command={cmd}
              onExecute={onExecuteCommand}
              onSkip={onSkipCommand}
            />
          );
        })}
        
        {content.type === 'result' && content.content && (
          <div className="result-block">
            {content.content}
          </div>
        )}
      </div>
    );
  }, [onExecuteCommand, onSkipCommand, handleExecute]);

  if (process.env.NODE_ENV === 'development') {
    // console.log('AgentMessage 开始渲染:', {
    //   status: message.status,
    //   contentsLength: message.contents.length,
    //   hasExecuteHandler: !!onExecuteCommand,
    //   hasSkipHandler: !!onSkipCommand
    // });
  }

  return (
    <div className="agent-message">
      <StatusIndicator status={message.status} />
      
      <div className="message-content" ref={contentRef}>
        {message.contents.map(renderContent)}
      </div>
    </div>
  );
};

export default AgentMessage; 