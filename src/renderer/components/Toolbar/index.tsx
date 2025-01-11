import React from 'react';
import { Space, Button, Tooltip } from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  ReloadOutlined,
  SettingOutlined,
  ImportOutlined,
  ExportOutlined
} from '@ant-design/icons';
import './index.css';

interface ToolbarProps {
  onNewSession?: () => void;
  onSave?: () => void;
  onReload?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onSettings?: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onNewSession,
  onSave,
  onReload,
  onImport,
  onExport,
  onSettings
}) => {
  return (
    <div className="toolbar">
      <Space>
        <Tooltip title="新建会话">
          <Button
            type="text"
            icon={<PlusOutlined />}
            onClick={onNewSession}
          >
            新建
          </Button>
        </Tooltip>
        
        <Tooltip title="保存配置">
          <Button
            type="text"
            icon={<SaveOutlined />}
            onClick={onSave}
          >
            保存
          </Button>
        </Tooltip>

        <Tooltip title="刷新">
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={onReload}
          >
            刷新
          </Button>
        </Tooltip>

        <Tooltip title="导入配置">
          <Button
            type="text"
            icon={<ImportOutlined />}
            onClick={onImport}
          >
            导入
          </Button>
        </Tooltip>

        <Tooltip title="导出配置">
          <Button
            type="text"
            icon={<ExportOutlined />}
            onClick={onExport}
          >
            导出
          </Button>
        </Tooltip>

        <Tooltip title="设置">
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={onSettings}
          >
            设置
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
};

export default Toolbar; 