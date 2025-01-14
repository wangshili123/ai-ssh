import React from 'react';
import { Button, Space } from 'antd';
import { CopyOutlined, CodeOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ContextModeProps {
  content: string;
  onCopy: (text: string) => void;
  onExecute: (command: string) => void;
}

const ContextMode: React.FC<ContextModeProps> = ({
  content,
  onCopy,
  onExecute
}) => {
  return (
    <ReactMarkdown
      components={{
        code({ className, children }) {
          const match = /language-(\w+)/.exec(className || '');
          const isCommand = match && match[1] === 'command';

          if (isCommand && typeof children === 'string') {
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
                          onClick={() => onCopy(cmd)}
                          className="copy-button"
                          size="small"
                        />
                        <Button
                          type="primary"
                          size="small"
                          onClick={() => onExecute(cmd)}
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
      {content}
    </ReactMarkdown>
  );
};

export default ContextMode; 