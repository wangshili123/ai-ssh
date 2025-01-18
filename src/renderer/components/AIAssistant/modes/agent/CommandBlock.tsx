import React, { useState } from 'react';
import { Button, Tooltip } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { CommandRiskLevel } from '../../../../services/modes/agent/types';

interface CommandBlockProps {
  command: {
    text: string;
    description: string;
    risk: CommandRiskLevel;
    executed: boolean;
  };
  onHandleExecute: (command: string) => void;
  onHandlePause?: () => void;
}

export const CommandBlock: React.FC<CommandBlockProps> = ({
  command,
  onHandleExecute,
  onHandlePause
}) => {
  const [isExecuting, setIsExecuting] = useState(false);

  // 将 setIsExecuting 方法添加到 command 对象中
  (command as any).setIsExecuting = setIsExecuting;

  const handleExecute = () => {
    onHandleExecute(command.text);
  };

  const handlePause = () => {
    if (onHandlePause) {
      onHandlePause();
    }
  };

  return (
    <div className="command-block" data-command={command.text}>
      <div className="command-text">{command.text}</div>
      <div className="command-description">{command.description}</div>
      {!command.executed ? (
        <Tooltip title="执行命令">
          <Button
            type="link"
            icon={<PlayCircleOutlined />}
            onClick={handleExecute}
          />
        </Tooltip>
      ) : isExecuting ? (
        <Tooltip title="暂停执行">
          <Button
            type="link"
            icon={<PauseCircleOutlined />}
            onClick={handlePause}
          />
        </Tooltip>
      ) : null}
    </div>
  );
}; 