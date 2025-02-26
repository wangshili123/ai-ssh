/**
 * 双模式编辑器过滤面板
 * 根据当前模式使用不同的过滤实现
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Checkbox, Tooltip, message, Select } from 'antd';
import { FilterOutlined, CloseOutlined, SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import { FilterAdapter } from './SearchFilterAdapter';
import { EditorMode } from '../../types/FileEditorTypes';
import { FileEditorManager } from '../../core/FileEditorManager';
import './DualModeFilterPanelStyles.css';

const { Option } = Select;

interface FilterPreset {
  id: string;
  name: string;
  pattern: string;
  isRegex: boolean;
  isCaseSensitive: boolean;
}

interface DualModeFilterPanelProps {
  editorManager: FileEditorManager;
  filterAdapter: FilterAdapter;
  onClose: () => void;
}

export const DualModeFilterPanel: React.FC<DualModeFilterPanelProps> = ({
  editorManager,
  filterAdapter,
  onClose
}) => {
  // 过滤状态
  const [filterText, setFilterText] = useState<string>('');
  const [isRegex, setIsRegex] = useState<boolean>(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState<boolean>(false);
  const [isFiltering, setIsFiltering] = useState<boolean>(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [filterStats, setFilterStats] = useState<{ shown: number; total: number }>({ shown: 0, total: 0 });
  const [currentMode, setCurrentMode] = useState<EditorMode>(editorManager.getCurrentMode());
  
  // 预设管理
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
  const [presetName, setPresetName] = useState<string>('');
  const [isSavingPreset, setIsSavingPreset] = useState<boolean>(false);

  // 监听模式切换
  useEffect(() => {
    const handleModeChange = (data: any) => {
      setCurrentMode(data.mode);
    };

    editorManager.on('mode-switching-completed', handleModeChange);

    return () => {
      editorManager.off('mode-switching-completed', handleModeChange);
    };
  }, [editorManager]);

  // 加载预设
  useEffect(() => {
    // 从本地存储加载预设
    const savedPresets = localStorage.getItem('filter-presets');
    if (savedPresets) {
      try {
        setPresets(JSON.parse(savedPresets));
      } catch (e) {
        console.error('Failed to load filter presets:', e);
      }
    }
  }, []);

  // 监听过滤事件
  useEffect(() => {
    const handleFilterStart = () => {
      setIsFiltering(true);
      setFilterError(null);
    };

    const handleFilterComplete = (data: any) => {
      setIsFiltering(false);
      setFilterStats({
        shown: data.matchedLines || 0,
        total: data.totalLines || 0
      });

      if (data.matchedLines === 0) {
        message.info('未找到匹配项');
      }
    };

    const handleFilterError = (error: Error) => {
      setIsFiltering(false);
      setFilterError(error.message);
      message.error(`过滤错误: ${error.message}`);
    };

    // 根据当前模式监听不同的事件
    if (currentMode === EditorMode.EDIT) {
      filterAdapter.on('filter-start', handleFilterStart);
      filterAdapter.on('filter-complete', handleFilterComplete);
      filterAdapter.on('filter-error', handleFilterError);
    } else {
      editorManager.on('filter-start', handleFilterStart);
      editorManager.on('filter-complete', handleFilterComplete);
      editorManager.on('filter-error', handleFilterError);
    }

    return () => {
      if (currentMode === EditorMode.EDIT) {
        filterAdapter.off('filter-start', handleFilterStart);
        filterAdapter.off('filter-complete', handleFilterComplete);
        filterAdapter.off('filter-error', handleFilterError);
      } else {
        editorManager.off('filter-start', handleFilterStart);
        editorManager.off('filter-complete', handleFilterComplete);
        editorManager.off('filter-error', handleFilterError);
      }
    };
  }, [filterAdapter, editorManager, currentMode]);

  // 执行过滤
  const handleFilter = useCallback(() => {
    if (!filterText) {
      // 如果过滤文本为空，则清除过滤
      filterAdapter.clearFilter();
      return;
    }

    filterAdapter.filter({
      text: filterText,
      isRegex,
      isCaseSensitive
    });
  }, [filterAdapter, filterText, isRegex, isCaseSensitive]);

  // 清除过滤
  const handleClear = useCallback(() => {
    setFilterText('');
    filterAdapter.clearFilter();
  }, [filterAdapter]);

  // 保存预设
  const handleSavePreset = useCallback(() => {
    if (!filterText || !presetName) {
      message.warning('请输入过滤文本和预设名称');
      return;
    }

    setIsSavingPreset(true);

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: presetName,
      pattern: filterText,
      isRegex,
      isCaseSensitive
    };

    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    
    // 保存到本地存储
    try {
      localStorage.setItem('filter-presets', JSON.stringify(updatedPresets));
      message.success('预设保存成功');
      setPresetName('');
    } catch (e) {
      message.error('保存预设失败');
      console.error('Failed to save filter preset:', e);
    }

    setIsSavingPreset(false);
  }, [filterText, presetName, isRegex, isCaseSensitive, presets]);

  // 删除预设
  const handleDeletePreset = useCallback((id: string) => {
    const updatedPresets = presets.filter(preset => preset.id !== id);
    setPresets(updatedPresets);
    
    // 更新本地存储
    try {
      localStorage.setItem('filter-presets', JSON.stringify(updatedPresets));
      message.success('预设删除成功');
      
      if (selectedPresetId === id) {
        setSelectedPresetId(null);
      }
    } catch (e) {
      message.error('删除预设失败');
      console.error('Failed to delete filter preset:', e);
    }
  }, [presets, selectedPresetId]);

  // 加载预设
  const handleLoadPreset = useCallback((id: string) => {
    const preset = presets.find(p => p.id === id);
    if (preset) {
      setFilterText(preset.pattern);
      setIsRegex(preset.isRegex);
      setIsCaseSensitive(preset.isCaseSensitive);
      setSelectedPresetId(id);
    }
  }, [presets]);

  // 按Enter键执行过滤
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleFilter();
    }
  };

  return (
    <div className="dual-mode-filter-panel">
      <div className="filter-header">
        <h3>过滤</h3>
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          className="close-button"
        />
      </div>

      <div className="filter-input-container">
        <Input
          placeholder="输入过滤内容..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          onKeyDown={handleKeyDown}
          prefix={<FilterOutlined />}
          disabled={isFiltering}
        />
        <Button
          type="primary"
          onClick={handleFilter}
          loading={isFiltering}
        >
          过滤
        </Button>
        <Button onClick={handleClear}>清除</Button>
      </div>

      <div className="filter-options">
        <Checkbox
          checked={isRegex}
          onChange={(e) => setIsRegex(e.target.checked)}
          disabled={isFiltering}
        >
          正则表达式
        </Checkbox>
        <Checkbox
          checked={isCaseSensitive}
          onChange={(e) => setIsCaseSensitive(e.target.checked)}
          disabled={isFiltering}
        >
          区分大小写
        </Checkbox>
      </div>

      {filterStats.shown > 0 && (
        <div className="filter-stats">
          显示 {filterStats.shown} / {filterStats.total} 行
        </div>
      )}

      {filterError && (
        <div className="filter-error">
          错误: {filterError}
        </div>
      )}

      <div className="filter-presets">
        <h4>预设管理</h4>
        
        <div className="preset-selector">
          <Select
            placeholder="选择预设"
            style={{ width: '100%' }}
            value={selectedPresetId}
            onChange={handleLoadPreset}
            allowClear
          >
            {presets.map(preset => (
              <Option key={preset.id} value={preset.id}>
                <div className="preset-option">
                  <span>{preset.name}</span>
                  <Tooltip title="删除预设">
                    <DeleteOutlined 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePreset(preset.id);
                      }} 
                    />
                  </Tooltip>
                </div>
              </Option>
            ))}
          </Select>
        </div>

        <div className="save-preset">
          <Input
            placeholder="预设名称"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            disabled={isFiltering || isSavingPreset}
          />
          <Button
            icon={<SaveOutlined />}
            onClick={handleSavePreset}
            disabled={!filterText || !presetName || isFiltering}
            loading={isSavingPreset}
          >
            保存预设
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DualModeFilterPanel; 