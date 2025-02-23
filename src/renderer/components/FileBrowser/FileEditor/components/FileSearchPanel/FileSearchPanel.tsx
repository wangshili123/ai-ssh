/**
 * 文件搜索面板组件
 * 提供搜索界面和结果导航
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import { SearchManager, SearchConfig, SearchResult } from '../../core/SearchManager';
import { useEditorStore } from '../../store/FileEditorStore';
import './FileSearchPanel.css';
import { Button, Input, Space, Switch, Tooltip } from 'antd';
import { SearchOutlined, CloseOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';

export interface FileSearchPanelProps {
  searchManager: SearchManager | null;
  onClose: () => void;
}

export const FileSearchPanel: React.FC<FileSearchPanelProps> = observer(({
  searchManager,
  onClose
}) => {
  // 搜索状态
  const [searchText, setSearchText] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWord, setIsWholeWord] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // 防抖定时器
  const searchDebounceRef = useRef<NodeJS.Timeout>();

  // 处理搜索文本变化
  const handleSearchTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);

    // 清除之前的定时器
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    // 设置新的定时器
    searchDebounceRef.current = setTimeout(() => {
      if (value && searchManager) {
        startSearch(value);
      } else {
        setSearchResults([]);
        setCurrentResultIndex(-1);
      }
    }, 300);
  }, [isRegex, isCaseSensitive, isWholeWord, searchManager]);

  // 开始搜索
  const startSearch = useCallback(async (text: string) => {
    if (!searchManager) return;

    try {
      setIsSearching(true);
      setSearchError(null);

      const config: SearchConfig = {
        pattern: text,
        isRegex,
        caseSensitive: isCaseSensitive,
        wholeWord: isWholeWord
      };

      await searchManager.startSearch(config);
    } catch (error) {
      setSearchError((error as Error).message);
    } finally {
      setIsSearching(false);
    }
  }, [searchManager, isRegex, isCaseSensitive, isWholeWord]);

  // 处理选项变化
  const handleOptionChange = useCallback((option: 'regex' | 'case' | 'word') => {
    if (!searchManager) return;

    switch (option) {
      case 'regex':
        setIsRegex(!isRegex);
        break;
      case 'case':
        setIsCaseSensitive(!isCaseSensitive);
        break;
      case 'word':
        setIsWholeWord(!isWholeWord);
        break;
    }

    // 如果有搜索文本，重新搜索
    if (searchText) {
      startSearch(searchText);
    }
  }, [isRegex, isCaseSensitive, isWholeWord, searchText, startSearch, searchManager]);

  // 处理导航
  const handleNavigation = useCallback((direction: 'next' | 'prev') => {
    if (!searchManager) return;

    if (direction === 'next') {
      searchManager.nextMatch();
    } else {
      searchManager.previousMatch();
    }
  }, [searchManager]);

  // 监听搜索事件
  useEffect(() => {
    if (!searchManager) return;

    const handleSearchResults = (results: SearchResult[]) => {
      setSearchResults(results);
      setCurrentResultIndex(results.length > 0 ? 0 : -1);
    };

    const handleSearchError = (error: Error) => {
      setSearchError(error.message);
      setIsSearching(false);
    };

    searchManager.on('searchCompleted', handleSearchResults);
    searchManager.on('searchError', handleSearchError);

    return () => {
      searchManager.off('searchCompleted', handleSearchResults);
      searchManager.off('searchError', handleSearchError);
    };
  }, [searchManager]);

  // 清理
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  return (
    <div className="file-search-panel">
      <div className="search-header">
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索..."
            value={searchText}
            onChange={handleSearchTextChange}
            disabled={!searchManager}
          />
          <Tooltip title="使用正则表达式">
            <Button
              type={isRegex ? "primary" : "text"}
              icon={<span>.*</span>}
              onClick={() => handleOptionChange('regex')}
              disabled={!searchManager}
            />
          </Tooltip>
          <Tooltip title="区分大小写">
            <Button
              type={isCaseSensitive ? "primary" : "text"}
              icon={<span>Aa</span>}
              onClick={() => handleOptionChange('case')}
              disabled={!searchManager}
            />
          </Tooltip>
          <Tooltip title="全词匹配">
            <Button
              type={isWholeWord ? "primary" : "text"}
              icon={<span>⟨ab⟩</span>}
              onClick={() => handleOptionChange('word')}
              disabled={!searchManager}
            />
          </Tooltip>
          <Button
            icon={<CloseOutlined />}
            onClick={onClose}
          />
        </Space>
      </div>

      {searchResults.length > 0 && (
        <div className="search-navigation">
          <Space>
            <span className="search-stats">
              {currentResultIndex + 1} / {searchResults.length} 个结果
            </span>
            <Button
              icon={<UpOutlined />}
              onClick={() => handleNavigation('prev')}
              disabled={currentResultIndex <= 0}
            />
            <Button
              icon={<DownOutlined />}
              onClick={() => handleNavigation('next')}
              disabled={currentResultIndex >= searchResults.length - 1}
            />
          </Space>
        </div>
      )}

      {isSearching && (
        <div className="search-status">
          正在搜索...
        </div>
      )}

      {searchError && (
        <div className="search-error">
          搜索错误: {searchError}
        </div>
      )}
    </div>
  );
}); 