import React from 'react';
import { Button } from 'antd';
import { CopyOutlined, UserOutlined, RobotOutlined } from '@ant-design/icons';
import { CommandSuggestion } from '../../../../services/ai';
import CommandMode from '../../CommandMode';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AgentMessageProps {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: number;
  explanation?: string;
  commands?: CommandSuggestion[];
  onCopy: (text: string) => void;
  onExecute: (command: string) => void;
}

const AgentMessage: React.FC<AgentMessageProps> = ({
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
        {(isUser || (!commands && content)) && (
          <div className="text-content">
            <ReactMarkdown
              components={{
                code({ className, children }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isCommand = match && match[1] === 'command';

                  if (isCommand && typeof children === 'string') {
                    const commands = children.trim().split('\n');
                    return (
                      <div className="command-suggestion">
                        {commands.map((cmd, index) => (
                          <CommandMode
                            key={`${id}-${index}`}
                            command={{
                              command: cmd,
                              description: '',
                              risk: 'low'
                            }}
                            messageId={id}
                            userInput={content}
                            onCopy={onCopy}
                            onExecute={onExecute}
                          />
                        ))}
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
              {content}
            </ReactMarkdown>
          </div>
        )}

        {!isUser && explanation && (
          <div className="explanation-content">
            {explanation}
          </div>
        )}

        {commands && commands.map((cmd, index) => (
          <CommandMode
            key={`${id}-${index}`}
            command={cmd}
            messageId={id}
            userInput={content}
            onCopy={onCopy}
            onExecute={onExecute}
          />
        ))}
      </div>
    </div>
  );
};

export default AgentMessage; 