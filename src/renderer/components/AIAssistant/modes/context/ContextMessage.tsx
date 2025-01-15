import React from 'react';
import { Button } from 'antd';
import { CopyOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { CommandSuggestion } from '../../../../services/ai';
import CommandMode from '../../CommandMode';

interface ContextMessageProps {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  explanation?: string;
  commands?: CommandSuggestion[];
  onCopy: (text: string) => void;
  onExecute: (command: string) => void;
}

const ContextMessage: React.FC<ContextMessageProps> = ({
  id,
  type,
  content,
  timestamp,
  explanation,
  commands,
  onCopy,
  onExecute
}) => {
  const isUser = type === 'user';

  return (
    <div className={`message ${type}`}>
      <div className="message-header">
        <div className="message-avatar">
          {isUser ? <UserOutlined /> : <RobotOutlined />}
        </div>
        <div className="message-info">
          <span className="message-sender">{isUser ? '你' : 'AI助手'}</span>
          <span className="message-time">
            {new Date(timestamp).toLocaleString()}
          </span>
        </div>
        <Button
          type="text"
          icon={<CopyOutlined />}
          onClick={() => onCopy(content)}
          className="copy-button"
        />
      </div>
      <div className="message-content">
        {isUser && (
          <div className="text-content">{content}</div>
        )}

        {!isUser && explanation && (
          <div className="explanation-content">
            {explanation}
          </div>
        )}

        {commands && commands.map((cmd, index) => (
          <div key={`${id}-${index}`} className="command-wrapper">
            <CommandMode
              command={cmd}
              messageId={id}
              userInput={content}
              onCopy={onCopy}
              onExecute={onExecute}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContextMessage; 