/**
 * 双模式编辑器包装组件
 * 提供搜索、过滤等功能的适配器
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react';
import { message } from 'antd';
import { EditorMode } from '../../types/FileEditorTypes';
import { DualModeEditor } from './DualModeEditor';
import { DualModeEditorRef } from './DualModeEditorTypes';
import { SearchManager } from '../../core/SearchManager';
import { FilterManager } from '../../core/FilterManager';
import { FileEditorManager } from '../../core/FileEditorManager';
import EditorToolbar from '../EditorToolbar/EditorToolbar';
import './DualModeEditorWrapperStyles.css';

export interface DualModeEditorWrapperProps {
  filePath: string;
  sessionId: string;
  tabId: string;
  initialMode?: EditorMode;
  readOnly?: boolean;
  onModeChange?: (mode: EditorMode) => void;
  onError?: (error: Error) => void;
}

export const DualModeEditorWrapper: React.FC<DualModeEditorWrapperProps> = observer(({
  filePath,
  sessionId,
  tabId,
  initialMode = EditorMode.BROWSE,
  readOnly = false,
  onModeChange,
  onError
}) => {
  const editorRef = useRef<DualModeEditorRef>(null);
  const [currentMode, setCurrentMode] = useState<EditorMode>(initialMode);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [encoding, setEncoding] = useState<string>('UTF-8');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterQuery, setFilterQuery] = useState<string>('');
  
  const editorManager = useRef<FileEditorManager | null>(null);
  const searchManager = useRef<SearchManager | null>(null);
  const filterManager = useRef<FilterManager | null>(null);
  
  // 初始化编辑器管理器和相关适配器
  useEffect(() => {
    // 创建编辑器管理器
    const manager = new FileEditorManager(filePath, sessionId);
    editorManager.current = manager;
    
    // 注意：SearchManager和FilterManager需要在编辑器初始化后才能创建
    // 这里我们不直接创建，而是在需要时创建
    
    return () => {
      // 清理资源
      if (searchManager.current) {
        // 使用removeAllListeners代替dispose
        searchManager.current.removeAllListeners?.();
      }
      
      if (filterManager.current) {
        // 使用removeAllListeners代替dispose
        filterManager.current.removeAllListeners?.();
      }
      
      if (editorManager.current) {
        editorManager.current.dispose();
        editorManager.current = null;
      }
    };
  }, [filePath, sessionId]);
  
  // 处理模式切换
  const handleModeSwitch = useCallback((mode: EditorMode) => {
    setCurrentMode(mode);
    if (onModeChange) {
      onModeChange(mode);
    }
  }, [onModeChange]);
  
  // 处理保存
  const handleSave = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.save().then(() => {
        setIsDirty(false);
      }).catch(error => {
        console.error('保存文件失败:', error);
        message.error(`保存文件失败: ${error.message}`);
      });
    }
  }, [editorRef]);
  
  // 处理刷新
  const handleRefresh = useCallback(() => {
    if (editorRef.current) {
      editorRef.current.refresh().then(() => {
        setIsDirty(false);
      }).catch(error => {
        console.error('刷新文件失败:', error);
        message.error(`刷新文件失败: ${error.message}`);
      });
    }
  }, [editorRef]);
  
  // 处理搜索
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setShowSearch(true);
  }, []);
  
  // 处理过滤
  const handleFilter = useCallback((query: string) => {
    setFilterQuery(query);
    setShowFilter(true);
  }, []);
  
  // 处理编码变更
  const handleEncodingChange = useCallback((newEncoding: string) => {
    setEncoding(newEncoding);
    if (editorRef.current) {
      // 假设DualModeEditorRef有changeEncoding方法
      // 如果没有，需要通过其他方式实现
      console.log('编码已更改为:', newEncoding);
    }
  }, [editorRef]);
  
  // 处理编辑器变更事件
  const handleEditorChange = useCallback(() => {
    setIsDirty(true);
  }, []);
  
  // 处理搜索关闭
  const handleSearchClose = useCallback(() => {
    setShowSearch(false);
    if (searchManager.current) {
      // 使用stopSearch代替clearSearch
      searchManager.current.stopSearch?.();
    }
  }, [searchManager]);
  
  // 处理过滤关闭
  const handleFilterClose = useCallback(() => {
    setShowFilter(false);
    if (filterManager.current) {
      // 使用clearFilter方法
      filterManager.current.clearFilter?.();
    }
  }, [filterManager]);
  
  return (
    <div className="dual-mode-editor-wrapper">
      <div className="dual-mode-editor-toolbar-container">
        <EditorToolbar
          currentMode={currentMode}
          onModeSwitch={handleModeSwitch}
          onSave={handleSave}
          onRefresh={handleRefresh}
          onSearch={handleSearch}
          onFilter={handleFilter}
          onEncodingChange={handleEncodingChange}
          isDirty={isDirty}
          encoding={encoding}
          isReadOnly={readOnly}
        />
      </div>
      
      <div className="dual-mode-editor-content">
        {showSearch && (
          <div className="dual-mode-editor-search-panel">
            {/* 简化的搜索面板 */}
            <div className="search-panel-header">
              <h3>搜索</h3>
              <button onClick={handleSearchClose}>关闭</button>
            </div>
            <div className="search-panel-content">
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="输入搜索内容..."
              />
              <button onClick={() => {
                if (editorRef.current) {
                  // 执行搜索
                  console.log('执行搜索:', searchQuery);
                }
              }}>搜索</button>
            </div>
          </div>
        )}
        
        {showFilter && (
          <div className="dual-mode-editor-filter-panel">
            {/* 简化的过滤面板 */}
            <div className="filter-panel-header">
              <h3>过滤</h3>
              <button onClick={handleFilterClose}>关闭</button>
            </div>
            <div className="filter-panel-content">
              <input 
                type="text" 
                value={filterQuery} 
                onChange={(e) => setFilterQuery(e.target.value)} 
                placeholder="输入过滤条件..."
              />
              <button onClick={() => {
                if (editorRef.current) {
                  // 执行过滤
                  console.log('执行过滤:', filterQuery);
                }
              }}>过滤</button>
            </div>
          </div>
        )}
        
        <div className="dual-mode-editor-main">
          <DualModeEditor
            ref={editorRef}
            filePath={filePath}
            sessionId={sessionId}
            tabId={tabId}
            initialConfig={{
              readOnly,
              encoding,
              initialMode
            }}
          />
        </div>
      </div>
    </div>
  );
});

export default DualModeEditorWrapper; 