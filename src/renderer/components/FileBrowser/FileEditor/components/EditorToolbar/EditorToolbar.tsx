/**
 * 编辑器工具栏组件
 * 提供编辑器的各种操作按钮和功能
 */

import React, { FC, useState } from 'react';
import { Space, Button, Tooltip, Switch, Divider } from 'antd';
import { 
  SaveOutlined, 
  SearchOutlined, 
  FilterOutlined, 
  EyeOutlined, 
  EditOutlined, 
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { EditorMode } from '../../types/FileEditorTypes';
import EncodingSelector from '../EncodingSelector/EncodingSelector';
import './EditorToolbarStyles.css';

export interface EditorToolbarProps {
  currentMode: EditorMode;
  onModeSwitch: (mode: EditorMode) => void;
  onSave: () => void;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  onFilter: (filter: string) => void;
  onEncodingChange?: (encoding: string) => void;
  onRealtimeToggle?: (enabled: boolean) => void;
  onAutoScrollToggle?: (enabled: boolean) => void;
  isDirty?: boolean;
  encoding?: string;
  isReadOnly?: boolean;
  showEncodingSelector?: boolean;
  showRealtimeToggle?: boolean;
  showAutoScrollToggle?: boolean;
}

const EditorToolbar: FC<EditorToolbarProps> = ({
  currentMode,
  onModeSwitch,
  onSave,
  onRefresh,
  onSearch,
  onFilter,
  onEncodingChange,
  onRealtimeToggle,
  onAutoScrollToggle,
  isDirty = false,
  encoding = 'UTF-8',
  isReadOnly = false,
  showEncodingSelector = true,
  showRealtimeToggle = false,
  showAutoScrollToggle = false
}) => {
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(false);

  const handleRealtimeToggle = (checked: boolean) => {
    setRealtimeEnabled(checked);
    if (onRealtimeToggle) {
      onRealtimeToggle(checked);
    }
  };

  const handleAutoScrollToggle = (checked: boolean) => {
    setAutoScrollEnabled(checked);
    if (onAutoScrollToggle) {
      onAutoScrollToggle(checked);
    }
  };

  const handleEncodingChange = (value: string) => {
    if (onEncodingChange) {
      onEncodingChange(value);
    }
  };

  return (
    <div className="editor-toolbar">
      <div className="editor-toolbar-left">
        <Space>
          <Tooltip title="保存">
            <Button 
              icon={<SaveOutlined />} 
              onClick={onSave}
              disabled={isReadOnly || !isDirty}
              type={isDirty ? "primary" : "default"}
            />
          </Tooltip>
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} onClick={onRefresh} />
          </Tooltip>
          <Divider type="vertical" />
          <Tooltip title="搜索">
            <Button icon={<SearchOutlined />} onClick={() => onSearch('')} />
          </Tooltip>
          <Tooltip title="过滤">
            <Button icon={<FilterOutlined />} onClick={() => onFilter('')} />
          </Tooltip>
        </Space>
      </div>

      <div className="editor-toolbar-middle">
        {showEncodingSelector && (
          <EncodingSelector
            value={encoding}
            onChange={handleEncodingChange}
            disabled={isReadOnly}
            width={150}
          />
        )}
      </div>

      <div className="editor-toolbar-right">
        <Space>
          {showRealtimeToggle && (
            <Tooltip title="实时更新">
              <Switch 
                size="small" 
                checked={realtimeEnabled}
                onChange={handleRealtimeToggle}
                disabled={isReadOnly}
              />
            </Tooltip>
          )}
          
          {showAutoScrollToggle && (
            <Tooltip title="自动滚动">
              <Switch 
                size="small" 
                checked={autoScrollEnabled}
                onChange={handleAutoScrollToggle}
              />
            </Tooltip>
          )}
          
          <Divider type="vertical" />
          
          <Tooltip title="浏览模式">
            <Button 
              icon={<EyeOutlined />} 
              onClick={() => onModeSwitch(EditorMode.BROWSE)}
              type={currentMode === EditorMode.BROWSE ? "primary" : "default"}
            />
          </Tooltip>
          <Tooltip title="编辑模式">
            <Button 
              icon={<EditOutlined />} 
              onClick={() => onModeSwitch(EditorMode.EDIT)}
              type={currentMode === EditorMode.EDIT ? "primary" : "default"}
              disabled={isReadOnly}
            />
          </Tooltip>
        </Space>
      </div>
    </div>
  );
};

export default EditorToolbar; 