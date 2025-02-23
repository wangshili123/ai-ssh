/**
 * 文件编辑器工具栏组件
 * 包含保存、刷新、实时模式、搜索和设置等功能
 */

import React, { useCallback } from 'react';
import { observer } from 'mobx-react';
import { useEditorStore } from '../../store/FileEditorStore';
import './FileEditorToolbar.css';
import { Button, Select, Space, Switch, Tooltip } from 'antd';
import {
  CloudOutlined,
  DisconnectOutlined,
  EyeOutlined,
  SaveOutlined,
  SearchOutlined,
  FilterOutlined,
  VerticalAlignBottomOutlined
} from '@ant-design/icons';

interface FileEditorToolbarProps {
  onSave: () => void;
  onReconnect: () => void;
  onSearch: () => void;
  onFilter: () => void;
}

export const FileEditorToolbar: React.FC<FileEditorToolbarProps> = observer(({
  onSave,
  onReconnect,
  onSearch,
  onFilter
}) => {
  const editorStore = useEditorStore();

  return (
    <div className="editor-toolbar">
      <Space>
        {/* 编码选择 */}
        <Select
          value={editorStore.encoding}
          onChange={encoding => editorStore.setEncoding(encoding)}
          style={{ width: 120 }}
        >
          <Select.Option value="UTF-8">UTF-8</Select.Option>
          <Select.Option value="GBK">GBK</Select.Option>
          <Select.Option value="GB2312">GB2312</Select.Option>
          <Select.Option value="UTF-16">UTF-16</Select.Option>
        </Select>

        {/* 连接状态 */}
        <Tooltip title={editorStore.isConnected ? '已连接' : '未连接'}>
          {editorStore.isConnected ? (
            <CloudOutlined className="status-icon connected" />
          ) : (
            <Button
              type="text"
              icon={<DisconnectOutlined className="status-icon disconnected" />}
              onClick={onReconnect}
            />
          )}
        </Tooltip>

        {/* 保存按钮 */}
        {editorStore.isDirty && (
          <Tooltip title="保存">
            <Button
              type="text"
              icon={<SaveOutlined />}
              loading={editorStore.isSaving}
              onClick={onSave}
            />
          </Tooltip>
        )}

        {/* 搜索按钮 */}
        <Tooltip title="搜索">
          <Button
            type="text"
            icon={<SearchOutlined />}
            onClick={onSearch}
          />
        </Tooltip>

        {/* 过滤按钮 */}
        <Tooltip title="过滤">
          <Button
            type={editorStore.filterActive ? "primary" : "text"}
            icon={<FilterOutlined />}
            onClick={onFilter}
          />
        </Tooltip>

        {/* 实时监控开关 */}
        <Tooltip title="实时监控">
          <Switch
            checkedChildren={<EyeOutlined />}
            unCheckedChildren={<EyeOutlined />}
            checked={editorStore.isRealtime}
            onChange={editorStore.toggleRealtime}
          />
        </Tooltip>

        {/* 自动滚动开关 */}
        <Tooltip title="自动滚动到底部">
          <Switch
            checkedChildren={<VerticalAlignBottomOutlined />}
            unCheckedChildren={<VerticalAlignBottomOutlined />}
            checked={editorStore.isAutoScroll}
            onChange={editorStore.toggleAutoScroll}
            disabled={!editorStore.isRealtime}
          />
        </Tooltip>
      </Space>
    </div>
  );
}); 