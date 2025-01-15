import React from 'react';
import { Message } from '../../../../types';
import AgentMessage from './AgentMessage';
import { sshService } from '../../../../services/ssh';

interface AgentModeProps {
  messages: Message[];
  onUpdateMessages: (messages: Message[]) => void;
}

const AgentMode: React.FC<AgentModeProps> = ({
  messages,
  onUpdateMessages
}) => {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleExecute = async (command: string) => {
    try {
      await sshService.executeCommand(command);
    } catch (error) {
      console.error('执行命令失败:', error);
    }
  };

  return (
    <div className="messages-container">
      {messages.map(message => (
        <AgentMessage
          key={message.id}
          {...message}
          onCopy={handleCopy}
          onExecute={handleExecute}
        />
      ))}
    </div>
  );
};

export default AgentMode; 