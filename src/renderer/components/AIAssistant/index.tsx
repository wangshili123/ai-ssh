import React, { useState, useRef, KeyboardEvent } from 'react';
import { Input, Button, message } from 'antd';
import { SendOutlined, CopyOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './style.css';

const { TextArea } = Input;

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
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
      // TODO: 这里后续会实现与 AI 的实际对话
      console.log('发送消息:', input);
      
      // 模拟 AI 回复
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: '这是一个测试回复，包含代码示例：\n```python\nprint("Hello, World!")\n```',
        timestamp: Date.now()
      };
      
      // 添加到历史记录
      setInputHistory(prev => [input, ...prev].slice(0, 50));
      setInput('');
      setHistoryIndex(-1);

      // 延迟一秒显示 AI 回复
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessages(prev => [...prev, aiMessage]);
      
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
            {msg.content}
          </ReactMarkdown>
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