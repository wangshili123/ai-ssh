/**
 * 文件编辑器工具栏组件
 * 包含保存、刷新、实时模式、搜索和设置等功能
 */

import React, { useCallback } from 'react';
import { observer } from 'mobx-react';
import { useEditorStore } from '../../store/FileEditorStore';
import './FileEditorToolbar.less';

interface FileEditorToolbarProps {
  onSave?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onSearch?: () => void;
  onSettings?: () => void;
}

export const FileEditorToolbar: React.FC<FileEditorToolbarProps> = observer((props) => {
  const {
    onSave,
    onRefresh,
    onSearch,
    onSettings
  } = props;

  const editorStore = useEditorStore();
  const {
    isRealtime,
    isAutoScroll,
    toggleRealtime,
    toggleAutoScroll,
    isSaving,
    isRefreshing
  } = editorStore;

  // 处理保存
  const handleSave = useCallback(async () => {
    if (onSave && !isSaving) {
      await onSave();
    }
  }, [onSave, isSaving]);

  // 处理刷新
  const handleRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      await onRefresh();
    }
  }, [onRefresh, isRefreshing]);

  // 处理实时模式切换
  const handleRealtimeToggle = useCallback(() => {
    toggleRealtime();
  }, [toggleRealtime]);

  // 处理自动滚动切换
  const handleAutoScrollToggle = useCallback(() => {
    toggleAutoScroll();
  }, [toggleAutoScroll]);

  // 处理搜索
  const handleSearch = useCallback(() => {
    if (onSearch) {
      onSearch();
    }
  }, [onSearch]);

  // 处理设置
  const handleSettings = useCallback(() => {
    if (onSettings) {
      onSettings();
    }
  }, [onSettings]);

  return (
    <div className="file-editor-toolbar">
      {/* 保存按钮 */}
      <button
        className={`toolbar-button ${isSaving ? 'loading' : ''}`}
        onClick={handleSave}
        disabled={isSaving}
        title="保存文件 (Ctrl+S)"
      >
        <span className="icon">💾</span>
        <span className="text">保存</span>
      </button>

      {/* 刷新按钮 */}
      <button
        className={`toolbar-button ${isRefreshing ? 'loading' : ''}`}
        onClick={handleRefresh}
        disabled={isRefreshing}
        title="刷新文件"
      >
        <span className="icon">🔄</span>
        <span className="text">刷新</span>
      </button>

      {/* 实时模式开关 */}
      <div className="toolbar-toggle">
        <button
          className={`toggle-button ${isRealtime ? 'active' : ''}`}
          onClick={handleRealtimeToggle}
          title="实时模式"
        >
          <span className="icon">📡</span>
          <span className="text">实时模式</span>
          <span className={`status ${isRealtime ? 'on' : 'off'}`} />
        </button>
        {isRealtime && (
          <label className="auto-scroll-label">
            <input
              type="checkbox"
              checked={isAutoScroll}
              onChange={handleAutoScrollToggle}
            />
            <span>自动滚动</span>
          </label>
        )}
      </div>

      {/* 搜索按钮 */}
      <button
        className="toolbar-button"
        onClick={handleSearch}
        title="搜索 (Ctrl+F)"
      >
        <span className="icon">🔍</span>
        <span className="text">搜索</span>
      </button>

      {/* 设置按钮 */}
      <button
        className="toolbar-button"
        onClick={handleSettings}
        title="设置"
      >
        <span className="icon">⚙️</span>
        <span className="text">设置</span>
      </button>
    </div>
  );
}); 