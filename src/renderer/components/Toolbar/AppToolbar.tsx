import React from 'react';
import { Button, Tooltip } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import './AppToolbar.css';

interface AppToolbarProps {
  onSessionListOpen: () => void;
}

const AppToolbar: React.FC<AppToolbarProps> = ({
  onSessionListOpen,
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
      </div>
    </div>
  );
};

export default AppToolbar; 