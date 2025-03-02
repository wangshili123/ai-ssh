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
import { CloudOutlined, DisconnectOutlined, LoadingOutlined, SaveOutlined, SearchOutlined, FilterOutlined, CloseOutlined, UpOutlined, DownOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
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
  | { type: 'SET_CURRENT_MODE', mode: EditorMode }
  | { type: 'SET_LOADING', loading: boolean }
  | { type: 'SET_ERROR', error: Error | null };

function editorUIReducer(state: {
  showSearchPanel: boolean;
  showFilterPanel: boolean;
  contextMenu: { x: number; y: number } | null;
  currentMode: EditorMode;
  loading: boolean;
  error: Error | null;
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
    case 'SET_LOADING':
      return { ...state, loading: action.loading };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    default:
      return state;
  }
}

export const FileEditorMain = observer(forwardRef<FileEditorMainRef, FileEditorMainProps>((props, ref) => {
  const { filePath, sessionId, tabId, initialConfig } = props;
  const tabStore = useEditorTabStore();
  const tab = tabStore.getTab(tabId);
  
  // 编辑器实例引用
  const editorManagerRef = useRef<EditorManager | null>(null);
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
    currentMode: EditorMode.BROWSE,
    loading: false,
    error: null
  });

  const { showSearchPanel, showFilterPanel, contextMenu, currentMode, loading, error } = uiState;

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
    mode: EditorMode.BROWSE,
    isLargeFile: false,
    largeFileInfo: undefined
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
      if (editorManagerRef.current) {
        editorManagerRef.current.destroy();
        editorManagerRef.current = null;
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
    if (editorManagerRef.current) {
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
      editorManagerRef.current = manager;
      
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
          
          // 添加滚动事件监听
          console.log('设置编辑器滚动事件监听器');
          
          // 滚动事件监听器
          editor.onDidScrollChange((e) => {
            const scrollTop = e.scrollTop;
            const scrollHeight = e.scrollHeight;
            const viewPortHeight = editor.getLayoutInfo().height;
            
            // 计算滚动位置百分比
            const scrollPosition = (scrollTop + viewPortHeight) / scrollHeight;
            const isNearBottom = scrollPosition > 0.85; // 当滚动到85%以上时认为接近底部
            
            // 记录滚动位置日志
            console.log(`滚动位置: ${scrollPosition.toFixed(2)}, 接近底部: ${isNearBottom}`);
            
            // 如果接近底部，检查是否需要加载更多内容
            if (isNearBottom && editorManagerRef.current) {
              // 获取编辑器管理器当前状态，直接从引用获取
              const editorState = editorManagerRef.current.getState();
              
              // 获取编辑器React状态
              const reactState = {
                isNearBottom,
                hasMoreContent: editorState.largeFileInfo?.hasMore,
                isLoading: editorState.isLoading,
                loadedSize: editorState.largeFileInfo?.loadedSize,
                totalSize: editorState.largeFileInfo?.totalSize,
                isLargeFile: editorState.isLargeFile,
              };
              
              console.log(`滚动接近底部，状态诊断 (来自EditorManager):`, {
                isNearBottom,
                hasMoreContent: editorState.largeFileInfo?.hasMore,
                isLoading: editorState.isLoading,
                loadedSize: editorState.largeFileInfo?.loadedSize,
                totalSize: editorState.largeFileInfo?.totalSize,
                isLargeFile: editorState.isLargeFile,
              });
              
              console.log(`滚动接近底部，状态诊断 (来自React):`, reactState);
              
              // 如果是大文件，且有更多内容可加载
              if (editorState.isLargeFile && editorState.largeFileInfo?.hasMore) {
                console.log(`滚动触发加载更多内容 (基于EditorManager状态)`);
                loadMoreContent();
              } else if (editorState.isLargeFile && editorState.largeFileInfo?.hasMore) {
                console.log(`滚动触发加载更多内容 (基于React状态)`);
                loadMoreContent();
              } else if (!editorState.isLargeFile) {
                console.log(`非大文件，无需加载更多内容`);
              } else {
                // 状态不一致的情况
                if (editorState.isLargeFile !== editorState.isLargeFile) {
                  console.warn(`状态不一致: EditorManager.isLargeFile=${editorState.isLargeFile}, React.isLargeFile=${editorState.isLargeFile}`);
                }
                
                if (editorState.largeFileInfo?.hasMore !== editorState.largeFileInfo?.hasMore) {
                  console.warn(`状态不一致: EditorManager.hasMore=${editorState.largeFileInfo?.hasMore}, React.hasMore=${editorState.largeFileInfo?.hasMore}`);
                }
              }
            }
          });
        }
      } else {
        throw new Error('编辑器容器不存在，无法初始化');
      }
      
      // 设置事件监听
      setupEventListeners(manager);
      
      // 获取最新的编辑器状态
      const currentState = manager.getState();
      console.log('初始化完成后的完整编辑器状态:', {
        isLargeFile: currentState.isLargeFile,
        largeFileInfo: currentState.largeFileInfo,
        complete: currentState
      });
      
      // 更新状态
      setEditorState(currentState);
      console.log('编辑器状态已更新', currentState);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('初始化编辑器失败:', errorMessage, error);
      setEditorState(prevState => ({
        ...prevState,
        error: new Error(`初始化编辑器失败: ${errorMessage}`)
      }));
      // 清理失败的初始化
      if (editorManagerRef.current) {
        editorManagerRef.current.destroy();
        editorManagerRef.current = null;
      }
    }
  };

  /**
   * 加载更多内容
   * 用于大文件滚动加载时调用
   */
  const loadMoreContent = useCallback(async () => {
    if (!editorManagerRef.current) {
      console.error('编辑器管理器不存在，无法加载更多内容');
      return;
    }
    
    // 获取当前编辑器状态
    const currentEditorState = editorManagerRef.current.getState();
    
    console.log('加载更多内容 - 当前编辑器状态:', {
      isLargeFile: currentEditorState.isLargeFile,
      hasMore: currentEditorState.largeFileInfo?.hasMore,
      isLoading: currentEditorState.isLoading,
      loadedSize: currentEditorState.largeFileInfo?.loadedSize,
      totalSize: currentEditorState.largeFileInfo?.totalSize
    });
    
    // 如果当前正在加载，则不再触发加载
    if (currentEditorState.isLoading) {
      console.log('当前正在加载，忽略加载请求');
      return;
    }
    
    // 如果不是大文件或没有更多内容可加载，直接返回
    if (!currentEditorState.isLargeFile || !currentEditorState.largeFileInfo?.hasMore) {
      console.log('不是大文件或没有更多内容可加载，忽略加载请求');
      return;
    }
    
    try {
      console.log('开始加载更多内容...');
      
      // 记录加载前的行数
      const beforeLoadLineCount = editorManagerRef.current.getEditor()?.getModel()?.getLineCount() || 0;
      
      // 计算要加载的内容大小
      const loadedSize = currentEditorState.largeFileInfo?.loadedSize || 0;
      const totalSize = currentEditorState.largeFileInfo?.totalSize || 0;
      const remainingSize = totalSize - loadedSize;
      const chunkSize = Math.min(remainingSize, 1024 * 512); // 每次最多加载512KB
      
      console.log(`加载更多内容：起始位置 ${loadedSize}，大小 ${chunkSize} 字节，总大小 ${totalSize} 字节，剩余 ${remainingSize} 字节`);
      
      console.log('调用 EditorManager.loadMoreContent()...');
      // 调用编辑器管理器加载更多内容
      const result = await editorManagerRef.current.loadMoreContent();
      
      console.log('加载更多内容完成，结果:', result);
      
      // 记录加载后的行数
      const afterLoadLineCount = editorManagerRef.current.getEditor()?.getModel()?.getLineCount() || 0;
      
      console.log('加载后的编辑器状态:', {
        isLargeFile: editorManagerRef.current.getState().isLargeFile,
        largeFileInfo: editorManagerRef.current.getState().largeFileInfo,
        增加的行数: afterLoadLineCount - beforeLoadLineCount
      });
      
      // 如果加载成功但没有增加行数，尝试手动操作以触发重绘
      if (result && afterLoadLineCount <= beforeLoadLineCount) {
        console.warn('加载成功但内容没有更新，尝试强制刷新视图');
        const editor = editorManagerRef.current.getEditor();
        if (editor) {
          // 先获取当前滚动位置
          const currentScrollTop = editor.getScrollTop();
          // 强制布局更新
          editor.layout();
          // 滚动一小段距离然后回来，可能触发重绘
          editor.setScrollTop(currentScrollTop + 50);
          setTimeout(() => {
            if (editor) {
              editor.setScrollTop(currentScrollTop);
            }
          }, 50);
        }
      }
    } catch (err) {
      console.error('加载更多内容失败:', err);
    }
  }, [editorManagerRef]);

  // 渲染函数
  if (process.env.NODE_ENV === 'development') {
    console.log('渲染组件 - 当前状态:', {
      isLoading: editorState.isLoading,
      error: editorState.error,
      isDirty: editorState.isDirty,
      hasEditor: !!editorManagerRef.current,
      hasContainer: !!containerRef.current
    });
  }

  // 暴露方法给父组件
  React.useImperativeHandle(ref, () => ({
    isDirty: editorManagerRef.current?.isDirty ?? false,
    save: async () => {
      const editor = editorManagerRef.current;
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
  }), [/* 不依赖于任何状态，只依赖于editorManagerRef.current，它是一个ref */]);

  // 处理编码变更
  const handleEncodingChange = useCallback((encoding: string) => {
    editorManagerRef.current?.setEncoding(encoding);
  }, []);

  // 处理重新连接
  const handleReconnect = useCallback(async () => {
    const editor = editorManagerRef.current;
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
    const editor = editorManagerRef.current;
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
    editorManagerRef.current?.executeCommand('copy');
  }, []);

  // 处理粘贴
  const handlePaste = useCallback(() => {
    editorManagerRef.current?.executeCommand('paste');
  }, []);

  // 处理剪切
  const handleCut = useCallback(() => {
    editorManagerRef.current?.executeCommand('cut');
  }, []);

  // 处理全选
  const handleSelectAll = useCallback(() => {
    editorManagerRef.current?.executeCommand('selectAll');
  }, []);

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    dispatch({ type: 'SET_CONTEXT_MENU', position: null });
  }, []);

  // 检查是否有选中文本
  const hasSelection = useCallback((): boolean => {
    return editorManagerRef.current?.hasSelection() ?? false;
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
    if (!editorManagerRef.current) return false;
    
    try {
      console.log('开始保存文件，当前isDirty状态:', editorState.isDirty, '当前模式:', currentMode);
      
      // 设置为保存中状态
      setEditorState(prev => ({
        ...prev,
        isSaving: true
      }));
      
      // 调用编辑器管理器保存方法
      await editorManagerRef.current.save();
      
      // 保存成功后显式更新状态
      setEditorState(prev => ({
        ...prev,
        isDirty: false,
        isSaving: false
      }));
      
      console.log('文件保存成功，更新后的isDirty状态:', false);
      message.success('文件保存成功');
      return true;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('保存文件失败:', errorMessage);
      
      // 保存失败状态更新
      setEditorState(prev => ({
        ...prev,
        isSaving: false,
        error: new Error(errorMessage)
      }));
      
      message.error(`保存文件失败: ${errorMessage}`);
      return false;
    }
  };

  // 设置事件监听
  const setupEventListeners = useCallback((manager: EditorManager) => {
    // 先移除所有现有的监听器，防止重复添加
    manager.removeAllListeners('stateChanged');
    manager.removeAllListeners('error');
    manager.removeAllListeners('contentChanged');
    manager.removeAllListeners(EditorEvents.LARGE_FILE_DETECTED);
    manager.removeAllListeners(EditorEvents.CHUNK_LOADED);
    manager.removeAllListeners(EditorEvents.LOAD_MORE_COMPLETED);
    
    // 监听编辑器状态变化
    manager.on('stateChanged', (state: EditorState) => {
      // 始终记录重要的状态变化，而不仅仅在开发环境
      console.log('收到编辑器状态变化事件:', {
        isDirty: state.isDirty,
        mode: state.mode,
        isLoading: state.isLoading,
        isLargeFile: state.isLargeFile,
        largeFileInfo: state.largeFileInfo ? {
          loadedSize: state.largeFileInfo.loadedSize,
          totalSize: state.largeFileInfo.totalSize,
          hasMore: state.largeFileInfo.hasMore
        } : undefined
      });
      
      // 当 isLargeFile 状态变化时，特别标记出来
      if (editorState.isLargeFile !== state.isLargeFile) {
        console.log(`isLargeFile 状态从 ${editorState.isLargeFile} 变为 ${state.isLargeFile}`);
      }
      
      // 当 largeFileInfo 状态变化时，特别标记出来
      if (JSON.stringify(editorState.largeFileInfo) !== JSON.stringify(state.largeFileInfo)) {
        console.log('largeFileInfo 状态变化:', {
          old: editorState.largeFileInfo,
          new: state.largeFileInfo
        });
      }
      
      // 更新状态
      setEditorState(state);
      
      // 在状态更新后，再次检查是否需要加载更多内容
      // 这是为了确保状态变化后立即响应
      if (state.isLargeFile && state.largeFileInfo?.hasMore && !state.isLoading) {
        console.log('状态更新后检测到可加载更多内容');
      }
    });
    
    // 监听错误事件
    manager.on('error', (error: Error) => {
      console.log('收到编辑器错误事件:', error.message);
      setEditorState(prevState => ({
        ...prevState,
        error
      }));
    });
    
    // 监听内容变化事件（虽然现在通过stateChanged事件处理，这里作为备份）
    manager.on('contentChanged', () => {
      console.log('收到编辑器内容变化事件，设置isDirty为true');
      setEditorState(prevState => ({
        ...prevState,
        isDirty: true
      }));
    });
    
    // 监听大文件检测事件
    manager.on(EditorEvents.LARGE_FILE_DETECTED, (data) => {
      console.log('检测到大文件:', data);
      setEditorState(prevState => ({
        ...prevState,
        isLargeFile: true,
        showLoadCompletePrompt: true
      }));
    });
    
    // 监听块加载事件
    manager.on(EditorEvents.CHUNK_LOADED, (data) => {
      console.log('块加载完成:', data);
      setEditorState(prevState => ({
        ...prevState,
        largeFileInfo: {
          loadedSize: data.endPosition,
          totalSize: data.totalSize,
          hasMore: data.hasMore
        }
      }));
    });
    
    // 监听加载更多完成事件
    manager.on(EditorEvents.LOAD_MORE_COMPLETED, (data) => {
      console.log('加载更多内容完成:', data);
      if (data.isComplete) {
        setEditorState(prevState => ({
          ...prevState,
          showLoadCompletePrompt: false,
          largeFileInfo: {
            loadedSize: prevState.largeFileInfo?.loadedSize || 0,
            totalSize: prevState.largeFileInfo?.totalSize || 0,
            hasMore: false,
            isComplete: true
          }
        }));
      }
    });
    
    console.log('编辑器事件监听器设置完成');
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
      
      // 如果是切换到只读模式，需要保存文件
      if (targetMode === EditorMode.BROWSE && editorState.isDirty) {
        const shouldSave = await new Promise<boolean>(resolve => {
          Modal.confirm({
            title: '保存文件',
            content: '切换到只读模式前需要保存文件，是否继续？',
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
      if (editorManagerRef.current) {
        // 调用EditorManager的switchMode方法
        const result = await editorManagerRef.current.switchMode(targetMode);
        
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
    if (!editorManagerRef.current) return;
    
    try {
      // 检查是否有实时更新相关方法
      if (enabled) {
        // 使用可选链和类型检查
        if (typeof editorManagerRef.current.startRealtime === 'function') {
          editorManagerRef.current.startRealtime();
        } else {
          console.warn('编辑器不支持实时更新功能');
        }
      } else {
        if (typeof editorManagerRef.current.stopRealtime === 'function') {
          editorManagerRef.current.stopRealtime();
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
    if (!editorManagerRef.current) return;
    
    try {
      // 检查是否有自动滚动相关方法
      if (typeof editorManagerRef.current.setAutoScroll === 'function') {
        editorManagerRef.current.setAutoScroll(enabled);
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

  const editor = editorManagerRef.current;

  // 使用useEffect监视isDirty状态变化
  useEffect(() => {
    console.log('editorState.isDirty状态变化:', editorState.isDirty);
  }, [editorState.isDirty]);

  // 返回JSX元素
  return (
    <div className="file-editor-main">
      <EditorToolbar
        currentMode={currentMode}
        onModeSwitch={handleModeSwitch}
        onSave={() => saveFile()}
        onRefresh={() => editorManagerRef.current?.reload()}
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
          description={
            <>
              <p>当前已加载: {editorState.largeFileInfo ? `${Math.round(editorState.largeFileInfo.loadedSize / 1024)}KB / ${Math.round(editorState.largeFileInfo.totalSize / 1024)}KB` : '未知'}</p>
              <p>滚动到底部会自动加载更多内容，某些功能（如搜索）可能仅对已加载内容有效。</p>
            </>
          }
          type="info"
          action={
            <Space>
              <Button 
                size="small" 
                onClick={loadMoreContent}
                disabled={editorState.isLoading || !editorState.largeFileInfo?.hasMore}
              >
                {editorState.isLoading ? '加载中...' : '加载更多'}
              </Button>
              <Button 
                size="small" 
                type="primary" 
                onClick={handleLoadComplete}
              >
                完整加载
              </Button>
            </Space>
          }
          closable
          onClose={() => {
            if (editorManagerRef.current) editorManagerRef.current.showLoadCompletePrompt = false;
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

      {/* 大文件底部加载指示器 */}
      {editorState.isLargeFile && editorState.largeFileInfo?.hasMore && !editorState.showLoadCompletePrompt && (
        <div className="load-more-indicator">
          <Button 
            type="link" 
            icon={<LoadingOutlined style={{ marginRight: 8, display: editorState.isLoading ? 'inline-block' : 'none' }} />} 
            onClick={loadMoreContent}
            disabled={editorState.isLoading}
          >
            {editorState.isLoading ? '加载中...' : '点击加载更多'}
          </Button>
        </div>
      )}

      {/* 状态栏 */}
      <FileStatusBar
        currentMode={currentMode}
        cursorPosition={editorState.cursorPosition}
        fileInfo={{
          path: filePath,
          size: editorState.largeFileInfo?.totalSize || 0,
          encoding: editorState.encoding
        }}
        isDirty={editorState.isDirty}
        isAutoScroll={editorState.isRealtime}
      />
    </div>
  );
})); 