import React, { useState, useRef, KeyboardEvent } from 'react';
import { Input, Button, message, Alert, Space, Tag } from 'antd';
import { SendOutlined, CopyOutlined, UserOutlined, RobotOutlined, ExclamationCircleOutlined, CheckCircleOutlined, CodeOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { aiService, CommandSuggestion } from '../../services/ai';
import './style.css';

const { TextArea } = Input;

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  command?: CommandSuggestion;
}

const AIAssistant: React.FC = () => {
  const [input, setInput] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<any>(null);

  // 处理发送消息
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      // 调用 AI 服务转换命令
      const command = await aiService.convertToCommand(input);
      
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: command.description,
        timestamp: Date.now(),
        command
      };
      
      // 添加到历史记录
      setInputHistory(prev => [input, ...prev].slice(0, 50));
      setInput('');
      setHistoryIndex(-1);

      setMessages(prev => [...prev, aiMessage]);
      
    } catch (error) {
      message.error('生成命令失败，请重试');
    } finally {
      setLoading(false);
      // 滚动到底部
      scrollToBottom();
    }
  };

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
    // Ctrl+Enter 发送消息
    if (e.ctrlKey && e.key === 'Enter') {
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

  // 渲染命令建议
  const renderCommandSuggestion = (command: CommandSuggestion) => {
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
            <Space>
              <CodeOutlined />
              <span className="command-text">{command.command}</span>
              <Tag color={riskColors[command.risk]}>
                {command.risk === 'low' ? '安全' : command.risk === 'medium' ? '警告' : '危险'}
              </Tag>
            </Space>
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => copyMessage(command.command)}
              className="copy-button"
            />
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
            renderCommandSuggestion(msg.command)
          ) : (
            <ReactMarkdown
              components={{
                code: ({ children, className }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  return match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus as any}
                      language={match[1]}
                      PreTag="div"
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={className}>{children}</code>
                  );
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

  return (
    <div className="ai-assistant">
      <div className="ai-messages">
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </div>
      <div className="ai-input-container">
        <TextArea
          ref={textAreaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入内容，按 Ctrl+Enter 发送"
          autoSize={{ minRows: 2, maxRows: 6 }}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!input.trim()}
        >
          发送
        </Button>
      </div>
    </div>
  );
};

export default AIAssistant; 