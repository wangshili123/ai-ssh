import React from 'react';
import { Message } from '../../../../types';
import CommandMessage from './CommandMessage';
import { sshService } from '../../../../services/ssh';

interface CommandModeProps {
  messages: Message[];
  onUpdateMessages: (messages: Message[]) => void;
  onRegenerate?: (messageId: string, userInput: string) => void;
}

const CommandMode: React.FC<CommandModeProps> = ({
  messages,
  onUpdateMessages,
  onRegenerate
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
        <CommandMessage
          key={message.id}
          {...message}
          onCopy={handleCopy}
          onExecute={handleExecute}
          onRegenerate={onRegenerate}
        />
      ))}
    </div>
  );
};

export default CommandMode; 