import React from 'react';
import { Space, Button, Tooltip } from 'antd';
import { FolderOutlined, FolderOpenOutlined, SwapOutlined, SettingOutlined } from '@ant-design/icons';
import AIToolbarButton from './AIToolbarButton';
import './AppToolbar.css';

interface AppToolbarProps {
  onSessionListOpen: () => void;
  isAICollapsed: boolean;
  onAICollapse: (collapsed: boolean) => void;
  isFileBrowserVisible: boolean;
  onFileBrowserVisibleChange: (visible: boolean) => void;
  onTransferManagerOpen?: () => void;
  onBaseConfigOpen?: () => void;
}

const AppToolbar: React.FC<AppToolbarProps> = ({
  onSessionListOpen,
  isAICollapsed,
  onAICollapse,
  isFileBrowserVisible,
  onFileBrowserVisibleChange,
  onTransferManagerOpen,
  onBaseConfigOpen,
}) => {
  return (
    <div className="toolbar">
      <Space direction="vertical">
        <Tooltip title="会话管理" placement="right">
          <Button
            type="text"
            icon={<FolderOutlined />}
            onClick={onSessionListOpen}
            className="toolbar-button"
          />
        </Tooltip>
        <Tooltip title="启用文件浏览器" placement="right">
          <Button
            type="text"
            icon={<FolderOpenOutlined />}
            onClick={() => onFileBrowserVisibleChange(!isFileBrowserVisible)}
            className={`toolbar-button ${isFileBrowserVisible ? 'active' : ''}`}
          />
        </Tooltip>
        <Tooltip title="传输管理器" placement="right">
          <Button
            type="text"
            icon={<SwapOutlined />}
            onClick={onTransferManagerOpen}
            className="toolbar-button"
          />
        </Tooltip>

        <AIToolbarButton
          isVisible={!isAICollapsed}
          onClick={() => onAICollapse(!isAICollapsed)}
        />
         <Tooltip title="基础配置" placement="right">
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={onBaseConfigOpen}
            className="toolbar-button"
          />
        </Tooltip>
      </Space>
    </div>
  );
};

export default AppToolbar; 