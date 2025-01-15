import React from 'react';
import { Button } from 'antd';
import { CopyOutlined, UserOutlined, RobotOutlined, SyncOutlined } from '@ant-design/icons';
import { CommandSuggestion } from '../../../../services/ai';
import CommandMode from '../../CommandMode';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CommandMessageProps {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  commands?: CommandSuggestion[];
  onCopy: (text: string) => void;
  onExecute: (command: string) => void;
  onRegenerate?: (messageId: string, userInput: string) => void;
}

const CommandMessage: React.FC<CommandMessageProps> = ({
  id,
  type,
  content,
  timestamp,
  commands,
  onCopy,
  onExecute,
  onRegenerate
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
        {isUser && (
          <Button
            type="text"
            icon={<CopyOutlined />}
            onClick={() => onCopy(content)}
            className="copy-button"
          />
        )}
      </div>
      <div className="message-content">
        {isUser && content && (
          <div className="text-content">
            <ReactMarkdown
              components={{
                code({ className, children }) {
                  const match = /language-(\w+)/.exec(className || '');
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
              {content}
            </ReactMarkdown>
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
              onRegenerate={!isUser ? onRegenerate : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommandMessage; 