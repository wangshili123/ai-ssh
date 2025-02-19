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
    }
  };

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
            notification.error({
              message: '执行失败',
              description: '请先打开一个终端会话',
              placement: 'bottomLeft',
              duration: 3
            });
            return;
          }

          await sshService.executeCommand(command);
        } catch (error) {
          console.error('执行命令失败:', error);
          notification.error({
            message: '执行失败',
            description: error instanceof Error ? error.message : '未知错误',
            placement: 'bottomLeft',
            duration: 3
          });
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
          <div className="ai-messages" ref={messagesEndRef}>
            {renderModeComponent()}
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
              <Radio.Group value={mode} onChange={handleModeChange} size="small">
                <Radio.Button value={AssistantMode.COMMAND}>命令模式</Radio.Button>
                <Radio.Button value={AssistantMode.CONTEXT}>上下文模式</Radio.Button>
                <Radio.Button value={AssistantMode.AGENT}>Agent模式</Radio.Button>
              </Radio.Group>
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
        </>
      )}
    </div>
  );
};

export default AIAssistant; 