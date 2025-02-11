import React from 'react';
import { Button, Tooltip } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import AIToolbarButton from './AIToolbarButton';
import './AppToolbar.css';

interface AppToolbarProps {
  onSessionListOpen: () => void;
  isAICollapsed: boolean;
  onAICollapse: (collapsed: boolean) => void;
}

const AppToolbar: React.FC<AppToolbarProps> = ({
  onSessionListOpen,
  isAICollapsed,
  onAICollapse,
}) => {
  return (
    <div className="app-toolbar">
      <div className="toolbar-group left">
        <Tooltip title="会话管理">
          <Button
            type="text"
            icon={<FolderOutlined />}
            onClick={onSessionListOpen}
            className="toolbar-button"
          />
        </Tooltip>
        <AIToolbarButton 
          isVisible={!isAICollapsed}
          onClick={() => onAICollapse(!isAICollapsed)}
        />
      </div>
    </div>
  );
};

export default AppToolbar; 