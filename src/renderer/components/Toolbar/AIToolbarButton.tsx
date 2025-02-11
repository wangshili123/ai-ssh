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
      title={isVisible ? "关闭AI助手" : "打开AI助手"} 
      placement="bottom"
    >
      <Button
        type={isVisible ? "primary" : "text"}
        icon={<RobotOutlined />}
        onClick={onClick}
        className="ai-toolbar-button"
      >
        AI助手
      </Button>
    </Tooltip>
  );
};

export default AIToolbarButton; 