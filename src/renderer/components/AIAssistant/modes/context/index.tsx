import React from 'react';
import { Message } from '../../../../types';
import ContextMessage from './ContextMessage';
import { sshService } from '../../../../services/ssh';
import { contextModeService } from '../../../../services/modes/context';
import { terminalOutputService } from '../../../../services/terminalOutput';

interface ContextModeProps {
  messages: Message[];
  onUpdateMessages: (messages: Message[]) => void;
}

const ContextMode: React.FC<ContextModeProps> = ({
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
        <ContextMessage
          key={message.id}
          {...message}
          onCopy={handleCopy}
          onExecute={handleExecute}
        />
      ))}
    </div>
  );
};

export default ContextMode; 