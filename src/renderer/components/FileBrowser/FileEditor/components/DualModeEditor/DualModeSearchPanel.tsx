/**
 * 双模式编辑器搜索面板
 * 根据当前模式使用不同的搜索实现
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Button, Input, Checkbox, Tooltip, message } from 'antd';
import { SearchOutlined, CloseOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { SearchAdapter } from './SearchFilterAdapter';
import { EditorMode } from '../../types/FileEditorTypes';
import { FileEditorManager } from '../../core/FileEditorManager';
import './DualModeSearchPanelStyles.css';

interface DualModeSearchPanelProps {
  editorManager: FileEditorManager;
  searchAdapter: SearchAdapter;
  onClose: () => void;
}

export const DualModeSearchPanel: React.FC<DualModeSearchPanelProps> = ({
  editorManager,
  searchAdapter,
  onClose
}) => {
  // 搜索状态
  const [searchText, setSearchText] = useState<string>('');
  const [isRegex, setIsRegex] = useState<boolean>(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState<boolean>(false);
  const [isWholeWord, setIsWholeWord] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStats, setSearchStats] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [currentMode, setCurrentMode] = useState<EditorMode>(editorManager.getCurrentMode());

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

  // 监听搜索事件
  useEffect(() => {
    const handleSearchStart = () => {
      setIsSearching(true);
      setSearchError(null);
    };

    const handleSearchComplete = (data: any) => {
      setIsSearching(false);
      setSearchStats({
        current: data.currentMatch || 0,
        total: data.totalMatches || 0
      });

      if (data.totalMatches === 0) {
        message.info('未找到匹配项');
      }
    };

    const handleSearchError = (error: Error) => {
      setIsSearching(false);
      setSearchError(error.message);
      message.error(`搜索错误: ${error.message}`);
    };

    // 根据当前模式监听不同的事件
    if (currentMode === EditorMode.EDIT) {
      searchAdapter.on('search-start', handleSearchStart);
      searchAdapter.on('search-complete', handleSearchComplete);
      searchAdapter.on('search-error', handleSearchError);
    } else {
      editorManager.on('search-start', handleSearchStart);
      editorManager.on('search-complete', handleSearchComplete);
      editorManager.on('search-error', handleSearchError);
    }

    return () => {
      if (currentMode === EditorMode.EDIT) {
        searchAdapter.off('search-start', handleSearchStart);
        searchAdapter.off('search-complete', handleSearchComplete);
        searchAdapter.off('search-error', handleSearchError);
      } else {
        editorManager.off('search-start', handleSearchStart);
        editorManager.off('search-complete', handleSearchComplete);
        editorManager.off('search-error', handleSearchError);
      }
    };
  }, [searchAdapter, editorManager, currentMode]);

  // 执行搜索
  const handleSearch = useCallback(() => {
    if (!searchText) {
      return;
    }

    searchAdapter.search({
      text: searchText,
      isRegex,
      isCaseSensitive,
      isWholeWord
    });
  }, [searchAdapter, searchText, isRegex, isCaseSensitive, isWholeWord]);

  // 导航到下一个匹配项
  const handleNext = useCallback(() => {
    if (currentMode === EditorMode.EDIT) {
      // 编辑模式下使用EditMode的查找下一个功能
      const editMode = editorManager.getEditMode();
      if (editMode) {
        // 使用EditMode提供的方法导航到下一个匹配项
        editMode.navigateToNextSearchResult();
      }
    } else {
      // 浏览模式下使用BrowseMode的导航功能
      const browseMode = editorManager.getBrowseMode();
      if (browseMode) {
        // 使用BrowseMode提供的方法导航到下一个匹配项
        browseMode.navigateToNextMatch();
      }
    }
  }, [editorManager, currentMode]);

  // 导航到上一个匹配项
  const handlePrevious = useCallback(() => {
    if (currentMode === EditorMode.EDIT) {
      // 编辑模式下使用EditMode的查找上一个功能
      const editMode = editorManager.getEditMode();
      if (editMode) {
        // 使用EditMode提供的方法导航到上一个匹配项
        editMode.navigateToPreviousSearchResult();
      }
    } else {
      // 浏览模式下使用BrowseMode的导航功能
      const browseMode = editorManager.getBrowseMode();
      if (browseMode) {
        // 使用BrowseMode提供的方法导航到上一个匹配项
        browseMode.navigateToPreviousMatch();
      }
    }
  }, [editorManager, currentMode]);

  // 清除搜索
  const handleClear = useCallback(() => {
    setSearchText('');
    searchAdapter.clearSearch();
  }, [searchAdapter]);

  // 按Enter键执行搜索
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="dual-mode-search-panel">
      <div className="search-header">
        <h3>搜索</h3>
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          className="close-button"
        />
      </div>

      <div className="search-input-container">
        <Input
          placeholder="输入搜索内容..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={handleKeyDown}
          prefix={<SearchOutlined />}
          disabled={isSearching}
        />
        <Button
          type="primary"
          onClick={handleSearch}
          loading={isSearching}
        >
          搜索
        </Button>
        <Button onClick={handleClear}>清除</Button>
      </div>

      <div className="search-options">
        <Checkbox
          checked={isRegex}
          onChange={(e) => setIsRegex(e.target.checked)}
          disabled={isSearching}
        >
          正则表达式
        </Checkbox>
        <Checkbox
          checked={isCaseSensitive}
          onChange={(e) => setIsCaseSensitive(e.target.checked)}
          disabled={isSearching}
        >
          区分大小写
        </Checkbox>
        <Checkbox
          checked={isWholeWord}
          onChange={(e) => setIsWholeWord(e.target.checked)}
          disabled={isSearching}
        >
          全字匹配
        </Checkbox>
      </div>

      {searchStats.total > 0 && (
        <div className="search-navigation">
          <div className="search-stats">
            {searchStats.current} / {searchStats.total} 匹配项
          </div>
          <div className="search-navigation-buttons">
            <Tooltip title="上一个匹配项">
              <Button
                icon={<LeftOutlined />}
                onClick={handlePrevious}
                disabled={searchStats.total === 0}
              />
            </Tooltip>
            <Tooltip title="下一个匹配项">
              <Button
                icon={<RightOutlined />}
                onClick={handleNext}
                disabled={searchStats.total === 0}
              />
            </Tooltip>
          </div>
        </div>
      )}

      {searchError && (
        <div className="search-error">
          错误: {searchError}
        </div>
      )}
    </div>
  );
};

export default DualModeSearchPanel; 