/**
 * 文件编辑器过滤面板组件
 * 负责文件内容的过滤和预设管理
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Input, Space, Button, Tooltip, Progress, Tag, Card, Divider } from 'antd';
import { FilterOutlined, CloseOutlined, ClearOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
  // 初始化时从 FilterManager 获取当前过滤状态
  const initializeFilterState = () => {
    const currentConfig = filterManager.getCurrentFilterConfig();
    const currentStats = filterManager.getCurrentFilterStats();

    if (currentConfig && filterManager.isActive()) {
      return {
        filterText: currentConfig.pattern,
        isRegex: currentConfig.isRegex,
        isCaseSensitive: currentConfig.caseSensitive,
        activeFilter: {
          text: currentConfig.pattern,
          isRegex: currentConfig.isRegex,
          isCaseSensitive: currentConfig.caseSensitive
        },
        filterStats: currentStats || { totalLines: 0, matchedLines: 0 }
      };
    }
    return {
      filterText: '',
      isRegex: false,
      isCaseSensitive: false,
      activeFilter: null,
      filterStats: { totalLines: 0, matchedLines: 0 }
    };
  };

  const initialState = initializeFilterState();

  // 过滤状态
  const [filterText, setFilterText] = useState(initialState.filterText);
  const [isRegex, setIsRegex] = useState(initialState.isRegex);
  const [isCaseSensitive, setIsCaseSensitive] = useState(initialState.isCaseSensitive);
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [filterStats, setFilterStats] = useState<{
    totalLines: number;
    matchedLines: number;
  }>(initialState.filterStats);
  const [activeFilter, setActiveFilter] = useState<{
    text: string;
    isRegex: boolean;
    isCaseSensitive: boolean;
  } | null>(initialState.activeFilter);

  // 组件挂载时的初始化日志
  useEffect(() => {
    const currentConfig = filterManager.getCurrentFilterConfig();
    const currentStats = filterManager.getCurrentFilterStats();
    const isActive = filterManager.isActive();

    console.log('[FileFilterPanel] 组件初始化:', {
      isActive,
      currentConfig,
      currentStats,
      initialState
    });
  }, []);

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
      // 设置当前活动的过滤器
      setActiveFilter({
        text: filterText,
        isRegex,
        isCaseSensitive
      });
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
  }, [filterManager, filterText, isRegex, isCaseSensitive]);

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
    setActiveFilter(null);
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
      {/* 标题栏 */}
      <div className="filter-title-bar">
        <div className="filter-title">
          <FilterOutlined />
          <span>内容过滤</span>
        </div>
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          className="close-btn"
        />
      </div>

      {/* 过滤输入区域 */}
      <div className="filter-input-section">
        <div className="filter-input-row">
          <Input
            placeholder="输入过滤条件..."
            value={filterText}
            onChange={handleFilterTextChange}
            onPressEnter={handleFilter}
            disabled={isFiltering}
            className="filter-input"
            allowClear
          />
        </div>

        <div className="filter-options-row">
          <Space size="small">
            <Tooltip title="使用正则表达式">
              <Button
                type={isRegex ? "primary" : "default"}
                size="small"
                onClick={() => handleOptionChange('regex')}
                disabled={isFiltering}
              >
                .*
              </Button>
            </Tooltip>
            <Tooltip title="区分大小写">
              <Button
                type={isCaseSensitive ? "primary" : "default"}
                size="small"
                onClick={() => handleOptionChange('case')}
                disabled={isFiltering}
              >
                Aa
              </Button>
            </Tooltip>
          </Space>
        </div>

        <div className="filter-actions-row">
          <Space>
            <Button
              type="primary"
              onClick={handleFilter}
              disabled={!filterText || isFiltering}
              loading={isFiltering}
              icon={<FilterOutlined />}
            >
              应用过滤
            </Button>
            <Button
              onClick={handleClear}
              disabled={!filterManager.isActive()}
              icon={<ClearOutlined />}
            >
              清除
            </Button>
          </Space>
        </div>
      </div>

      {/* 进度条 */}
      {isFiltering && (
        <div className="filter-progress-section">
          <Progress percent={50} size="small" status="active" showInfo={false} />
          <span className="progress-text">正在过滤...</span>
        </div>
      )}

      {/* 当前过滤状态 */}
      {activeFilter && (
        <div className="filter-status-section">
          <Card size="small" className="filter-status-card">
            <div className="filter-status-header">
              <CheckCircleOutlined className="status-icon" />
              <span className="status-title">当前过滤</span>
            </div>
            <div className="filter-status-content">
              <div className="filter-text">
                <Tag color="blue">{activeFilter.text}</Tag>
              </div>
              <div className="filter-options">
                {activeFilter.isRegex && <Tag size="small">正则</Tag>}
                {activeFilter.isCaseSensitive && <Tag size="small">区分大小写</Tag>}
              </div>
              {filterStats.matchedLines > 0 && (
                <div className="filter-result">
                  <span className="result-text">
                    匹配 <strong>{filterStats.matchedLines}</strong> / {filterStats.totalLines} 行
                  </span>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* 错误信息 */}
      {filterError && (
        <div className="filter-error-section">
          <Card size="small" className="filter-error-card">
            <div className="error-content">
              <span className="error-title">过滤错误</span>
              <div className="error-message">{filterError}</div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}; 