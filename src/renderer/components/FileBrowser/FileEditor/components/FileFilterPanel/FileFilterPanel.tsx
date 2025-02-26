/**
 * 文件编辑器过滤面板组件
 * 负责文件内容的过滤和预设管理
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Input, Space, Button, Tooltip, Progress } from 'antd';
import { FilterOutlined, CloseOutlined } from '@ant-design/icons';
import { FilterManager } from '../../core/FilterManager';
import './FileFilterPanel.css';

interface FileFilterPanelProps {
  filterManager: FilterManager;
  onClose: () => void;
}

export const FileFilterPanel: React.FC<FileFilterPanelProps> = ({
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
    totalLines: number;
    matchedLines: number;
  }>({
    totalLines: 0,
    matchedLines: 0
  });

  // 监听过滤事件
  useEffect(() => {
    const handleFilterStarted = () => {
      console.log('[FileFilterPanel] 开始过滤');
      setIsFiltering(true);
    };

    const handleFilterComplete = (stats: { totalLines: number; matchedLines: number }) => {
      console.log('[FileFilterPanel] 过滤完成:', stats);
      setFilterStats(stats);
      setIsFiltering(false);
      setFilterError(null);
    };

    const handleFilterError = (error: Error) => {
      console.error('[FileFilterPanel] 过滤错误:', error);
      setFilterError(error.message);
      setIsFiltering(false);
    };

    filterManager.on('filterStarted', handleFilterStarted);
    filterManager.on('filterComplete', handleFilterComplete);
    filterManager.on('filterError', handleFilterError);

    return () => {
      filterManager.off('filterStarted', handleFilterStarted);
      filterManager.off('filterComplete', handleFilterComplete);
      filterManager.off('filterError', handleFilterError);
    };
  }, [filterManager]);

  // 处理过滤文本变化
  const handleFilterTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilterText(value);
    setFilterError(null);
  }, []);

  // 处理过滤
  const handleFilter = useCallback(() => {
    if (!filterText) return;

    console.log('[FileFilterPanel] 开始过滤:', {
      filterText,
      isRegex,
      isCaseSensitive
    });

    try {
      filterManager.filter({
        text: filterText,
        isRegex,
        isCaseSensitive
      });
    } catch (error) {
      console.error('[FileFilterPanel] 过滤出错:', error);
      setFilterError((error as Error).message);
    }
  }, [filterText, isRegex, isCaseSensitive, filterManager]);

  // 处理清除过滤
  const handleClear = useCallback(() => {
    setFilterText('');
    setFilterError(null);
    setFilterStats({
      totalLines: 0,
      matchedLines: 0
    });
    filterManager.clearFilter();
  }, [filterManager]);

  // 处理选项变化
  const handleOptionChange = useCallback((option: 'regex' | 'case') => {
    switch (option) {
      case 'regex':
        setIsRegex(!isRegex);
        break;
      case 'case':
        setIsCaseSensitive(!isCaseSensitive);
        break;
    }
  }, [isRegex, isCaseSensitive]);

  return (
    <div className="file-filter-panel">
      <div className="filter-header">
        <Space>
          <Input
            prefix={<FilterOutlined />}
            placeholder="过滤..."
            value={filterText}
            onChange={handleFilterTextChange}
            onPressEnter={handleFilter}
            disabled={isFiltering}
          />
          <Tooltip title="使用正则表达式">
            <Button
              type={isRegex ? "primary" : "text"}
              icon={<span>.*</span>}
              onClick={() => handleOptionChange('regex')}
              disabled={isFiltering}
            />
          </Tooltip>
          <Tooltip title="区分大小写">
            <Button
              type={isCaseSensitive ? "primary" : "text"}
              icon={<span>Aa</span>}
              onClick={() => handleOptionChange('case')}
              disabled={isFiltering}
            />
          </Tooltip>
          <Button
            type="primary"
            onClick={handleFilter}
            disabled={!filterText || isFiltering}
            loading={isFiltering}
          >
            应用过滤
          </Button>
          <Button
            onClick={handleClear}
            disabled={!filterManager.isActive()}
          >
            清除过滤
          </Button>
          <Button
            icon={<CloseOutlined />}
            onClick={onClose}
          />
        </Space>
      </div>

      {isFiltering && (
        <div className="filter-progress">
          <Progress percent={50} size="small" status="active" />
        </div>
      )}

      {filterStats.matchedLines > 0 && (
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
}; 