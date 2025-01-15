import React from 'react';
import { Button, Alert } from 'antd';
import { CopyOutlined, SendOutlined, SyncOutlined } from '@ant-design/icons';
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
  const getRiskText = (risk: string) => {
    switch (risk) {
      case 'high':
        return '高风险';
      case 'medium':
        return '中等风险';
      case 'low':
        return '低风险';
      default:
        return '未知风险';
    }
  };

  const getRiskDescription = (risk: string) => {
    switch (risk) {
      case 'high':
        return '此命令可能会对系统造成不可逆的更改，请谨慎执行';
      case 'medium':
        return '此命令可能会修改系统配置，请确认后执行';
      default:
        return '';
    }
  };

  return (
    <div className="command-suggestion">
      {(command.risk === 'medium' || command.risk === 'high') && (
        <Alert
          message={`${getRiskText(command.risk)}命令`}
          description={getRiskDescription(command.risk)}
          type={command.risk === 'high' ? 'error' : 'warning'}
          showIcon
          className="risk-alert"
        />
      )}
      <div className="command-content">
        <div className="command-text">
          <code>{command.command}</code>
          <div className="command-buttons">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => onCopy(command.command)}
            >
              复制
            </Button>
            <Button
              type="text"
              icon={<SendOutlined />}
              onClick={() => onExecute(command.command)}
              danger={command.risk === 'high'}
            >
              运行
            </Button>
            {onRegenerate && (
              <Button
                type="text"
                icon={<SyncOutlined />}
                onClick={() => onRegenerate(messageId, userInput)}
              >
                换一个
              </Button>
            )}
          </div>
        </div>
        {command.description && (
          <div className="command-description">
            {command.description}
          </div>
        )}
        {command.parameters && command.parameters.length > 0 && (
          <div className="command-parameters">
            <h4>参数说明：</h4>
            <ul>
              {command.parameters.map((param, index) => (
                <li key={index}>
                  <code>{param.name}</code>: {param.description}
                  {param.required && <span className="required">（必填）</span>}
                  {param.defaultValue && (
                    <span className="default-value">
                      （默认值：{param.defaultValue}）
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {command.example && (
          <div className="command-example">
            <h4>示例：</h4>
            <code>{command.example}</code>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandMode; 