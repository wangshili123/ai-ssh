/**
 * 文件搜索面板组件
 * 提供搜索界面和结果导航
 */

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react';
import { SearchManager, SearchConfig, SearchResult } from '../../core/SearchManager';
import { useEditorStore } from '../../store/FileEditorStore';
import './FileSearchPanel.css';
import { Button, Input, Space, Switch, Tooltip, List } from 'antd';
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
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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

  // 处理导航
  const handleNavigation = useCallback((direction: 'next' | 'prev') => {
    if (!searchManager) return;

    if (direction === 'next') {
      searchManager.nextMatch();
    } else {
      searchManager.previousMatch();
    }
  }, [searchManager]);

  return (
    <div className="file-search-results">
      <div className="search-header">
        <Space>
          <span className="search-stats">
            找到 {searchResults.length} 个结果
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
          <Button
            icon={<CloseOutlined />}
            onClick={onClose}
          />
        </Space>
      </div>

      <div className="search-results-list">
        <List
          size="small"
          dataSource={searchResults}
          renderItem={(result, index) => (
            <List.Item
              className={index === currentResultIndex ? 'active' : ''}
              onClick={() => {
                setCurrentResultIndex(index);
                searchManager?.setCurrentMatch(index);
              }}
            >
              <div className="result-item">
                <span className="line-number">行 {result.lineNumber}</span>
                <span className="preview-text" dangerouslySetInnerHTML={{
                  __html: result.previewText.replace(
                    new RegExp(`(${searchManager?.getCurrentPattern() || ''})`, 'gi'),
                    '<mark>$1</mark>'
                  )
                }} />
              </div>
            </List.Item>
          )}
        />
      </div>

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