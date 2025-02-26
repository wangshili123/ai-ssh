/**
 * 文件编辑器主组件
 * 负责文件内容的显示、编辑和各种交互功能
 */

import React, { useEffect, useRef, useState, useCallback, forwardRef, useReducer } from 'react';
import { observer } from 'mobx-react';
import * as monaco from 'monaco-editor';
import { EditorManager } from '../../core/EditorManager';
import { EditorState } from '../../core/EditorManager';
import { FileWatchManager } from '../../core/FileWatchManager';
import { EditorEvents, EditorMode, EditorErrorType } from '../../types/FileEditorTypes';
import { useEditorTabStore } from '../../store/EditorTabStore';
import { ErrorManager } from '../../core/ErrorManager';
import { SearchManager } from '../../core/SearchManager';
import { FilterManager } from '../../core/FilterManager';
import './FileEditorMain.css';
import '../../styles/FileEditor.css';  // 添加主题样式引入
import { EditorContextMenu } from '../ContextMenu/EditorContextMenu';
import { Alert, Button, Select, Space, Tooltip, Modal, Input, Checkbox, message } from 'antd';
import { CloudOutlined, DisconnectOutlined, LoadingOutlined, SaveOutlined, SearchOutlined, FilterOutlined, CloseOutlined, UpOutlined, DownOutlined } from '@ant-design/icons';
// 使用独立的EditorToolbar组件
import EditorToolbar from '../EditorToolbar/EditorToolbar';
import { FileStatusBar } from '../FileStatusBar/FileStatusBar';
import { sftpService } from '../../../../../services/sftp';
import { FileSearchPanel } from '../FileSearchPanel/FileSearchPanel';
import { FileFilterPanel } from '../FileFilterPanel/FileFilterPanel';

interface FileEditorMainProps {
  filePath: string;
  sessionId: string;
  tabId: string;
  initialConfig?: {
    readOnly?: boolean;
    encoding?: string;
  };
}

export interface FileEditorMainRef {
  isDirty: boolean;
  save: () => Promise<void>;
}

// 添加reducer函数和action类型
type EditorAction = 
  | { type: 'SET_SEARCH_PANEL', visible: boolean }
  | { type: 'SET_FILTER_PANEL', visible: boolean }
  | { type: 'SET_CONTEXT_MENU', position: { x: number; y: number } | null }
  | { type: 'SET_CURRENT_MODE', mode: EditorMode };

function editorUIReducer(state: {
  showSearchPanel: boolean;
  showFilterPanel: boolean;
  contextMenu: { x: number; y: number } | null;
  currentMode: EditorMode;
}, action: EditorAction) {
  switch (action.type) {
    case 'SET_SEARCH_PANEL':
      return { ...state, showSearchPanel: action.visible, showFilterPanel: false };
    case 'SET_FILTER_PANEL':
      return { ...state, showFilterPanel: action.visible, showSearchPanel: false };
    case 'SET_CONTEXT_MENU':
      return { ...state, contextMenu: action.position };
    case 'SET_CURRENT_MODE':
      return { ...state, currentMode: action.mode };
    default:
      return state;
  }
}

export const FileEditorMain = observer(forwardRef<FileEditorMainRef, FileEditorMainProps>((props, ref) => {
  const { filePath, sessionId, tabId, initialConfig } = props;
  const tabStore = useEditorTabStore();
  const tab = tabStore.getTab(tabId);
  
  // 编辑器实例引用
  const editorRef = useRef<EditorManager | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 管理器实例
  const [fileWatcher, setFileWatcher] = useState<FileWatchManager | null>(null);
  const [searchManager, setSearchManager] = useState<SearchManager | null>(null);
  const [filterManager, setFilterManager] = useState<FilterManager | null>(null);
  
  // 错误管理器实例
  const errorManager = useRef<ErrorManager>(new ErrorManager());

  // 在组件内部，替换多个useState为useReducer
  const [uiState, dispatch] = useReducer(editorUIReducer, {
    showSearchPanel: false,
    showFilterPanel: false,
    contextMenu: null,
    currentMode: EditorMode.EDIT
  });

  const { showSearchPanel, showFilterPanel, contextMenu, currentMode } = uiState;

  // 状态
  const [editorState, setEditorState] = useState<EditorState>({
    isDirty: false,
    encoding: 'UTF-8',
    cursorPosition: { line: 1, column: 1 },
    isLoading: false,
    error: null,
    isRealtime: false,
    isConnected: true,
    showLoadCompletePrompt: false,
    isRefreshing: false,
    isSaving: false,
    mode: EditorMode.EDIT
  });

  // 添加useEffect钩子来初始化编辑器
  useEffect(() => {
    console.log('FileEditorMain组件挂载，开始初始化编辑器', {
      filePath,
      sessionId,
      containerRef: containerRef.current,
      tabId
    });
    
    // 确保DOM容器已经渲染
    if (containerRef.current) {
      console.log('编辑器容器已渲染，尺寸:', {
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight
      });
      initializeEditor();
    } else {
      console.error('编辑器容器未渲染，无法初始化编辑器');
    }
    
    return () => {
      console.log('FileEditorMain组件卸载，清理资源');
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
      // 清理搜索和过滤管理器
      if (searchManager) {
        // 使用removeAllListeners代替dispose
        if (typeof searchManager.removeAllListeners === 'function') {
          searchManager.removeAllListeners();
        }
        setSearchManager(null);
      }
      if (filterManager) {
        // 使用removeAllListeners代替dispose
        if (typeof filterManager.removeAllListeners === 'function') {
          filterManager.removeAllListeners();
        }
        setFilterManager(null);
      }
    };
  }, [filePath, sessionId, tabId]); // 移除searchManager和filterManager依赖项，它们会在effect内部更新

  // 初始化编辑器
  const initializeEditor = async () => {
    // 如果编辑器已经初始化，则不再重复初始化
    if (editorRef.current) {
      console.log('编辑器已经初始化，跳过重复初始化');
      return;
    }

    try {
      console.log('开始初始化编辑器管理器', {
        sessionId,
        filePath,
        containerExists: !!containerRef.current
      });
      
      // 创建编辑器管理器
      const manager = new EditorManager(sessionId, filePath);
      editorRef.current = manager;
      
      // 初始化编辑器
      if (containerRef.current) {
        console.log('调用编辑器初始化方法', {
          containerWidth: containerRef.current.offsetWidth,
          containerHeight: containerRef.current.offsetHeight
        });
        await manager.initialize(containerRef.current);
        console.log('编辑器初始化完成');
        
        // 初始化搜索和过滤管理器
        const editor = manager.getEditor();
        if (editor) {
          console.log('初始化搜索管理器');
          const search = new SearchManager(editor);
          setSearchManager(search);
          
          console.log('初始化过滤管理器');
          const filter = new FilterManager(editor);
          setFilterManager(filter);
        }
      } else {
        throw new Error('编辑器容器不存在，无法初始化');
      }
      
      // 设置事件监听
      setupEventListeners(manager);
      
      // 更新状态
      setEditorState(manager.getState());
      console.log('编辑器状态已更新', manager.getState());
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('初始化编辑器失败:', errorMessage, error);
      setEditorState(prevState => ({
        ...prevState,
        error: new Error(`初始化编辑器失败: ${errorMessage}`)
      }));
      // 清理失败的初始化
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    }
  };

  // 渲染函数
  if (process.env.NODE_ENV === 'development') {
    console.log('渲染组件 - 当前状态:', {
      isLoading: editorState.isLoading,
      error: editorState.error,
      isDirty: editorState.isDirty,
      hasEditor: !!editorRef.current,
      hasContainer: !!containerRef.current
    });
  }

  // 暴露方法给父组件
  React.useImperativeHandle(ref, () => ({
    isDirty: editorRef.current?.isDirty ?? false,
    save: async () => {
      const editor = editorRef.current;
      if (!editor) return;
      
      try {
        editor.setSaving(true);
        await editor.save();
      } catch (error) {
        editor.setError(error as Error);
      } finally {
        if (editor) {
          editor.setSaving(false);
        }
      }
    }
  }), [/* 不依赖于任何状态，只依赖于editorRef.current，它是一个ref */]);

  // 处理编码变更
  const handleEncodingChange = useCallback((encoding: string) => {
    editorRef.current?.setEncoding(encoding);
  }, []);

  // 处理重新连接
  const handleReconnect = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      editor.setLoading(true);
      await editor.reload();
      editor.setConnected(true);
      editor.setError(null);
    } catch (error) {
      editor.setError(error as Error);
      editor.setConnected(false);
    } finally {
      editor.setLoading(false);
    }
  }, []);

  // 处理完整加载
  const handleLoadComplete = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    try {
      editor.setLoading(true);
      await editor.reload();
    } catch (error) {
      editor.setError(error as Error);
    } finally {
      editor.setLoading(false);
    }
  }, []);

  // 处理右键菜单
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    dispatch({ type: 'SET_CONTEXT_MENU', position: { x: event.clientX, y: event.clientY } });
  }, []);

  // 处理复制
  const handleCopy = useCallback(() => {
    editorRef.current?.executeCommand('copy');
  }, []);

  // 处理粘贴
  const handlePaste = useCallback(() => {
    editorRef.current?.executeCommand('paste');
  }, []);

  // 处理剪切
  const handleCut = useCallback(() => {
    editorRef.current?.executeCommand('cut');
  }, []);

  // 处理全选
  const handleSelectAll = useCallback(() => {
    editorRef.current?.executeCommand('selectAll');
  }, []);

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    dispatch({ type: 'SET_CONTEXT_MENU', position: null });
  }, []);

  // 检查是否有选中文本
  const hasSelection = useCallback((): boolean => {
    return editorRef.current?.hasSelection() ?? false;
  }, []);

  // 处理搜索
  const handleSearch = useCallback(() => {
    if (!searchManager) {
      console.warn('搜索管理器未初始化');
      message.warning('搜索功能暂不可用');
      return;
    }
    
    console.log('打开搜索面板');
    dispatch({ type: 'SET_SEARCH_PANEL', visible: true });
  }, [searchManager]);

  // 处理过滤
  const handleFilter = useCallback(() => {
    if (!filterManager) {
      console.warn('过滤管理器未初始化');
      message.warning('过滤功能暂不可用');
      return;
    }
    
    console.log('打开过滤面板');
    dispatch({ type: 'SET_FILTER_PANEL', visible: true });
  }, [filterManager]);

  // 处理搜索面板关闭
  const handleSearchClose = useCallback(() => {
    dispatch({ type: 'SET_SEARCH_PANEL', visible: false });
  }, []);

  // 处理过滤面板关闭
  const handleFilterClose = useCallback(() => {
    dispatch({ type: 'SET_FILTER_PANEL', visible: false });
  }, []);

  // 添加执行搜索函数
  const executeSearch = useCallback((pattern: string, options: { isRegex?: boolean, caseSensitive?: boolean, wholeWord?: boolean } = {}) => {
    if (!searchManager || !pattern) return;
    
    console.log('执行搜索:', pattern, options);
    
    searchManager.search({
      pattern,
      isRegex: options.isRegex || false,
      caseSensitive: options.caseSensitive || false,
      wholeWord: options.wholeWord || false
    }).then(results => {
      console.log(`搜索完成，找到 ${results.length} 个匹配项`);
      if (results.length > 0) {
        message.info(`找到 ${results.length} 个匹配项`);
      } else {
        message.info('未找到匹配项');
      }
    }).catch(error => {
      console.error('搜索失败:', error);
      message.error(`搜索失败: ${error instanceof Error ? error.message : String(error)}`);
    });
  }, [searchManager]);

  // 添加搜索面板UI
  const renderSearchPanel = () => {
    if (!showSearchPanel) return null;
    
    return (
      <div className="search-panel">
        <div className="panel-header">
          <h3>搜索</h3>
          <Button type="text" icon={<CloseOutlined />} onClick={handleSearchClose} />
        </div>
        <div className="panel-content">
          <Input.Search
            placeholder="请输入搜索内容"
            allowClear
            enterButton="搜索"
            size="middle"
            onSearch={(value) => executeSearch(value)}
          />
          <div className="search-options">
            <Checkbox>区分大小写</Checkbox>
            <Checkbox>使用正则表达式</Checkbox>
            <Checkbox>全词匹配</Checkbox>
          </div>
          <div className="search-stats">
            {searchManager?.getResultCount() || 0} 个匹配项
          </div>
          <div className="search-navigation">
            <Button 
              icon={<UpOutlined />} 
              disabled={!searchManager?.getResultCount()} 
              onClick={() => searchManager?.navigateToPreviousMatch()}
            >
              上一个
            </Button>
            <Button 
              icon={<DownOutlined />} 
              disabled={!searchManager?.getResultCount()} 
              onClick={() => searchManager?.navigateToNextMatch()}
            >
              下一个
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // 保存文件
  const saveFile = async (): Promise<boolean> => {
    if (!editorRef.current) return false;
    
    try {
      editorRef.current.setSaving(true);
      await editorRef.current.save();
      message.success('文件保存成功');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('保存文件失败:', errorMessage);
      message.error(`保存文件失败: ${errorMessage}`);
      return false;
    } finally {
      if (editorRef.current) {
        editorRef.current.setSaving(false);
      }
    }
  };

  // 设置事件监听
  const setupEventListeners = useCallback((manager: EditorManager) => {
    // 先移除所有现有的监听器，防止重复添加
    manager.removeAllListeners('stateChanged');
    manager.removeAllListeners('error');
    manager.removeAllListeners('contentChanged');
    
    // 监听编辑器状态变化
    manager.on('stateChanged', (state: EditorState) => {
      setEditorState(state);
    });
    
    // 监听错误事件
    manager.on('error', (error: Error) => {
      setEditorState(prevState => ({
        ...prevState,
        error
      }));
    });
    
    // 监听内容变化
    manager.on('contentChanged', () => {
      setEditorState(prevState => ({
        ...prevState,
        isDirty: true
      }));
    });
  }, []);

  // 添加模式切换函数
  const handleModeSwitch = useCallback(async (targetMode: EditorMode) => {
    if (currentMode === targetMode) {
      return; // 已经在目标模式，无需切换
    }

    try {
      console.log(`开始切换到${targetMode === EditorMode.EDIT ? '编辑' : '浏览'}模式`);
      // 使用函数式更新，避免依赖于editorState
      setEditorState(prev => ({ ...prev, isLoading: true }));
      
      // 如果是切换到编辑模式，需要保存文件
      if (targetMode === EditorMode.EDIT && editorState.isDirty) {
        const shouldSave = await new Promise<boolean>(resolve => {
          Modal.confirm({
            title: '保存文件',
            content: '切换到编辑模式前需要保存文件，是否继续？',
            onOk: () => resolve(true),
            onCancel: () => resolve(false)
          });
        });
        
        if (shouldSave) {
          await saveFile();
        } else {
          console.log('用户取消了切换');
          setEditorState(prev => ({ ...prev, isLoading: false }));
          return;
        }
      }
      
      // 使用EditorManager执行模式切换
      if (editorRef.current) {
        // 调用EditorManager的switchMode方法
        const result = await editorRef.current.switchMode(targetMode);
        
        if (result) {
          // 更新模式和状态
          dispatch({ type: 'SET_CURRENT_MODE', mode: targetMode });
          message.success(`已切换到${targetMode === EditorMode.EDIT ? '编辑' : '浏览'}模式`);
        } else {
          throw new Error('模式切换失败');
        }
      }
    } catch (error) {
      console.error('模式切换失败:', error);
      message.error(`模式切换失败: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setEditorState(prev => ({ ...prev, isLoading: false }));
    }
  }, [currentMode, editorState.isDirty, saveFile, dispatch]);

  // 处理实时更新切换
  const handleRealtimeToggle = useCallback((enabled: boolean) => {
    if (!editorRef.current) return;
    
    try {
      // 检查是否有实时更新相关方法
      if (enabled) {
        // 使用可选链和类型检查
        if (typeof editorRef.current.startRealtime === 'function') {
          editorRef.current.startRealtime();
        } else {
          console.warn('编辑器不支持实时更新功能');
        }
      } else {
        if (typeof editorRef.current.stopRealtime === 'function') {
          editorRef.current.stopRealtime();
        }
      }
      
      // 更新状态
      setEditorState(prev => ({ ...prev, isRealtime: enabled }));
    } catch (error) {
      console.error('切换实时更新失败:', error);
      message.error(`切换实时更新失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  // 处理自动滚动切换
  const handleAutoScrollToggle = useCallback((enabled: boolean) => {
    if (!editorRef.current) return;
    
    try {
      // 检查是否有自动滚动相关方法
      if (typeof editorRef.current.setAutoScroll === 'function') {
        editorRef.current.setAutoScroll(enabled);
      } else {
        // 如果没有直接方法，可以通过状态管理
        console.warn('编辑器不支持自动滚动功能');
      }
      // 更新状态
    } catch (error) {
      console.error('切换自动滚动失败:', error);
      message.error(`切换自动滚动失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  const editor = editorRef.current;

  // 返回JSX元素
  return (
    <div className="file-editor-main">
      <EditorToolbar
        currentMode={currentMode}
        onModeSwitch={handleModeSwitch}
        onSave={() => saveFile()}
        onRefresh={() => editor?.reload()}
        onSearch={(query) => {
          handleSearch();
          if (query) executeSearch(query);
        }}
        onFilter={(query) => {
          handleFilter();
          // 如果有过滤实现，可以在这里调用
        }}
        onEncodingChange={handleEncodingChange}
        onRealtimeToggle={handleRealtimeToggle}
        onAutoScrollToggle={handleAutoScrollToggle}
        isDirty={editorState.isDirty}
        encoding={editorState.encoding}
        isReadOnly={!!initialConfig?.readOnly}
        showRealtimeToggle={currentMode === EditorMode.BROWSE}
        showAutoScrollToggle={currentMode === EditorMode.BROWSE && editorState.isRealtime}
      />

      <div
        className="editor-container"
        ref={containerRef}
        onContextMenu={handleContextMenu}
        style={{ 
          flex: 1, 
          minHeight: '300px', 
          width: '100%', 
          position: 'relative',
          display: 'flex'
        }}
      />

      {editorState.isLoading && (
        <div className="loading-indicator">
          <LoadingOutlined style={{ marginRight: 8 }} />
          <span>正在加载文件...</span>
        </div>
      )}

      {editorState.error && (
        <div className="error-message">
          <div className="error-content">
            <span className="error-text">{editorState.error.message}</span>
            {!editorState.isConnected && (
              <Button
                type="primary"
                icon={<CloudOutlined />}
                onClick={handleReconnect}
              >
                重新连接
              </Button>
            )}
          </div>
        </div>
      )}

      {editorState.showLoadCompletePrompt && (
        <Alert
          message="文件较大"
          description="当前仅加载了文件的一部分。某些功能（如搜索）可能不可用。"
          type="info"
          action={
            <Button size="small" onClick={handleLoadComplete}>
              完整加载
            </Button>
          }
          closable
          onClose={() => {
            if (editor) editor.showLoadCompletePrompt = false;
          }}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 搜索面板 */}
      {renderSearchPanel()}

      {/* 过滤面板 */}
      {showFilterPanel && filterManager && (
        <FileFilterPanel
          onClose={handleFilterClose}
          filterManager={filterManager}
        />
      )}

      {contextMenu && (
        <EditorContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={handleCloseContextMenu}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onCut={handleCut}
          onSelectAll={handleSelectAll}
          hasSelection={hasSelection()}
          isReadOnly={!!initialConfig?.readOnly}
        />
      )}

      {editorState.isRefreshing && (
        <div className="refresh-indicator">
          <LoadingOutlined style={{ marginRight: 8 }} />
          <span>正在更新内容...</span>
        </div>
      )}

      {/* 状态栏 */}
      <FileStatusBar 
        currentMode={currentMode} 
        cursorPosition={editorState.cursorPosition}
        fileInfo={{
          path: filePath,
          size: 0, // 应该从实际文件信息中获取
          encoding: editorState.encoding
        }}
        isDirty={editorState.isDirty}
      />
    </div>
  );
})); 