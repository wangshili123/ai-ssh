import React from 'react';
import { Button, Tooltip } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import './AIToolbarButton.css';

interface AIToolbarButtonProps {
  isVisible: boolean;
  onClick: () => void;
}

const AIToolbarButton: React.FC<AIToolbarButtonProps> = ({
  isVisible,
  onClick
}) => {
  return (
    <Tooltip 
      title={isVisible ? "关闭AI助手" : "启用AI助手"} 
      placement="bottom"
    >
      <Button
        type="text"
        icon={<RobotOutlined />}
        onClick={onClick}
        className={`ai-toolbar-button ${isVisible ? 'active' : ''}`}
      />
    </Tooltip>
  );
};

export default AIToolbarButton; 