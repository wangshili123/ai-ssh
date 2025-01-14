import React, { useState, useRef, KeyboardEvent, useEffect } from 'react';
import { Input, Button, message, Alert, Space, Tag, Radio } from 'antd';
import { SendOutlined, CopyOutlined, UserOutlined, RobotOutlined, ExclamationCircleOutlined, CheckCircleOutlined, CodeOutlined, SyncOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { aiService, CommandSuggestion } from '../../services/ai';
import { sshService } from '../../services/ssh';
import { eventBus } from '../../services/eventBus';
import { terminalOutputService } from '../../services/terminalOutput';
import './style.css';
import type { RadioChangeEvent } from 'antd';
import { v4 as uuidv4 } from 'uuid';

interface AIAssistantProps {
  sessionId?: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  command?: CommandSuggestion;
}

const AIAssistant = ({ sessionId }: AIAssistantProps): JSX.Element => {
  const [input, setInput] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'command' | 'context'>(localStorage.getItem('aiMode') as 'command' | 'context' || 'command');
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

  // 执行命令
  const executeCommand = async (command: string) => {
    const shellId = eventBus.getCurrentShellId();
    if (!shellId) {
      message.warning('请先连接到 SSH 会话');
      return;
    }

    try {
      // 添加换行符确保命令执行
      await sshService.write(shellId, command + '\n');
      message.success('命令已发送');
    } catch (error) {
      message.error('执行命令失败：' + (error as Error).message);
    }
  };

  // 处理发送消息
  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: uuidv4(),
      type: 'user',
      content: input,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setInputHistory(prev => [input, ...prev].slice(0, 50));
    setHistoryIndex(-1);

    try {
      if (mode === 'command') {
        // 命令模式：保持现有的命令生成逻辑
        const command = await aiService.convertToCommand(userMessage.content);
        const assistantMessage: Message = {
          id: uuidv4(),
          type: 'assistant',
          content: command.description || '抱歉，我无法理解您的需求。',
          timestamp: Date.now(),
          command
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        // 上下文模式：获取当前终端输出并发送给AI
        const shellId = eventBus.getCurrentShellId();
        if (!shellId) {
          message.warning('请先连接到 SSH 会话');
          return;
        }

        // 获取最近的终端输出
        const terminalContext = terminalOutputService.getRecentOutput(shellId);
        
        try {
          // 发送请求给AI服务
          const response = await aiService.getContextResponse(userMessage.content, terminalContext);
          
          const assistantMessage: Message = {
            id: uuidv4(),
            type: 'assistant',
            content: response,
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
          message.error('AI 助手处理失败：' + (error as Error).message);
          const errorMessage: Message = {
            id: uuidv4(),
            type: 'assistant',
            content: '抱歉，处理您的请求时出现错误。',
            timestamp: Date.now()
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      }
    } catch (error) {
      message.error('生成回复失败：' + (error as Error).message);
      const errorMessage: Message = {
        id: uuidv4(),
        type: 'assistant',
        content: '抱歉，处理您的请求时出现错误。',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // 滚动到底部
  const scrollToBottom = () => {
    // 使用 setTimeout 确保在内容渲染后滚动
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ 
          behavior: 'smooth',
          block: 'end'
        });
      }
    }, 100);
  };

  // 监听消息列表变化，自动滚动
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 复制消息内容
  const copyMessage = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      message.success('复制成功');
    }).catch(() => {
      message.error('复制失败');
    });
  };

  // 处理按键事件
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // 回车发送消息（非 Shift+Enter）
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    // 上下键浏览历史记录
    if (e.key === 'ArrowUp' && !e.ctrlKey) {
      e.preventDefault();
      if (historyIndex < inputHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(inputHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown' && !e.ctrlKey) {
      e.preventDefault();
      if (historyIndex > -1) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(newIndex === -1 ? '' : inputHistory[newIndex]);
      }
    }
  };

  // 重新生成命令
  const regenerateCommand = async (messageId: string, userInput: string) => {
    try {
      // 获取当前会话的命令历史
      const commandHistory = aiService.getCurrentCommands();
      console.log('重新生成命令 - 历史记录:', commandHistory);
      
      // 找到当前 AI 消息对应的用户消息
      const currentMessageIndex = messages.findIndex(msg => msg.id === messageId);
      const userMessage = messages
        .slice(0, currentMessageIndex)
        .reverse()
        .find(msg => msg.type === 'user');

      if (!userMessage) {
        message.error('找不到原始提问内容');
        return;
      }
      
      // 生成新的命令，排除已生成过的命令
      const command = await aiService.convertToCommand(userMessage.content, commandHistory);
      
      // 更新消息列表
      setMessages(prev => prev.map(msg => 
        msg.id === messageId
          ? { ...msg, content: command.description, command }
          : msg
      ));
    } catch (error) {
      message.error('生成命令失败：' + (error as Error).message);
    }
  };

  // 渲染命令建议
  const renderCommandSuggestion = (command: CommandSuggestion, messageId: string, userInput: string) => {
    if (!command.command) return null;

    const riskColors = {
      low: 'success',
      medium: 'warning',
      high: 'error'
    };

    return (
      <div className="command-suggestion">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div className="command-header">
            <div className="command-line">
              <CodeOutlined />
              <span className="command-text">{command.command}</span>
              <Tag color={riskColors[command.risk]}>
                {command.risk === 'low' ? '安全' : command.risk === 'medium' ? '警告' : '危险'}
              </Tag>
            </div>
            <div className="command-actions">
              <Button
                type="text"
                icon={<CopyOutlined />}
                onClick={() => copyMessage(command.command)}
                className="copy-button"
              />
              <Button
                type="text"
                icon={<SyncOutlined />}
                onClick={() => regenerateCommand(messageId, userInput)}
                title="生成新的命令建议"
              >
                换一个
              </Button>
              <Button
                type="primary"
                size="small"
                onClick={() => executeCommand(command.command)}
              >
                运行
              </Button>
            </div>
          </div>
          {command.example && (
            <div className="command-example">
              示例：<code>{command.example}</code>
            </div>
          )}
          {command.parameters && command.parameters.length > 0 && (
            <div className="command-parameters">
              <div className="parameters-title">参数说明：</div>
              {command.parameters.map((param, index) => (
                <div key={index} className="parameter-item">
                  <Tag color={param.required ? 'blue' : 'default'}>
                    {param.name}
                  </Tag>
                  <span>{param.description}</span>
                </div>
              ))}
            </div>
          )}
          {command.risk !== 'low' && (
            <Alert
              message="安全提示"
              description={command.description}
              type={command.risk === 'medium' ? 'warning' : 'error'}
              showIcon
              icon={<ExclamationCircleOutlined />}
            />
          )}
        </Space>
      </div>
    );
  };

  // 渲染单个消息
  const renderMessage = (msg: Message) => {
    const isUser = msg.type === 'user';
    return (
      <div key={msg.id} className={`message ${msg.type}`}>
        <div className="message-header">
          <div className="message-avatar">
            {isUser ? <UserOutlined /> : <RobotOutlined />}
          </div>
          <div className="message-info">
            <span className="message-sender">{isUser ? '你' : 'AI助手'}</span>
            <span className="message-time">
              {new Date(msg.timestamp).toLocaleString()}
            </span>
          </div>
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => copyMessage(msg.content)}
            className="copy-button"
          />
        </div>
        <div className="message-content">
          {msg.command && msg.command.command ? (
            renderCommandSuggestion(msg.command, msg.id, msg.content)
          ) : (
            <ReactMarkdown
              components={{
                code({ className, children }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isCommand = match && match[1] === 'command';

                  if (isCommand && typeof children === 'string') {
                    // 处理命令代码块
                    const commands = children.trim().split('\n');
                    return (
                      <div className="command-suggestion">
                        <Space direction="vertical" style={{ width: '100%' }}>
                          {commands.map((cmd, index) => (
                            <div key={index} className="command-header">
                              <div className="command-line">
                                <CodeOutlined />
                                <span className="command-text">{cmd}</span>
                              </div>
                              <div className="command-actions">
                                <Button
                                  type="text"
                                  icon={<CopyOutlined />}
                                  onClick={() => copyMessage(cmd)}
                                  className="copy-button"
                                />
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={() => executeCommand(cmd)}
                                >
                                  运行
                                </Button>
                              </div>
                            </div>
                          ))}
                        </Space>
                      </div>
                    );
                  }

                  if (match && typeof children === 'string') {
                    return (
                      <SyntaxHighlighter
                        style={vscDarkPlus as any}
                        language={match[1]}
                        PreTag="div"
                      >
                        {children.replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    );
                  }

                  return <code className={className}>{children}</code>;
                }
              }}
            >
              {msg.command ? msg.command.description : msg.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    );
  };

  // 保存用户模式选择
  useEffect(() => {
    const savedMode = localStorage.getItem('ai-assistant-mode');
    if (savedMode === 'context' || savedMode === 'command') {
      setMode(savedMode);
    }
  }, []);

  // 处理模式切换
  const handleModeChange = (e: RadioChangeEvent) => {
    const newMode = e.target.value;
    setMode(newMode);
    localStorage.setItem('ai-assistant-mode', newMode);
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
        {messages.map(message => renderMessage(message))}
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
            <Radio.Button value="command">命令模式</Radio.Button>
            <Radio.Button value="context">上下文模式</Radio.Button>
          </Radio.Group>
          <Button
            type="text"
            icon={<SendOutlined />}
            onClick={handleSend}
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