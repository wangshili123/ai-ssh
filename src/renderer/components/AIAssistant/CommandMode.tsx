import React from 'react';
import { Button, Space, Tag, Alert } from 'antd';
import { CopyOutlined, CodeOutlined, SyncOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { CommandSuggestion } from '../../services/ai';

interface CommandModeProps {
  command: CommandSuggestion;
  messageId: string;
  userInput: string;
  onCopy: (text: string) => void;
  onExecute: (command: string) => void;
  onRegenerate?: (messageId: string, userInput: string) => void;
}

const CommandMode: React.FC<CommandModeProps> = ({
  command,
  messageId,
  userInput,
  onCopy,
  onExecute,
  onRegenerate
}) => {
  if (!command.command) return null;

  const riskColors = {
    low: 'success',
    medium: 'warning',
    high: 'error'
  };

  return (
    <div className="command-suggestion">
      <Space direction="vertical" style={{ width: '100%' }}>
        <div className="command-header">
          <div className="command-line">
            <CodeOutlined />
            <span className="command-text">{command.command}</span>
            <Tag color={riskColors[command.risk]}>
              {command.risk === 'low' ? '安全' : command.risk === 'medium' ? '警告' : '危险'}
            </Tag>
          </div>
          <div className="command-actions">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => onCopy(command.command)}
              className="copy-button"
            />
            {onRegenerate && (
              <Button
                type="text"
                icon={<SyncOutlined />}
                onClick={() => onRegenerate(messageId, userInput)}
                title="生成新的命令建议"
              >
                换一个
              </Button>
            )}
            <Button
              type="primary"
              size="small"
              onClick={() => onExecute(command.command)}
            >
              运行
            </Button>
          </div>
        </div>
        {command.example && (
          <div className="command-example">
            示例：<code>{command.example}</code>
          </div>
        )}
        {command.parameters && command.parameters.length > 0 && (
          <div className="command-parameters">
            <div className="parameters-title">参数说明：</div>
            {command.parameters.map((param, index) => (
              <div key={index} className="parameter-item">
                <Tag color={param.required ? 'blue' : 'default'}>
                  {param.name}
                </Tag>
                <span>{param.description}</span>
              </div>
            ))}
          </div>
        )}
        <div className="command-description">
          {command.description}
        </div>
        {command.risk !== 'low' && (
          <Alert
            message="安全提示"
            description={command.description}
            type={command.risk === 'medium' ? 'warning' : 'error'}
            showIcon
            icon={<ExclamationCircleOutlined />}
          />
        )}
      </Space>
    </div>
  );
};

export default CommandMode; 