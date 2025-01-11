import React, { useState } from 'react';
import { Input, Button, List, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import './index.css';

const { TextArea } = Input;
const { Text } = Typography;

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: number;
}

interface AIAssistantProps {
  sessionId?: string;
  height?: number;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ sessionId, height }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // TODO: 实现与 AI 的通信
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: '这是一个模拟的 AI 响应...',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('AI 请求失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="ai-assistant">
      <div className="messages">
        <List
          dataSource={messages}
          renderItem={message => (
            <List.Item className={`message ${message.type}`}>
              <div className="message-content">
                <Text strong>{message.type === 'user' ? '你' : 'AI助手'}</Text>
                <div className="content">{message.content}</div>
                <div className="timestamp">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </List.Item>
          )}
        />
      </div>
      <div className="input-area">
        <TextArea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="输入命令或问题，按 Enter 发送..."
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSend}
          loading={loading}
          disabled={!sessionId}
        >
          发送
        </Button>
      </div>
    </div>
  );
};

export default AIAssistant; 