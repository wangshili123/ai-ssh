import React from 'react';
import { Button, Tooltip } from 'antd';
import { FolderOutlined, FolderOpenOutlined } from '@ant-design/icons';
import AIToolbarButton from './AIToolbarButton';
import './AppToolbar.css';

interface AppToolbarProps {
  onSessionListOpen: () => void;
  isAICollapsed: boolean;
  onAICollapse: (collapsed: boolean) => void;
  isFileBrowserVisible: boolean;
  onFileBrowserVisibleChange: (visible: boolean) => void;
}

const AppToolbar: React.FC<AppToolbarProps> = ({
  onSessionListOpen,
  isAICollapsed,
  onAICollapse,
  isFileBrowserVisible,
  onFileBrowserVisibleChange,
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
        <Tooltip title="文件浏览器">
          <Button
            type={isFileBrowserVisible ? "primary" : "text"}
            icon={<FolderOpenOutlined />}
            onClick={() => onFileBrowserVisibleChange(!isFileBrowserVisible)}
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