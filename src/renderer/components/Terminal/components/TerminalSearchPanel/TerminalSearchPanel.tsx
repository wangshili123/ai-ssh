/**
 * 终端搜索面板组件
 * 提供终端内容搜索界面和结果导航
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Input, Space, Button, Tooltip, message, List, Typography, Modal } from 'antd';
import { SearchOutlined, CloseOutlined, UpOutlined, DownOutlined, EyeOutlined, ExpandAltOutlined, CompressOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { SearchAddon } from 'xterm-addon-search';
import { Terminal as XTerm } from 'xterm';
import './TerminalSearchPanel.css';

const { Text } = Typography;

interface SearchResult {
  line: number;
  content: string;
  matchStart: number;
  matchEnd: number;
}

interface TerminalSearchPanelProps {
  searchAddon: SearchAddon;
  terminal: XTerm;
  onClose: () => void;
  visible: boolean;
}

export const TerminalSearchPanel: React.FC<TerminalSearchPanelProps> = ({
  searchAddon,
  terminal,
  onClose,
  visible
}) => {
  // 搜索状态
  const [searchText, setSearchText] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isWholeWord, setIsWholeWord] = useState(false);
  const [currentMatch, setCurrentMatch] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);
  const [isAllResultsModalVisible, setIsAllResultsModalVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 输入框引用，用于自动聚焦
  const inputRef = useRef<any>(null);

  // 当面板显示时自动聚焦到搜索框
  useEffect(() => {
    if (visible && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  // 获取终端内容并搜索匹配项
  const findAllMatches = useCallback((text: string): SearchResult[] => {
    if (!text || !terminal) return [];

    const results: SearchResult[] = [];
    const buffer = terminal.buffer.active;
    const totalLines = buffer.length;

    try {
      // 构建搜索正则表达式
      let searchRegex: RegExp;
      if (isRegex) {
        searchRegex = new RegExp(text, isCaseSensitive ? 'g' : 'gi');
      } else {
        const escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = isWholeWord ? `\\b${escapedText}\\b` : escapedText;
        searchRegex = new RegExp(pattern, isCaseSensitive ? 'g' : 'gi');
      }

      // 遍历所有行查找匹配项
      for (let i = 0; i < totalLines; i++) {
        const line = buffer.getLine(i);
        if (line) {
          const lineText = line.translateToString(true);
          let match;
          searchRegex.lastIndex = 0; // 重置正则表达式状态

          while ((match = searchRegex.exec(lineText)) !== null) {
            results.push({
              line: i,
              content: lineText,
              matchStart: match.index,
              matchEnd: match.index + match[0].length
            });

            // 防止无限循环
            if (match[0].length === 0) {
              searchRegex.lastIndex++;
            }
          }
        }
      }
    } catch (error) {
      console.error('[TerminalSearchPanel] 搜索出错:', error);
    }

    return results;
  }, [terminal, isRegex, isCaseSensitive, isWholeWord]);

  // 处理搜索文本变化
  const handleSearchTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);

    if (value) {
      performSearch(value);
    } else {
      // 清空搜索时清除高亮和结果
      searchAddon.clearDecorations();
      setCurrentMatch(0);
      setTotalMatches(0);
      setSearchResults([]);
    }
  }, [searchAddon]);

  // 执行搜索
  const performSearch = useCallback((text: string) => {
    if (!text) return;

    try {
      // 获取所有匹配结果
      const results = findAllMatches(text);
      setSearchResults(results);
      setTotalMatches(results.length);

      if (results.length > 0) {
        setCurrentMatch(1);
        // 使用SearchAddon高亮第一个匹配项
        const searchOptions = {
          regex: isRegex,
          caseSensitive: isCaseSensitive,
          wholeWord: isWholeWord
        };
        searchAddon.findNext(text, searchOptions);
      } else {
        setCurrentMatch(0);
        if (text.length > 0) {
          message.info('未找到匹配项');
        }
      }
    } catch (error) {
      console.error('[TerminalSearchPanel] 搜索出错:', error);
      message.error('搜索出错');
    }
  }, [searchAddon, isRegex, isCaseSensitive, isWholeWord, findAllMatches]);

  // 查找下一个
  const handleFindNext = useCallback(() => {
    if (!searchText) return;
    
    const found = searchAddon.findNext(searchText, {
      regex: isRegex,
      caseSensitive: isCaseSensitive,
      wholeWord: isWholeWord
    });
    
    if (!found) {
      message.info('已到达最后一个匹配项');
    }
  }, [searchAddon, searchText, isRegex, isCaseSensitive, isWholeWord]);

  // 查找上一个
  const handleFindPrevious = useCallback(() => {
    if (!searchText) return;
    
    const found = searchAddon.findPrevious(searchText, {
      regex: isRegex,
      caseSensitive: isCaseSensitive,
      wholeWord: isWholeWord
    });
    
    if (!found) {
      message.info('已到达第一个匹配项');
    }
  }, [searchAddon, searchText, isRegex, isCaseSensitive, isWholeWord]);

  // 处理选项切换
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
    
    // 重新搜索
    if (searchText) {
      setTimeout(() => performSearch(searchText), 0);
    }
  }, [isRegex, isCaseSensitive, isWholeWord, searchText, performSearch]);

  // 处理清除搜索
  const handleClear = useCallback(() => {
    setSearchText('');
    searchAddon.clearDecorations();
    setCurrentMatch(0);
    setTotalMatches(0);
    setSearchResults([]);
  }, [searchAddon]);

  // 跳转到指定结果
  const jumpToResult = useCallback((result: SearchResult) => {
    if (terminal && searchText) {
      // 滚动到指定行
      terminal.scrollToLine(result.line);

      // 重新搜索以高亮该位置
      const searchOptions = {
        regex: isRegex,
        caseSensitive: isCaseSensitive,
        wholeWord: isWholeWord
      };

      // 先清除之前的高亮
      searchAddon.clearDecorations();

      // 从指定行开始搜索
      searchAddon.findNext(searchText, searchOptions);
    }
  }, [terminal, searchText, searchAddon, isRegex, isCaseSensitive, isWholeWord]);

  // 查看详细内容
  const handleViewDetail = useCallback((result: SearchResult) => {
    setSelectedResult(result);
    setIsDetailModalVisible(true);
  }, []);

  // 渲染高亮的文本
  const renderHighlightedText = useCallback((content: string, matchStart: number, matchEnd: number) => {
    const beforeMatch = content.substring(0, matchStart);
    const match = content.substring(matchStart, matchEnd);
    const afterMatch = content.substring(matchEnd);

    return (
      <span>
        {beforeMatch}
        <Text mark style={{ backgroundColor: '#ffeb3b', color: '#000' }}>
          {match}
        </Text>
        {afterMatch}
      </span>
    );
  }, []);

  // 处理键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        handleFindPrevious();
      } else {
        handleFindNext();
      }
      e.preventDefault();
    } else if (e.key === 'Escape') {
      onClose();
      e.preventDefault();
    }
  }, [handleFindNext, handleFindPrevious, onClose]);

  if (!visible) {
    return null;
  }

  return (
    <div className="terminal-search-panel">
      <div className="search-header">
        <Space>
          <Input
            ref={inputRef}
            prefix={<SearchOutlined />}
            placeholder="搜索终端内容..."
            value={searchText}
            onChange={handleSearchTextChange}
            onKeyDown={handleKeyDown}
            style={{ width: 200 }}
            size="small"
          />
          
          <Tooltip title="使用正则表达式">
            <Button
              type={isRegex ? "primary" : "text"}
              size="small"
              onClick={() => handleOptionChange('regex')}
            >
              .*
            </Button>
          </Tooltip>
          
          <Tooltip title="区分大小写">
            <Button
              type={isCaseSensitive ? "primary" : "text"}
              size="small"
              onClick={() => handleOptionChange('case')}
            >
              Aa
            </Button>
          </Tooltip>
          
          <Tooltip title="全词匹配">
            <Button
              type={isWholeWord ? "primary" : "text"}
              size="small"
              onClick={() => handleOptionChange('word')}
            >
              \b
            </Button>
          </Tooltip>
          
          <Tooltip title="上一个 (Shift+Enter)">
            <Button
              icon={<UpOutlined />}
              size="small"
              onClick={handleFindPrevious}
              disabled={!searchText}
            />
          </Tooltip>
          
          <Tooltip title="下一个 (Enter)">
            <Button
              icon={<DownOutlined />}
              size="small"
              onClick={handleFindNext}
              disabled={!searchText}
            />
          </Tooltip>
          
          <Button
            onClick={handleClear}
            disabled={!searchText}
            size="small"
          >
            清除
          </Button>
          
          <Button
            icon={<CloseOutlined />}
            onClick={onClose}
            size="small"
          />
        </Space>
      </div>

      {totalMatches > 0 && (
        <div className="search-stats">
          <span>找到 {totalMatches} 个匹配项</span>
          <Space size="small">
            <Tooltip title={isResultsCollapsed ? "展开结果列表" : "折叠结果列表"}>
              <Button
                type="text"
                size="small"
                icon={isResultsCollapsed ? <ExpandAltOutlined /> : <CompressOutlined />}
                onClick={() => setIsResultsCollapsed(!isResultsCollapsed)}
              />
            </Tooltip>
            <Tooltip title="查看完整匹配记录">
              <Button
                type="text"
                size="small"
                icon={<UnorderedListOutlined />}
                onClick={() => setIsAllResultsModalVisible(true)}
              />
            </Tooltip>
          </Space>
        </div>
      )}

      {/* 搜索结果列表 */}
      {searchResults.length > 0 && !isResultsCollapsed && (
        <div className="search-results">
          <List
            size="small"
            dataSource={searchResults.slice(0, 10)} // 限制显示前10个结果
            renderItem={(result, index) => (
              <List.Item
                key={`${result.line}-${result.matchStart}`}
                className="search-result-item"
                onClick={() => jumpToResult(result)}
                actions={[
                  <Button
                    key="detail"
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetail(result);
                    }}
                  />
                ]}
              >
                <div className="result-content">
                  <div className="result-line">行 {result.line + 1}:</div>
                  <div className="result-text">
                    {renderHighlightedText(
                      result.content.length > 80
                        ? result.content.substring(0, 80) + '...'
                        : result.content,
                      result.matchStart,
                      Math.min(result.matchEnd, 80)
                    )}
                  </div>
                </div>
              </List.Item>
            )}
          />
          {searchResults.length > 10 && (
            <div className="more-results">
              还有 {searchResults.length - 10} 个匹配项...
            </div>
          )}
        </div>
      )}

      {/* 详细内容模态框 */}
      <Modal
        title={`行 ${(selectedResult?.line || 0) + 1} 详细内容`}
        open={isDetailModalVisible}
        onCancel={() => setIsDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="jump"
            type="primary"
            onClick={() => {
              if (selectedResult) {
                jumpToResult(selectedResult);
                setIsDetailModalVisible(false);
              }
            }}
          >
            跳转到此行
          </Button>
        ]}
        width={700}
      >
        {selectedResult && (
          <div className="detail-content">
            <Text code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {renderHighlightedText(
                selectedResult.content,
                selectedResult.matchStart,
                selectedResult.matchEnd
              )}
            </Text>
          </div>
        )}
      </Modal>

      {/* 完整匹配记录模态框 */}
      <Modal
        title={`完整匹配记录 (共 ${totalMatches} 项)`}
        open={isAllResultsModalVisible}
        onCancel={() => {
          setIsAllResultsModalVisible(false);
          setCurrentPage(1);
          setPageSize(20);
        }}
        footer={null}
        width={900}
        style={{ top: 20 }}
      >
        <div className="all-results-content">
          <div className="results-list-container">
            <List
              size="small"
              dataSource={searchResults.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
              renderItem={(result) => (
                <List.Item
                  key={`${result.line}-${result.matchStart}`}
                  className="search-result-item-no-click"
                  actions={[
                    <Button
                      key="jump"
                      type="primary"
                      size="small"
                      onClick={() => {
                        jumpToResult(result);
                        setIsAllResultsModalVisible(false);
                      }}
                    >
                      跳转
                    </Button>
                  ]}
                >
                  <div className="result-content">
                    <div className="result-line">行 {result.line + 1}:</div>
                    <div className="result-text">
                      {renderHighlightedText(
                        result.content,
                        result.matchStart,
                        result.matchEnd
                      )}
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </div>
          <div className="pagination-container">
            <div className="pagination-wrapper">
              <Button
                onClick={() => {
                  setIsAllResultsModalVisible(false);
                  setCurrentPage(1);
                  setPageSize(20);
                }}
              >
                关闭
              </Button>
              <div className="pagination-controls">
                <span className="pagination-info">
                  显示 {Math.min((currentPage - 1) * pageSize + 1, totalMatches)}-{Math.min(currentPage * pageSize, totalMatches)} / 共 {totalMatches} 项
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    const newPageSize = parseInt(e.target.value);
                    setPageSize(newPageSize);
                    setCurrentPage(1);
                  }}
                  className="page-size-selector"
                >
                  <option value={10}>10 / 页</option>
                  <option value={20}>20 / 页</option>
                  <option value={50}>50 / 页</option>
                  <option value={100}>100 / 页</option>
                </select>
                <div className="page-controls">
                  <Button
                    size="small"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    上一页
                  </Button>
                  <span className="page-info">
                    {currentPage} / {Math.ceil(totalMatches / pageSize)}
                  </span>
                  <Button
                    size="small"
                    disabled={currentPage >= Math.ceil(totalMatches / pageSize)}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
