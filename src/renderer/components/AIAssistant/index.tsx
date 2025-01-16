import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Input, Button, Radio, notification } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../../types';
import CommandModeComponent from './modes/command';
import ContextModeComponent from './modes/context';
import AgentModeComponent from './modes/agent';
import { commandModeService } from '../../services/modes/command';
import { contextModeService } from '../../services/modes/context';
import { agentModeService } from '../../services/modes/agent';
import { terminalOutputService } from '../../services/terminalOutput';
import { sshService } from '../../services/ssh';
import { aiService } from '../../services/ai';
import type { ContextResponse } from '../../services/ai';
import AIConfigModal from '../AIConfigModal';
import './style.css';
import type { RadioChangeEvent } from 'antd';

interface AIAssistantProps {
  sessionId?: string;
}

export enum AssistantMode {
  COMMAND = 'COMMAND',
  CONTEXT = 'CONTEXT',
  AGENT = 'AGENT'
}

const AIAssistant = ({ sessionId }: AIAssistantProps): JSX.Element => {
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
  const assistantRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // 处理拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === assistantRef.current?.querySelector('.resize-handle')) {
      setIsDragging(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
      e.preventDefault();
    }
  };

  // 处理拖拽过程
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const deltaX = dragStartX.current - e.clientX;
      const newWidth = Math.min(Math.max(300, dragStartWidth.current + deltaX), 800);
      setWidth(newWidth);
      document.documentElement.style.setProperty('--ai-assistant-width', `${newWidth}px`);
    }
  };

  // 处理拖拽结束
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 添加和移除事件监听器
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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

      // 添加用户消息
      const userMessage: Message = {
        id: uuidv4(),
        type: 'user',
        content: message,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, userMessage]);

      // 根据当前模式处理消息
      let assistantMessage: Message;
      switch (mode) {
        case AssistantMode.COMMAND: {
          const suggestion = await commandModeService.getCommandSuggestion(message);
          assistantMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: message,
            commands: [suggestion],
            timestamp: Date.now()
          };
          break;
        }
        case AssistantMode.CONTEXT: {
          const response = await contextModeService.getContextResponse(message);
          assistantMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: message,
            explanation: response.explanation,
            commands: response.commands,
            timestamp: Date.now()
          };
          break;
        }
        case AssistantMode.AGENT: {
          const response = await agentModeService.getNextStep(message);
          assistantMessage = {
            id: uuidv4(),
            type: 'assistant',
            content: typeof response === 'string' ? response : '',
            commands: Array.isArray(response) ? response : undefined,
            timestamp: Date.now()
          };
          break;
        }
        default:
          throw new Error(`不支持的模式: ${mode}`);
      }

      // 添加助手消息
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('处理消息失败:', error);
      notification.error({
        message: '处理失败',
        description: error.message,
        placement: 'bottomRight',
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
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            content: userInput,
            commands: [suggestion]
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

  // 渲染当前模式的组件
  const renderModeComponent = () => {
    const props = {
      sessionId,
      input,
      loading,
      messages,
      onUpdateMessages: setMessages,
      onRegenerate: mode === AssistantMode.COMMAND ? handleRegenerate : undefined,
      onSendMessage: handleSend,
      onCopy: (text: string) => {
        navigator.clipboard.writeText(text);
      },
      onExecute: async (command: string) => {
        try {
          await sshService.executeCommand(command);
        } catch (error) {
          console.error('执行命令失败:', error);
          notification.error({
            message: '执行失败',
            description: error instanceof Error ? error.message : '未知错误',
            placement: 'bottomRight',
            duration: 3
          });
        }
      }
    };

    switch (mode) {
      case AssistantMode.COMMAND:
        return <CommandModeComponent {...props} />;
      case AssistantMode.CONTEXT:
        return <ContextModeComponent {...props} />;
      case AssistantMode.AGENT:
        return <AgentModeComponent {...props} />;
      default:
        return null;
    }
  };

  return (
    <div 
      className="ai-assistant" 
      ref={assistantRef}
      onMouseDown={handleMouseDown}
      style={{ width: `${width}px` }}
    >
      <div className="resize-handle" />
      <div className="ai-messages" ref={messagesEndRef}>
        {renderModeComponent()}
      </div>
      <div className="ai-input-container">
        <div className="input-wrapper">
          <Input.TextArea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入内容，按回车发送，Shift+Enter 换行"
            disabled={loading}
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </div>
        <div className="button-wrapper">
          <Radio.Group 
            value={mode} 
            onChange={handleModeChange}
            size="small"
          >
            <Radio.Button value={AssistantMode.COMMAND}>命令模式</Radio.Button>
            <Radio.Button value={AssistantMode.CONTEXT}>上下文模式</Radio.Button>
            <Radio.Button value={AssistantMode.AGENT}>Agent 模式</Radio.Button>
          </Radio.Group>
          <Button
            type="text"
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
  );
};

export default AIAssistant; 