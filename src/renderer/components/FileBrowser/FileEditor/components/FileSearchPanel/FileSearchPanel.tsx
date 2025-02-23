/**
 * 文件搜索面板组件
 * 提供搜索界面和结果导航
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import { SearchManager, SearchConfig, SearchResult } from '../../core/SearchManager';
import { useEditorStore } from '../../store/FileEditorStore';
import './FileSearchPanel.less';

interface FileSearchPanelProps {
  searchManager: SearchManager;
  onClose: () => void;
}

export const FileSearchPanel: React.FC<FileSearchPanelProps> = observer((props) => {
  const { searchManager, onClose } = props;
  const editorStore = useEditorStore();

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
      if (value) {
        startSearch(value);
      } else {
        setSearchResults([]);
        setCurrentResultIndex(-1);
      }
    }, 300);
  }, [isRegex, isCaseSensitive, isWholeWord]);

  // 开始搜索
  const startSearch = useCallback(async (text: string) => {
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
  }, [isRegex, isCaseSensitive, isWholeWord, searchText, startSearch]);

  // 处理导航
  const handleNavigation = useCallback((direction: 'next' | 'prev') => {
    const result = direction === 'next' 
      ? searchManager.nextMatch()
      : searchManager.previousMatch();

    if (result) {
      // TODO: 通知编辑器跳转到对应位置
    }
  }, [searchManager]);

  // 监听搜索事件
  useEffect(() => {
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
      {/* 搜索输入区域 */}
      <div className="search-input-area">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            value={searchText}
            onChange={handleSearchTextChange}
            placeholder="搜索..."
          />
          {searchText && (
            <button
              className="clear-button"
              onClick={() => setSearchText('')}
              title="清除搜索"
            >
              ×
            </button>
          )}
        </div>

        {/* 搜索选项 */}
        <div className="search-options">
          <button
            className={`option-button ${isRegex ? 'active' : ''}`}
            onClick={() => handleOptionChange('regex')}
            title="使用正则表达式"
          >
            .*
          </button>
          <button
            className={`option-button ${isCaseSensitive ? 'active' : ''}`}
            onClick={() => handleOptionChange('case')}
            title="区分大小写"
          >
            Aa
          </button>
          <button
            className={`option-button ${isWholeWord ? 'active' : ''}`}
            onClick={() => handleOptionChange('word')}
            title="全词匹配"
          >
            ⟨ab⟩
          </button>
        </div>

        <button className="close-button" onClick={onClose} title="关闭搜索">
          ×
        </button>
      </div>

      {/* 搜索结果导航 */}
      {searchResults.length > 0 && (
        <div className="search-results-nav">
          <div className="results-count">
            {currentResultIndex + 1} / {searchResults.length} 个结果
          </div>
          <div className="nav-buttons">
            <button
              onClick={() => handleNavigation('prev')}
              disabled={currentResultIndex <= 0}
              title="上一个匹配项"
            >
              ◀️
            </button>
            <button
              onClick={() => handleNavigation('next')}
              disabled={currentResultIndex >= searchResults.length - 1}
              title="下一个匹配项"
            >
              ▶️
            </button>
          </div>
        </div>
      )}

      {/* 搜索状态/错误信息 */}
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

      {/* 当前匹配项预览 */}
      {searchResults.length > 0 && currentResultIndex >= 0 && (
        <div className="result-preview">
          <div className="preview-header">
            预览:
          </div>
          <div className="preview-content">
            {searchResults[currentResultIndex].previewText}
          </div>
        </div>
      )}
    </div>
  );
}); 