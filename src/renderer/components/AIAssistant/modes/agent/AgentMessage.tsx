import React from 'react';
import { Button } from 'antd';
import { CopyOutlined, UserOutlined, RobotOutlined, PauseCircleOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Message } from '../../../../types';
import { agentModeService } from '@/renderer/services/modes/agent';
import { terminalOutputService } from '@/renderer/services/terminalOutput';
import { v4 as uuidv4 } from 'uuid';
import CommandMode from '../../CommandMode';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface AgentMessageProps extends Message {
  onCopy: (text: string) => void;
  onExecute: (command: string) => void;
  onUpdateMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const AgentMessage: React.FC<AgentMessageProps> = ({
  id,
  type,
  content,
  timestamp,
  explanation,
  commands,
  onCopy,
  onExecute,
  onUpdateMessages
}) => {
  const isUser = type === 'user';
  const currentTask = agentModeService.getCurrentTask();

  // 处理命令执行
  const handleExecute = async (command: string) => {
    try {
      // 执行命令
      await onExecute(command);
      
      // 如果是自动执行模式，等待命令执行完成后自动处理结果
      if (currentTask?.autoExecute && !currentTask?.paused) {
        // 获取最新的终端输出
        const history = terminalOutputService.getHistory();
        const lastOutput = history[history.length - 1];
        if (lastOutput) {
          // 等待命令执行完成（通过检查输出中是否包含命令提示符）
          const checkOutput = async () => {
            const currentHistory = terminalOutputService.getHistory();
            const currentOutput = currentHistory[currentHistory.length - 1];
            
            if (currentOutput?.output && (currentOutput.output.includes('$ ') || currentOutput.output.includes('# '))) {
              // 命令执行完成，发送结果给 Agent 分析
              const result = await agentModeService.handleCommandExecuted(currentOutput.output || '');
              
              // 如果返回了新的响应，添加到消息列表
              if (result !== null) {
                onUpdateMessages(prev => [...prev, {
                  id: uuidv4(),
                  type: 'assistant',
                  content: typeof result === 'string' ? result : '',
                  commands: Array.isArray(result) ? result : undefined,
                  timestamp: Date.now()
                }]);
              }
            } else {
              // 继续等待
              setTimeout(checkOutput, 500);
            }
          };
          
          checkOutput();
        }
      }
    } catch (error) {
      console.error('执行命令失败:', error);
    }
  };

  // 切换自动执行状态
  const toggleAutoExecute = () => {
    agentModeService.toggleAutoExecute();
  };

  // 切换暂停状态
  const togglePause = () => {
    agentModeService.togglePause();
  };

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
        {!isUser && currentTask && (
          <>
            <Button
              type="text"
              icon={currentTask.autoExecute ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={toggleAutoExecute}
              className="auto-execute-button"
            />
            {currentTask.autoExecute && (
              <Button
                type="text"
                icon={currentTask.paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
                onClick={togglePause}
                className="pause-button"
              />
            )}
          </>
        )}
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
                            onExecute={handleExecute}
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
            onExecute={handleExecute}
          />
        ))}
      </div>
    </div>
  );
};

export default AgentMessage; 