import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Input, Button, Radio, notification, Modal } from 'antd';
import { SendOutlined, PlusCircleOutlined, LeftOutlined, RightOutlined, RobotOutlined, RobotFilled } from '@ant-design/icons';
import { ipcRenderer } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../../types';
import CommandMode from './modes/command';
import ContextMode from './modes/context';
import AgentMode from './modes/agent/AgentMode';
import { commandModeService } from '../../services/modes/command';
import { contextModeService } from '../../services/modes/context';
import { agentModeService } from '../../services/modes/agent';
import { terminalOutputService } from '../../services/terminalOutput';
import { sshService } from '../../services/ssh';
import { aiService } from '../../services/ai';
import type { ContextResponse } from '../../services/ai';
import './style.css';
import type { RadioChangeEvent } from 'antd';
import { eventBus } from '../../services/eventBus';

interface AIAssistantProps {
  sessionId?: string;
  isCollapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
}

export enum AssistantMode {
  COMMAND = 'COMMAND',
  CONTEXT = 'CONTEXT',
  AGENT = 'AGENT'
}

const AIAssistant = ({ sessionId, isCollapsed = false, onCollapse }: AIAssistantProps): JSX.Element => {
  // 获取初始模式
  const getInitialMode = (): AssistantMode => {
    const savedMode = localStorage.getItem('ai-assistant-mode');
    switch (savedMode) {
      case 'COMMAND':
        return AssistantMode.COMMAND;
      case 'CONTEXT':
        return AssistantMode.CONTEXT;
      case 'AGENT':
        return AssistantMode.AGENT;
      default:
        return AssistantMode.COMMAND;
    }
  };

  const [input, setInput] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<AssistantMode>(getInitialMode());

  // 为每个模式维护独立的消息记录
  const [commandMessages, setCommandMessages] = useState<Message[]>([]);
  const [contextMessages, setContextMessages] = useState<Message[]>([]);
  
  // 获取当前模式的消息和设置函数
  const getCurrentModeMessages = () => {
    switch (mode) {
      case AssistantMode.COMMAND:
        return {
          messages: commandMessages,
          setMessages: setCommandMessages
        };
      case AssistantMode.CONTEXT:
        return {
          messages: contextMessages,
          setMessages: setContextMessages
        };
      default:
        return {
          messages: [],
          setMessages: () => {}
        };
    }
  };

  // 处理按键事件
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  // 处理发送消息
  const handleSend = async (message: string) => {
    if (!message.trim() || loading) return;

    try {
      setLoading(true);
      setInput('');
      setInputHistory(prev => [message.trim(), ...prev]);
      setHistoryIndex(-1);

      // 立即滚动到底部
      setTimeout(scrollToBottom, 100);

      const { messages, setMessages } = getCurrentModeMessages();

      // 添加用户消息
      const userMessage: Message = {
        id: uuidv4(),
        type: 'user',
        content: message,
        timestamp: Date.now()
      };
      setMessages([...messages, userMessage]);

      // 根据当前模式处理消息
      let assistantMessage: Message;
      switch (mode) {
        case AssistantMode.COMMAND: {
          const suggestion = await commandModeService.getCommandSuggestion(message);
          assistantMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: '',  // AI 助手没有文本内容
            commands: [suggestion],  // 将命令建议放入 commands 数组
            timestamp: Date.now()
          };
          setCommandMessages(prev => [...prev, assistantMessage]);
          break;
        }
        case AssistantMode.CONTEXT: {
          const response = await contextModeService.getContextResponse(message);
          assistantMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: response.explanation || '',
            command: response.command,
            timestamp: Date.now()
          };
          setContextMessages(prev => [...prev, assistantMessage]);
          break;
        }
        case AssistantMode.AGENT: {
          await agentModeService.getNextStep(message, true);
          break;
        }
        default:
          throw new Error(`不支持的模式: ${mode}`);
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.error('处理消息失败:', error);
      notification.error({
        message: '处理失败',
        description: error.message,
        placement: 'bottomLeft',
        duration: 3
      });
    } finally {
      setLoading(false);
      // 处理完成后再次滚动到底部
      setTimeout(scrollToBottom, 200);
    }
  };

  // 自动滚动到底部
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      console.log('[主组件] 执行滚动到底部');
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
      console.log('[主组件] 滚动目标元素不存在');
    }
  };

  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    scrollToBottom();
  }, [commandMessages, contextMessages, loading]);

  // Agent模式使用内部滚动逻辑，不需要主组件轮询
  // useEffect(() => {
  //   if (mode === AssistantMode.AGENT) {
  //     // Agent模式的滚动由AgentMode组件内部处理
  //   }
  // }, [mode]);

  // 保存用户模式选择
  useEffect(() => {
    const savedMode = localStorage.getItem('ai-assistant-mode');
    if (savedMode === 'COMMAND') {
      setMode(AssistantMode.COMMAND);
    } else if (savedMode === 'CONTEXT') {
      setMode(AssistantMode.CONTEXT);
    } else if (savedMode === 'AGENT') {
      setMode(AssistantMode.AGENT);
    }
  }, []);

  // 处理模式切换
  const handleModeChange = (e: RadioChangeEvent) => {
    const newMode = e.target.value as AssistantMode;
    setMode(newMode);
    localStorage.setItem('ai-assistant-mode', newMode);
  };

  // 处理重新生成命令
  const handleRegenerate = async (messageId: string, userInput: string) => {
    try {
      setLoading(true);
      const suggestion = await commandModeService.getCommandSuggestion(userInput);
      setCommandMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            content: userInput,
            command: suggestion
          };
        }
        return msg;
      }));
    } catch (error) {
      console.error('重新生成命令失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理清除对话记录
  const handleClearMessages = () => {
    Modal.confirm({
      title: '确认清除对话',
      content: '是否确认清除当前模式下的所有对话记录？此操作不可恢复。',
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        const { setMessages } = getCurrentModeMessages();
        setMessages([]);
        setInput('');
        
        // 根据不同模式清除相应的状态
        switch (mode) {
          case AssistantMode.AGENT:
            agentModeService.reset();
            break;
          case AssistantMode.CONTEXT:
            contextModeService.clearHistory();
            // 清空终端输出历史
            terminalOutputService.clear();
            break;
          case AssistantMode.COMMAND:
            // 命令模式也需要清空终端输出历史
            terminalOutputService.clear();
            break;
        }

        notification.success({
          message: `${mode === AssistantMode.COMMAND ? '命令模式' : mode === AssistantMode.CONTEXT ? '上下文模式' : 'Agent模式'}对话已清除`,
          placement: 'bottomLeft',
          duration: 2
        });
      }
    });
  };

  // 渲染当前模式的组件
  const renderModeComponent = () => {
    const { messages } = getCurrentModeMessages();
    
    const commonProps = {
      sessionId,
      input,
      loading,
      messages,
      onUpdateMessages: getCurrentModeMessages().setMessages,
      onRegenerate: mode === AssistantMode.COMMAND ? handleRegenerate : undefined,
      onSendMessage: handleSend,
      onCopy: (text: string) => {
        navigator.clipboard.writeText(text);
      },
      onExecute: async (command: string) => {
        try {
          // 获取当前活动的 shell ID
          const currentShellId = eventBus.getCurrentShellId();
          if (!currentShellId) {
            const errorMessage = '请先打开一个终端会话';
            notification.error({
              message: '执行失败',
              description: errorMessage,
              placement: 'bottomLeft',
              duration: 3
            });
            // 抛出错误，让Agent模式能够捕获并更新状态
            throw new Error(errorMessage);
          }

          await sshService.executeCommand(command);
        } catch (error) {
          console.error('执行命令失败:', error);
          const errorMessage = error instanceof Error ? error.message : '未知错误';

          // 只有在不是"请先打开一个终端会话"错误时才显示通知
          // 因为上面已经显示过了
          if (!errorMessage.includes('请先打开一个终端会话')) {
            notification.error({
              message: '执行失败',
              description: errorMessage,
              placement: 'bottomLeft',
              duration: 3
            });
          }

          // 重新抛出错误，让Agent模式能够处理
          throw error;
        }
      }
    };

    switch (mode) {
      case AssistantMode.COMMAND:
        return <CommandMode {...commonProps} />;
      case AssistantMode.CONTEXT:
        return <ContextMode {...commonProps} />;
      case AssistantMode.AGENT:
        return <AgentMode onExecute={commonProps.onExecute} />;
      default:
        return null;
    }
  };

  const [configModalVisible, setConfigModalVisible] = useState(false);

  // 监听打开配置对话框的 IPC 消息
  useEffect(() => {
    const handleOpenConfig = () => {
      console.log('收到打开配置对话框的消息');
      setConfigModalVisible(true);
    };

    ipcRenderer.on('open-ai-config', handleOpenConfig);

    return () => {
      ipcRenderer.removeListener('open-ai-config', handleOpenConfig);
    };
  }, []);

  // 处理配置对话框关闭
  const handleConfigModalClose = () => {
    setConfigModalVisible(false);
  };

  return (
    <div className={`ai-assistant ${isCollapsed ? 'collapsed' : ''}`}>
      <Button
        className="collapse-button"
        icon={isCollapsed ? <RobotOutlined /> : <RobotFilled />}
        onClick={() => onCollapse?.(!isCollapsed)}
      />
      {!isCollapsed && (
        <>
          <div className="ai-messages">
            {renderModeComponent()}
            <div ref={messagesEndRef} />
          </div>
          <div className="ai-input-container">
            <div className="input-wrapper">
              <Input.TextArea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入内容，按 Enter 发送..."
                autoSize={{ minRows: 1, maxRows: 6 }}
                disabled={loading}
              />
            </div>
            <div className="button-wrapper">
              <div className="left-buttons">
                <Radio.Group value={mode} onChange={handleModeChange} size="small">
                  <Radio.Button value={AssistantMode.COMMAND}>命令模式</Radio.Button>
                  <Radio.Button value={AssistantMode.CONTEXT}>上下文模式</Radio.Button>
                  <Radio.Button value={AssistantMode.AGENT}>Agent模式</Radio.Button>
                </Radio.Group>
              </div>
              <div className="right-buttons">
                <Button
                  icon={<PlusCircleOutlined />}
                  onClick={handleClearMessages}
                  title="新建聊天"
                  size="small"
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => handleSend(input)}
                  loading={loading}
                  disabled={!input.trim()}
                >
                  发送
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAssistant; 