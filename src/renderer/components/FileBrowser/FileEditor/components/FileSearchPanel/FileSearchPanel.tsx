/**
 * 文件搜索面板组件
 * 提供搜索界面和结果导航
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Input, Space, Button, Tooltip, Switch, Progress } from 'antd';
import { SearchOutlined, CloseOutlined } from '@ant-design/icons';
import { SearchManager } from '../../core/SearchManager';
import './FileSearchPanel.css';

interface FileSearchPanelProps {
  searchManager: SearchManager;
  onClose: () => void;
}

export const FileSearchPanel: React.FC<FileSearchPanelProps> = ({
  searchManager,
  onClose
}) => {
  // 搜索状态
  const [searchText, setSearchText] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWord, setIsWholeWord] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState(0);

  // 监听搜索事件
  useEffect(() => {
    const handleSearchComplete = (result: any) => {
      console.log('[FileSearchPanel] 搜索完成, 匹配数:', result.results?.length || 0);
      setMatchCount(result.results?.length || 0);
      setIsSearching(false);
      setSearchError(null);
    };

    const handleSearchError = (error: Error) => {
      console.error('[FileSearchPanel] 搜索错误:', error);
      setSearchError(error.message);
      setIsSearching(false);
    };

    // 使用新的事件名
    searchManager.on('search-completed', handleSearchComplete);
    searchManager.on('search-error', handleSearchError);

    return () => {
      searchManager.off('search-completed', handleSearchComplete);
      searchManager.off('search-error', handleSearchError);
    };
  }, [searchManager]);

  // 处理搜索文本变化
  const handleSearchTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    setSearchError(null);
  }, []);

  // 处理搜索
  const handleSearch = useCallback(() => {
    if (!searchText) return;

    console.log('[FileSearchPanel] 开始搜索:', {
      searchText,
      isRegex,
      isCaseSensitive,
      isWholeWord
    });

    try {
      setIsSearching(true);
      setSearchError(null);

      // 使用新的接口格式
      searchManager.search({
        pattern: searchText,
        isRegex,
        caseSensitive: isCaseSensitive,
        wholeWord: isWholeWord
      });
    } catch (error) {
      console.error('[FileSearchPanel] 搜索出错:', error);
      setSearchError((error as Error).message);
      setIsSearching(false);
    }
  }, [searchText, isRegex, isCaseSensitive, isWholeWord, searchManager]);

  // 处理清除搜索
  const handleClear = useCallback(() => {
    setSearchText('');
    setSearchError(null);
    // 使用新的方法名
    searchManager.stopSearch();
    setMatchCount(0);
  }, [searchManager]);

  // 处理选项变化
  const handleOptionChange = useCallback((option: 'regex' | 'case' | 'word') => {
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
  }, [isRegex, isCaseSensitive, isWholeWord]);

  return (
    <div className="file-search-panel">
      <div className="search-header">
        <Space>
          <Input
            prefix={<SearchOutlined />}
            placeholder="搜索..."
            value={searchText}
            onChange={handleSearchTextChange}
            onPressEnter={handleSearch}
            disabled={isSearching}
          />
          <Tooltip title="使用正则表达式">
            <Button
              type={isRegex ? "primary" : "text"}
              icon={<span>.*</span>}
              onClick={() => handleOptionChange('regex')}
              disabled={isSearching}
            />
          </Tooltip>
          <Tooltip title="区分大小写">
            <Button
              type={isCaseSensitive ? "primary" : "text"}
              icon={<span>Aa</span>}
              onClick={() => handleOptionChange('case')}
              disabled={isSearching}
            />
          </Tooltip>
          <Tooltip title="全词匹配">
            <Button
              type={isWholeWord ? "primary" : "text"}
              icon={<span>\\b</span>}
              onClick={() => handleOptionChange('word')}
              disabled={isSearching}
            />
          </Tooltip>
          <Button
            type="primary"
            onClick={handleSearch}
            disabled={!searchText || isSearching}
            loading={isSearching}
          >
            搜索
          </Button>
          <Button
            onClick={handleClear}
            disabled={!searchText && matchCount === 0}
          >
            清除
          </Button>
          <Button
            icon={<CloseOutlined />}
            onClick={onClose}
          />
        </Space>
      </div>

      {isSearching && (
        <div className="search-progress">
          <Progress percent={50} size="small" status="active" />
        </div>
      )}

      {matchCount > 0 && (
        <div className="search-stats">
          找到 {matchCount} 个匹配项
        </div>
      )}

      {searchError && (
        <div className="search-error">
          搜索错误: {searchError}
        </div>
      )}
    </div>
  );
}; 