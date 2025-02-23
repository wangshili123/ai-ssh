/**
 * 文件编辑器过滤面板组件
 * 负责文件内容的过滤和预设管理
 */

import React, { useCallback, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { FilterManager } from '../../core/FilterManager';
import { useEditorStore } from '../../store/FileEditorStore';
import './FileFilterPanel.css';
import { Button, Input, Space, Switch, Tooltip, Progress } from 'antd';
import { FilterOutlined, CloseOutlined } from '@ant-design/icons';

export interface FileFilterPanelProps {
  filterManager: FilterManager | null;
  onClose: () => void;
}

export const FileFilterPanel: React.FC<FileFilterPanelProps> = observer(({
  filterManager,
  onClose
}) => {
  // 过滤状态
  const [filterText, setFilterText] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [filterStats, setFilterStats] = useState<{
    matchedLines: number;
    totalLines: number;
    processedSize: number;
  }>({
    matchedLines: 0,
    totalLines: 0,
    processedSize: 0
  });

  // 处理过滤文本变化
  const handleFilterTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilterText(value);

    if (value && filterManager) {
      applyFilter(value);
    } else if (filterManager) {
      filterManager.clearFilter();
    }
  }, [filterManager]);

  // 应用过滤
  const applyFilter = useCallback(async (text: string) => {
    if (!filterManager) return;

    try {
      setIsFiltering(true);
      setFilterError(null);

      await filterManager.applyFilter({
        pattern: text,
        isRegex,
        caseSensitive: isCaseSensitive
      });
    } catch (error) {
      setFilterError((error as Error).message);
    } finally {
      setIsFiltering(false);
    }
  }, [filterManager, isRegex, isCaseSensitive]);

  // 处理选项变化
  const handleOptionChange = useCallback((option: 'regex' | 'case') => {
    if (!filterManager) return;

    switch (option) {
      case 'regex':
        setIsRegex(!isRegex);
        break;
      case 'case':
        setIsCaseSensitive(!isCaseSensitive);
        break;
    }

    // 如果有过滤文本，重新应用过滤
    if (filterText) {
      applyFilter(filterText);
    }
  }, [filterManager, isRegex, isCaseSensitive, filterText, applyFilter]);

  // 监听过滤事件
  useEffect(() => {
    if (!filterManager) return;

    const handleFilterProgress = (stats: {
      processedSize: number;
      totalSize: number;
    }) => {
      setFilterStats(prevStats => ({
        ...prevStats,
        processedSize: stats.processedSize
      }));
    };

    const handleFilterCompleted = (stats: {
      matchedLines: number;
      totalLines: number;
    }) => {
      setFilterStats(prevStats => ({
        ...prevStats,
        matchedLines: stats.matchedLines,
        totalLines: stats.totalLines
      }));
      setIsFiltering(false);
    };

    const handleFilterError = (error: Error) => {
      setFilterError(error.message);
      setIsFiltering(false);
    };

    filterManager.on('filter-progress', handleFilterProgress);
    filterManager.on('filter-completed', handleFilterCompleted);
    filterManager.on('filter-error', handleFilterError);

    return () => {
      filterManager.off('filter-progress', handleFilterProgress);
      filterManager.off('filter-completed', handleFilterCompleted);
      filterManager.off('filter-error', handleFilterError);
    };
  }, [filterManager]);

  return (
    <div className="file-filter-panel">
      <div className="filter-header">
        <Space>
          <Input
            prefix={<FilterOutlined />}
            placeholder="过滤..."
            value={filterText}
            onChange={handleFilterTextChange}
            disabled={!filterManager}
          />
          <Tooltip title="使用正则表达式">
            <Button
              type={isRegex ? "primary" : "text"}
              icon={<span>.*</span>}
              onClick={() => handleOptionChange('regex')}
              disabled={!filterManager}
            />
          </Tooltip>
          <Tooltip title="区分大小写">
            <Button
              type={isCaseSensitive ? "primary" : "text"}
              icon={<span>Aa</span>}
              onClick={() => handleOptionChange('case')}
              disabled={!filterManager}
            />
          </Tooltip>
          <Button
            icon={<CloseOutlined />}
            onClick={onClose}
          />
        </Space>
      </div>

      {isFiltering && (
        <div className="filter-progress">
          <Progress
            percent={Math.round((filterStats.processedSize / filterStats.totalLines) * 100)}
            size="small"
            status="active"
          />
        </div>
      )}

      {filterStats.totalLines > 0 && (
        <div className="filter-stats">
          匹配 {filterStats.matchedLines} / {filterStats.totalLines} 行
        </div>
      )}

      {filterError && (
        <div className="filter-error">
          过滤错误: {filterError}
        </div>
      )}
    </div>
  );
}); 