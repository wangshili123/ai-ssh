/**
 * 文件编辑器过滤面板组件
 * 负责文件内容的过滤和预设管理
 */

import React, { useCallback, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { useEditorStore } from '../../store/FileEditorStore';
import './FileFilterPanel.less';

interface FilterPreset {
  id: string;
  name: string;
  pattern: string;
  isRegex: boolean;
  caseSensitive: boolean;
}

interface FileFilterPanelProps {
  onFilterChange: (filter: {
    pattern: string;
    isRegex: boolean;
    caseSensitive: boolean;
  }) => void;
}

export const FileFilterPanel: React.FC<FileFilterPanelProps> = observer((props) => {
  const { onFilterChange } = props;
  const editorStore = useEditorStore();

  // 过滤条件状态
  const [filterText, setFilterText] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  
  // 预设列表状态
  const [presets, setPresets] = useState<FilterPreset[]>([
    {
      id: '1',
      name: '错误日志',
      pattern: 'error|exception|fail',
      isRegex: true,
      caseSensitive: false
    },
    {
      id: '2',
      name: '警告日志',
      pattern: 'warning|warn',
      isRegex: true,
      caseSensitive: false
    }
  ]);
  
  // 预设管理状态
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isEditingPreset, setIsEditingPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  // 应用过滤条件
  const handleApplyFilter = useCallback(() => {
    if (!filterText.trim()) {
      return;
    }

    onFilterChange({
      pattern: filterText,
      isRegex,
      caseSensitive: isCaseSensitive
    });
  }, [filterText, isRegex, isCaseSensitive, onFilterChange]);

  // 清除过滤条件
  const handleClearFilter = useCallback(() => {
    setFilterText('');
    setIsRegex(false);
    setIsCaseSensitive(false);
    onFilterChange({
      pattern: '',
      isRegex: false,
      caseSensitive: false
    });
  }, [onFilterChange]);

  // 选择预设
  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setFilterText(preset.pattern);
      setIsRegex(preset.isRegex);
      setIsCaseSensitive(preset.caseSensitive);
      setSelectedPreset(presetId);
    }
  }, [presets]);

  // 保存当前过滤条件为预设
  const handleSaveAsPreset = useCallback(() => {
    if (!filterText.trim() || !newPresetName.trim()) {
      return;
    }

    const newPreset: FilterPreset = {
      id: Date.now().toString(),
      name: newPresetName,
      pattern: filterText,
      isRegex,
      caseSensitive: isCaseSensitive
    };

    setPresets(prev => [...prev, newPreset]);
    setNewPresetName('');
    setIsEditingPreset(false);
  }, [filterText, isRegex, isCaseSensitive, newPresetName]);

  // 删除预设
  const handleDeletePreset = useCallback((presetId: string) => {
    setPresets(prev => prev.filter(p => p.id !== presetId));
    if (selectedPreset === presetId) {
      setSelectedPreset('');
    }
  }, [selectedPreset]);

  // 监听过滤条件变化
  useEffect(() => {
    if (filterText.trim()) {
      handleApplyFilter();
    }
  }, [filterText, isRegex, isCaseSensitive]);

  return (
    <div className="file-filter-panel">
      {/* 过滤条件输入区域 */}
      <div className="filter-input-area">
        <input
          type="text"
          className="filter-input"
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="输入过滤文本..."
        />
        <label className="filter-option">
          <input
            type="checkbox"
            checked={isRegex}
            onChange={e => setIsRegex(e.target.checked)}
          />
          <span>正则表达式</span>
        </label>
        <label className="filter-option">
          <input
            type="checkbox"
            checked={isCaseSensitive}
            onChange={e => setIsCaseSensitive(e.target.checked)}
          />
          <span>区分大小写</span>
        </label>
        <button
          className="apply-button"
          onClick={handleApplyFilter}
          disabled={!filterText.trim()}
        >
          应用过滤
        </button>
        <button
          className="clear-button"
          onClick={handleClearFilter}
          disabled={!filterText.trim()}
        >
          清除
        </button>
      </div>

      {/* 预设管理区域 */}
      <div className="preset-area">
        <div className="preset-header">
          <span>预设过滤条件</span>
          <button
            className="add-preset-button"
            onClick={() => setIsEditingPreset(true)}
          >
            新建预设
          </button>
        </div>

        {/* 预设列表 */}
        <div className="preset-list">
          {presets.map(preset => (
            <div
              key={preset.id}
              className={`preset-item ${selectedPreset === preset.id ? 'selected' : ''}`}
            >
              <span
                className="preset-name"
                onClick={() => handlePresetSelect(preset.id)}
              >
                {preset.name}
              </span>
              <button
                className="delete-preset-button"
                onClick={() => handleDeletePreset(preset.id)}
                title="删除预设"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* 新建预设表单 */}
        {isEditingPreset && (
          <div className="new-preset-form">
            <input
              type="text"
              className="preset-name-input"
              value={newPresetName}
              onChange={e => setNewPresetName(e.target.value)}
              placeholder="预设名称..."
            />
            <button
              className="save-preset-button"
              onClick={handleSaveAsPreset}
              disabled={!newPresetName.trim() || !filterText.trim()}
            >
              保存
            </button>
            <button
              className="cancel-preset-button"
              onClick={() => {
                setIsEditingPreset(false);
                setNewPresetName('');
              }}
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* 过滤统计信息 */}
      {editorStore.filterActive && (
        <div className="filter-stats">
          <span>
            匹配行数: {editorStore.filterStats.matchedLines} / {editorStore.filterStats.totalLines}
          </span>
          <span>
            已处理: {Math.round(editorStore.filterStats.processedSize / 1024 / 1024 * 100) / 100} MB
          </span>
        </div>
      )}
    </div>
  );
}); 