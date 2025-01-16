import React from 'react';
import AgentMessage from './AgentMessage';
import { Message } from '../../../../types';

interface AgentModeProps {
  messages: Message[];
  onCopy: (text: string) => void;
  onExecute: (command: string) => void;
  onUpdateMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

const AgentMode: React.FC<AgentModeProps> = ({
  messages,
  onCopy,
  onExecute,
  onUpdateMessages
}) => {
  return (
    <div className="agent-mode">
      {messages.map((message) => (
        <AgentMessage
          key={message.id}
          id={message.id}
          type={message.type}
          content={message.content}
          timestamp={message.timestamp}
          explanation={message.explanation}
          commands={message.commands}
          onCopy={onCopy}
          onExecute={onExecute}
          onUpdateMessages={onUpdateMessages}
        />
      ))}
    </div>
  );
};

export default AgentMode; 