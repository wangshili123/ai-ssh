import React from 'react';
import { Input } from 'antd';
import { agentModeService } from '@/renderer/services/modes/agent';
import { CommandSuggestion } from '@/renderer/services/ai';
import { Message } from '@/renderer/types';
import AgentMessage from './AgentMessage';

interface AgentModeProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onCopy: (text: string) => void;
  onExecute: (command: string) => void;
}

const AgentMode: React.FC<AgentModeProps> = ({
  messages,
  onSendMessage,
  onCopy,
  onExecute
}) => {
  return (
    <div className="agent-mode">
      {messages.map((msg) => (
        <AgentMessage
          key={msg.id}
          {...msg}
          onCopy={onCopy}
          onExecute={onExecute}
        />
      ))}
    </div>
  );
};

export default AgentMode; 