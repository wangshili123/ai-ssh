import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { Button, Spin, Input, message as antMsg } from 'antd';
import { LoadingOutlined, StopOutlined, CopyOutlined } from '@ant-design/icons';
import { AgentResponse, AgentResponseStatus, MessageContent, CommandRiskLevel, CommandInfo, AgentState } from '@/renderer/services/modes/agent/types';
import { agentModeService } from '@/renderer/services/modes/agent';
import './AgentMessage.css';

interface Props {
  message: AgentResponse;
  onExecuteCommand?: (command: string) => void;
  onSkipCommand?: () => void;
}

interface StatusIndicatorProps {
  status: AgentResponseStatus;
  onCancel?: () => void;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, onCancel }) => {
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
      case AgentResponseStatus.CANCELLED:
        return '已取消';
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

  const canCancel = [
    AgentResponseStatus.THINKING,
    AgentResponseStatus.WAITING,
    AgentResponseStatus.EXECUTING,
    AgentResponseStatus.ANALYZING
  ].includes(status);

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className={`status-indicator ${status.toLowerCase()}`}>
      {isLoading && <Spin indicator={<LoadingOutlined />} />}
      <span className="status-text">{getStatusText()}</span>
      {canCancel && (
        <Button 
          type="text" 
          size="small" 
          icon={<StopOutlined />} 
          onClick={handleCancel}
          className="cancel-button"
          title="取消任务"
        />
      )}
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
  message: AgentResponse;
}> = ({ command, onExecute, onSkip, message }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(command.executed);
  const [commandText, setCommandText] = useState(command.command);
  const [isEditing, setIsEditing] = useState(false);

  // 监听命令状态变化
  useEffect(() => {
    console.log('[AgentMessage] 命令状态变化:', {
      commandText: command.command,
      executed: command.executed
    });
    if (command.executed) {
      setIsExecuting(false);
      setIsCompleted(true);
    }
  }, [command.executed, command.command]);

  // 监听消息状态变化
  useEffect(() => {
    const task = agentModeService.getCurrentTask();
    console.log('[AgentMessage] 消息状态变化:', {
      commandText: command.command,
      messageStatus: message.status,
      taskId: task?.id,
      messageTimestamp: message.contents[0]?.timestamp,
      currentMessageTimestamp: task?.currentMessage?.contents[0]?.timestamp
    });

    // 检查是否是当前正在执行的命令
    const isCurrentCommand = task?.currentMessage?.contents.some(content => 
      message.contents.some(msgContent => 
        content.timestamp === msgContent.timestamp &&
        content.type === 'command' &&
        content.command === command.command
      )
    );

    console.log('[AgentMessage] 命令状态检查:', {
      isCurrentCommand,
      commandText: command.command,
      messageStatus: message.status
    });

    // 更新执行状态
    if (isCurrentCommand && message.status === AgentResponseStatus.EXECUTING) {
      console.log('[AgentMessage] 设置命令为执行中:', command.command);
      setIsExecuting(true);
    } else {
      setIsExecuting(false);
    }
  }, [command.command, message.status, message.contents]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(commandText);
      antMsg.success('命令已复制');
    } catch (error) {
      console.error('复制命令失败:', error);
      antMsg.error('复制失败');
    }
  };

  const handleCommandChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommandText(e.target.value);
  };

  const handleExecute = async () => {
    if (!onExecute) {
      console.log('[AgentMessage] 执行回调未定义');
      return;
    }
    try {
      console.log('[AgentMessage] 开始执行命令:', {
        commandText,
        messageStatus: message.status,
        isExecuting,
        isCompleted
      });

      const task = agentModeService.getCurrentTask();
      console.log('[AgentMessage] 当前任务状态:', {
        taskId: task?.id,
        taskPaused: task?.paused,
        isCurrentMessage: task?.currentMessage === message
      });

      setIsExecuting(true);
      console.log('[AgentMessage] 已设置执行状态为 true');
      
      await onExecute(commandText);
      console.log('[AgentMessage] 命令已发送到执行回调');
    } catch (error) {
      console.error('[AgentMessage] 执行命令失败:', error);
      setIsExecuting(false);
    }
  };

  const handleStop = async () => {
    if (!onExecute) {
      console.log('[AgentMessage] 停止回调未定义');
      return;
    }
    try {
      console.log('[AgentMessage] 开始处理停止命令');
      const task = agentModeService.getCurrentTask();
      console.log('[AgentMessage] 当前任务状态:', {
        taskId: task?.id,
        taskPaused: task?.paused,
        messageStatus: message.status
      });

      // 使用命令指定的终止方式，如果没有则使用默认的 Ctrl+C
      const stopKey = command.stopCommand || '\x03';
      console.log('[AgentMessage] 发送停止命令:', stopKey);
      await onExecute(stopKey);

      // 更新状态
      console.log('[AgentMessage] 更新状态');
      agentModeService.setState(AgentState.ANALYZING);
      agentModeService.updateMessageStatus(AgentResponseStatus.ANALYZING);
      
      // 设置命令为已执行状态
      setIsCompleted(true);
      setIsExecuting(false);
      command.executed = true;  // 更新命令的执行状态

      // 如果任务被暂停，恢复任务以触发下一步
      if (task?.paused) {
        console.log('[AgentMessage] 恢复任务以触发下一步');
        agentModeService.togglePause();
      }

      console.log('[AgentMessage] 停止命令处理完成');
    } catch (error) {
      console.error('[AgentMessage] 停止命令失败:', error);
      setIsExecuting(false);
    }
  };

  const handleSkip = () => {
    if (!onSkip) {
      console.log('[AgentMessage] 跳过回调未定义');
      return;
    }
    try {
      console.log('[AgentMessage] 开始跳过命令:', command.command);
      onSkip();
      setIsCompleted(true);
      setIsExecuting(false);
      console.log('[AgentMessage] 命令已跳过，状态已更新');
    } catch (error) {
      console.error('[AgentMessage] 跳过命令失败:', error);
    }
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
          {command.command}
        </div>
        <div className="command-actions">
          <Button type="text" disabled>已执行</Button>
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
      <div className="command-text-container">
        <Input.TextArea
          value={commandText}
          onChange={handleCommandChange}
          autoSize={{ minRows: 1, maxRows: 6 }}
          className="command-text-input"
        />
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
            {/* <Button 
              type="text"
              onClick={handleSkip}
            >
              跳过
            </Button> */}
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={handleCopy}
              title="复制命令"
            >
              复制
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

  const handleCancel = useCallback(() => {
    const task = agentModeService.getCurrentTask();
    if (task) {
      console.log('[AgentMessage] 取消任务:', task.id);
      agentModeService.setState(AgentState.CANCELLED);
      agentModeService.updateMessageStatus(AgentResponseStatus.CANCELLED);
    }
  }, []);

  const handleExecute = async (command: CommandInfo) => {
    if (!onExecuteCommand) return;
    setExecutingCommandIndex(message.contents.findIndex(content => 
      content.type === 'command' && content.command === command.command
    ));
    await onExecuteCommand(command.command);
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
          hasCommand: !!c.command,
          timestamp: c.timestamp
        }))
      });
    }
    scrollToBottom();
  }, [message.contents, message.status, scrollToBottom]);

  const renderContent = useCallback((content: MessageContent, index: number) => {
    if (content.type === 'output') {
      return null;
    }
    
    const hasAnalysis = content.analysis;
    const hasCommand = content.command;
    const hasResult = content.type === 'result' && content.content;
    
    if (!hasAnalysis && !hasCommand && !hasResult) {
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
        
        {content.command && (
          <CommandBlock
            command= {{
              command: content.command,
              description: content.description || '',  // 添加必要的字段
              risk: content.risk || CommandRiskLevel.UNKNOWN,  // 设置默认风险等级
              executed: false
            }}
            onExecute={onExecuteCommand}
            onSkip={onSkipCommand}
            message={message}
          />
        )}
        
        {content.type === 'result' && content.content && (
          <div className="result-block">
            {content.content}
          </div>
        )}
      </div>
    );
  }, [onExecuteCommand, onSkipCommand]);

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
      <StatusIndicator status={message.status} onCancel={handleCancel} />
      
      <div className="message-content" ref={contentRef}>
        {message.contents.map(renderContent)}
      </div>
    </div>
  );
};

export default AgentMessage; 