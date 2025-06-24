import React, { useEffect, useState, useCallback, useRef } from 'react';
import { UserOutlined } from '@ant-design/icons';
import { agentModeService } from '../../../../services/modes/agent';
import { terminalOutputService } from '../../../../services/terminalOutput';
import { autoExecuteService } from '../../../../services/modes/agent/autoExecute';
import { AgentResponse, AgentResponseStatus, AgentState } from '../../../../services/modes/agent/types';
import AgentMessage from './AgentMessage';
import './AgentMode.css';

interface AgentModeProps {
  onExecute: (command: string) => void;
}

// 检查命令是否执行完成
const checkCommandComplete = (output: string): boolean => {
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

const AgentMode: React.FC<AgentModeProps> = ({ onExecute }) => {
  const [currentMessage, setCurrentMessage] = useState<AgentResponse | null>(null);
  const [messages, setMessages] = useState<AgentResponse[]>([]);
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [messageTime, setMessageTime] = useState<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 滚动到底部的函数
  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      console.log('[AgentMode] 执行滚动到底部');
      const container = containerRef.current;
      // 使用 requestAnimationFrame 确保 DOM 更新完成后再滚动
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, []);

  // 监听Agent服务的消息更新
  useEffect(() => {
    let lastMessageCount = 0;
    let lastMessageStatus = '';
    let lastTaskId = '';

    const interval = setInterval(() => {
      // 获取当前状态
      const currentTask = agentModeService.getCurrentTask();
      const allMessages = agentModeService.getAllMessages();
      const currentMessage = agentModeService.getCurrentMessage();

      // 检查是否需要更新
      const currentTaskId = currentTask?.id || '';
      const currentMessageStatus = currentMessage?.status || '';

      const needUpdate =
        allMessages.length !== lastMessageCount ||
        currentMessageStatus !== lastMessageStatus ||
        currentTaskId !== lastTaskId;

      if (needUpdate) {
        // 更新历史消息
        setMessages(allMessages.map(msg => ({
          ...msg,
          userInput: msg.userInput || currentTask?.userInput
        })));

        // 更新当前消息
        if (currentMessage) {
          setCurrentMessage({
            ...currentMessage,
            userInput: currentTask?.userInput
          });
          if (currentTask?.userInput) {
            setUserMessage(currentTask.userInput);
            if (currentMessage.contents.length > 0) {
              setMessageTime(currentMessage.contents[0].timestamp);
            }
          }
        }

        // 更新状态记录
        lastMessageCount = allMessages.length;
        lastMessageStatus = currentMessageStatus;
        lastTaskId = currentTaskId;

        // 只在有实际变化时输出日志
        if (process.env.NODE_ENV === 'development') {
          console.log('[AgentMode] 状态已更新:', {
            messageCount: allMessages.length,
            messageStatus: currentMessageStatus,
            taskId: currentTaskId,
            hasCurrentMessage: !!currentMessage
          });
        }

        // 状态更新后滚动到底部
        setTimeout(scrollToBottom, 100);
      }
    }, 500);  // 增加轮询间隔到500ms

    return () => clearInterval(interval);
  }, []);

  // 处理命令执行完成
  const handleCommandComplete = useCallback(async (output: string) => {
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
  }, [currentMessage?.status]);

  // 处理命令执行
  const handleExecuteCommand = useCallback(async (command: string) => {
    try {
      console.log('[AgentMode] 开始处理命令执行:', command);
      
      // 如果是 Ctrl+C 信号，直接发送并返回，不进行后续处理
      if (command === 'q') {
        console.log('[AgentMode] 发送 Ctrl+C 信号');
        try {
          await onExecute(command);

          // 更新状态
          const currentTask = agentModeService.getCurrentTask();
          if (currentTask) {
            console.log('[AgentMode] 更新任务状态为分析中');
            agentModeService.setState(AgentState.ANALYZING);
            agentModeService.updateMessageStatus(AgentResponseStatus.ANALYZING);
          }
        } catch (executeError) {
          console.error('[AgentMode] Ctrl+C 信号发送失败:', executeError);
          // 即使Ctrl+C发送失败，也要更新状态
          agentModeService.setState(AgentState.ERROR);
          agentModeService.updateMessageStatus(AgentResponseStatus.ERROR);
          agentModeService.appendContent({
            type: 'error',
            content: `停止命令失败: ${executeError instanceof Error ? executeError.message : '未知错误'}`,
            timestamp: Date.now()
          });
        }
        return;
      }

      const currentTask = agentModeService.getCurrentTask();
      console.log('[AgentMode] 当前任务状态:', {
        taskId: currentTask?.id,
        taskPaused: currentTask?.paused,
        taskState: currentTask?.state,
        messageStatus: currentTask?.currentMessage?.status
      });

      if (!currentTask) {
        console.error('[AgentMode] 执行失败: 没有当前任务');
        return;
      }

      // 如果任务已暂停，先恢复
      if (currentTask.paused) {
        console.log('[AgentMode] 任务已暂停，正在恢复');
        agentModeService.togglePause();
      }

      console.log('[AgentMode] 更新状态为执行中');
      agentModeService.setState(AgentState.EXECUTING);
      agentModeService.updateMessageStatus(AgentResponseStatus.EXECUTING);
      
      const startHistoryLength = terminalOutputService.getHistory().length;
      console.log('[AgentMode] 初始历史记录长度:', startHistoryLength);
      
      console.log('[AgentMode] 发送命令到终端:', command);
      try {
        await onExecute(command);
        console.log('[AgentMode] 命令已发送到终端');
      } catch (executeError) {
        console.error('[AgentMode] 命令执行失败:', executeError);
        // 更新Agent状态为错误
        agentModeService.setState(AgentState.ERROR);
        agentModeService.updateMessageStatus(AgentResponseStatus.ERROR);

        // 添加错误信息到消息内容
        agentModeService.appendContent({
          type: 'error',
          content: `命令执行失败: ${executeError instanceof Error ? executeError.message : '未知错误'}`,
          timestamp: Date.now()
        });

        return; // 直接返回，不继续检查输出
      }
      
      let isTerminated = false;
      let checkCount = 0;
      const maxChecks = 200; // 最多检查200次 (200 * 300ms = 60秒)

      const checkOutput = async () => {
        if (isTerminated) {
          console.log('[AgentMode] 检查已终止');
          return;
        }

        checkCount++;
        if (checkCount > maxChecks) {
          console.log('[AgentMode] 检查超时，停止检查');
          isTerminated = true;
          agentModeService.setState(AgentState.ERROR);
          agentModeService.updateMessageStatus(AgentResponseStatus.ERROR);
          return;
        }

        const task = agentModeService.getCurrentTask();

        // 检查任务是否被取消或不存在
        if (!task) {
          console.log('[AgentMode] 任务不存在，停止检查输出');
          isTerminated = true;
          return;
        }

        // 检查任务状态
        if (task.paused || task.state === AgentState.CANCELLED || task.state === AgentState.ERROR) {
          console.log('[AgentMode] 任务已暂停/取消/错误，停止检查输出:', task.state);
          isTerminated = true;
          return;
        }
        
        const history = terminalOutputService.getHistory();
        const newOutputs = history.slice(startHistoryLength);
        
        // 分别获取命令和输出
        const lastCommand = command;  // 保存当前执行的命令
        const outputsOnly = newOutputs.map(output => output.output).join('\n');
        
        // 减少日志输出频率，只在有输出时才打印
        if (outputsOnly.length > 0 && checkCount % 10 === 0) {
          console.log('[AgentMode] 检查输出:', {
            checkCount,
            outputLength: outputsOnly.length,
            lastLine: outputsOnly.split('\n').pop()
          });
        }
        
        // 检查是否有命令提示符
        if (checkCommandComplete(outputsOnly)) {
          console.log('[AgentMode] 检测到命令提示符，命令执行完成');
          isTerminated = true;
          // 将命令和输出分开传递
          await handleCommandComplete(`${lastCommand}\n${outputsOnly}`);
          return;
        }
        
        // 继续检查
        setTimeout(checkOutput, 300);
      };
      
      console.log('[AgentMode] 开始检查输出');
      checkOutput();
    } catch (error) {
      console.error('[AgentMode] 执行命令失败:', error);
      agentModeService.setState(AgentState.ERROR);
      agentModeService.updateMessageStatus(AgentResponseStatus.ERROR);
    }
  }, [onExecute, handleCommandComplete]);

  // 设置命令执行回调
  useEffect(() => {
    autoExecuteService.setExecuteCommandCallback(handleExecuteCommand);
  }, [handleExecuteCommand]);

  // 处理跳过命令
  const handleSkipCommand = useCallback(() => {
    try {
      console.log('[AgentMode] 开始处理跳过命令');
      const currentTask = agentModeService.getCurrentTask();
      if (!currentTask) {
        console.error('[AgentMode] 跳过命令失败: 没有当前任务');
        return;
      }

      console.log('[AgentMode] 当前任务状态:', {
        taskId: currentTask.id,
        paused: currentTask.paused,
        state: currentTask.state
      });

      // 如果任务已暂停，先恢复
      if (currentTask.paused) {
        console.log('[AgentMode] 任务已暂停，先恢复');
        agentModeService.togglePause();
      }

      console.log('[AgentMode] 更新状态为分析中');
      agentModeService.setState(AgentState.ANALYZING);
      agentModeService.updateMessageStatus(AgentResponseStatus.ANALYZING);
      
      console.log('[AgentMode] 调用 handleCommandExecuted');
      agentModeService.handleCommandExecuted('Command skipped');
      
      console.log('[AgentMode] 跳过命令处理完成');
    } catch (error) {
      console.error('[AgentMode] 跳过命令失败:', error);
      agentModeService.setState(AgentState.ERROR);
      agentModeService.updateMessageStatus(AgentResponseStatus.ERROR);
    }
  }, []);

  return (
    <div className="agent-mode" ref={containerRef}>
      {messages.map((message, index) => {
        const task = agentModeService.getCurrentTask();
        // 修改判断逻辑：检查消息内容和时间戳是否匹配
        const isCurrentMessage = task?.currentMessage?.contents.some(content => 
          message.contents.some(msgContent => 
            content.timestamp === msgContent.timestamp
          )
        );
        
        // 减少渲染日志的输出频率
        if (process.env.NODE_ENV === 'development' && index === 0) {
          console.log('[AgentMode] 渲染消息:', {
            messageIndex: index,
            isCurrentMessage,
            messageStatus: message.status,
            totalMessages: messages.length
          });
        }
        
        return (
          <React.Fragment key={index}>
            {message.userInput && (
              <div className="message user">
                <div className="message-header">
                  <div className="message-avatar">
                    <UserOutlined />
                  </div>
                  <div className="message-time">
                    {message.contents[0]?.timestamp ? new Date(message.contents[0].timestamp).toLocaleString() : ''}
                  </div>
                </div>
                <div className="message-content">
                  {message.userInput}
                </div>
              </div>
            )}
            <AgentMessage
              message={message}
              onExecuteCommand={isCurrentMessage ? handleExecuteCommand : undefined}
              onSkipCommand={isCurrentMessage ? handleSkipCommand : undefined}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default AgentMode; 