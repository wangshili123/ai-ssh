/**
 * 双模式编辑器组件
 * 支持浏览模式和编辑模式，根据文件大小自动选择合适的模式
 */

import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { observer } from 'mobx-react';
import { Alert, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import { 
  EditorMode, 
  RemoteFileInfo, 
  SearchConfig, 
  FilterConfig, 
  EditorEvents,
  EditorErrorType,
  EditorConfig
} from '../../types/FileEditorTypes';
import { DualModeEditorProps, DualModeEditorRef, EditorState } from './DualModeEditorTypes';
import { FileEditorManager } from '../../core/FileEditorManager';
import { ErrorManager } from '../../core/ErrorManager';
import EditorToolbar from '../EditorToolbar/EditorToolbar';
import FileStatusBar from '../FileStatusBar/FileStatusBarExport';
import './DualModeEditorStyles.css';

// 默认模式切换阈值（5MB）
const DEFAULT_MODE_SWITCH_THRESHOLD = 5 * 1024 * 1024;

/**
 * 双模式编辑器组件
 */
export const DualModeEditor = observer(forwardRef<DualModeEditorRef, DualModeEditorProps>((props, ref) => {
  const { filePath, sessionId, tabId, initialConfig } = props;
  
  // 编辑器状态
  const [state, setState] = useState<EditorState>({
    currentMode: initialConfig?.initialMode || EditorMode.BROWSE,
    isLoading: true,
    isDirty: false,
    readOnly: initialConfig?.readOnly || false,
    encoding: initialConfig?.encoding || 'UTF-8',
    isRealtime: false,
    isAutoScroll: false,
    cursorPosition: { line: 1, column: 1 },
    fileInfo: null,
    error: null
  });
  
  // 编辑器管理器引用
  const editorManagerRef = useRef<FileEditorManager | null>(null);
  const browseContainerRef = useRef<HTMLDivElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);
  
  // 初始化编辑器管理器
  useEffect(() => {
    const initEditor = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }));
        
        // 创建错误管理器
        const errorManager = new ErrorManager();
        
        // 创建编辑器管理器
        const config: EditorConfig = {
          theme: 'vs',
          fontSize: 14,
          lineHeight: 1.5,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: 'off',
          autoIndent: true,
          formatOnType: false,
          formatOnPaste: false,
          autoSave: false,
          autoSaveInterval: 30000,
          largeFileSize: 10 * 1024 * 1024,
          maxFileSize: 50 * 1024 * 1024
        };
        
        const editorManager = new FileEditorManager(filePath, sessionId, config);
        
        // 注册事件监听器
        editorManager.on(EditorEvents.MODE_SWITCHING_COMPLETED, (data: any) => {
          setState(prev => ({ ...prev, currentMode: data.mode }));
        });
        
        editorManager.on(EditorEvents.FILE_LOADED, (data: any) => {
          setState(prev => ({ ...prev, fileInfo: data }));
        });
        
        editorManager.on(EditorEvents.CURSOR_MOVED, (position: { line: number, column: number }) => {
          setState(prev => ({ ...prev, cursorPosition: position }));
        });
        
        editorManager.on(EditorEvents.CONTENT_CHANGED, (data: any) => {
          setState(prev => ({ ...prev, isDirty: data.isModified }));
        });
        
        editorManager.on(EditorEvents.ERROR_OCCURRED, (error: any) => {
          setState(prev => ({ ...prev, error: error.message }));
        });
        
        // 加载文件
        await editorManager.loadFile();
        
        // 保存编辑器管理器引用
        editorManagerRef.current = editorManager;
        
        // 更新状态
        setState(prev => ({ 
          ...prev, 
          isLoading: false,
          currentMode: editorManager.getCurrentMode()
        }));
      } catch (error) {
        console.error('初始化编辑器失败:', error);
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: error instanceof Error ? error.message : '初始化编辑器失败'
        }));
      }
    };
    
    initEditor();
    
    // 清理函数
    return () => {
      if (editorManagerRef.current) {
        editorManagerRef.current.dispose();
        editorManagerRef.current = null;
      }
    };
  }, [filePath, sessionId, initialConfig]);
  
  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    isDirty: state.isDirty,
    
    save: async () => {
      if (!editorManagerRef.current) return false;
      try {
        if (state.currentMode === EditorMode.EDIT) {
          const result = await editorManagerRef.current.saveFile();
          return result;
        }
        return true;
      } catch (error) {
        console.error('保存文件失败:', error);
        return false;
      }
    },
    
    refresh: async () => {
      if (!editorManagerRef.current) return false;
      try {
        const result = await editorManagerRef.current.loadFile();
        return result;
      } catch (error) {
        console.error('刷新文件失败:', error);
        return false;
      }
    },
    
    getCurrentMode: () => {
      return state.currentMode;
    },
    
    switchMode: async (mode: EditorMode) => {
      if (!editorManagerRef.current) return false;
      try {
        const result = await editorManagerRef.current.switchToMode(mode);
        return result.success;
      } catch (error) {
        console.error('切换模式失败:', error);
        return false;
      }
    },
    
    getFileInfo: () => {
      if (!editorManagerRef.current || !state.fileInfo) return null;
      return state.fileInfo;
    }
  }));
  
  // 处理模式切换
  const handleModeSwitch = useCallback(async (mode: EditorMode) => {
    if (!editorManagerRef.current) return;
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const result = await editorManagerRef.current.switchToMode(mode);
      setState(prev => ({ ...prev, isLoading: false }));
      return result.success;
    } catch (error) {
      console.error('切换模式失败:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : '切换模式失败'
      }));
      return false;
    }
  }, []);
  
  // 处理保存
  const handleSave = useCallback(async () => {
    if (!editorManagerRef.current) return false;
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const result = await editorManagerRef.current.saveFile();
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      console.error('保存文件失败:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : '保存文件失败'
      }));
      return false;
    }
  }, []);
  
  // 处理刷新
  const handleRefresh = useCallback(async () => {
    if (!editorManagerRef.current) return false;
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      const result = await editorManagerRef.current.loadFile();
      setState(prev => ({ ...prev, isLoading: false }));
      return result;
    } catch (error) {
      console.error('刷新文件失败:', error);
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        error: error instanceof Error ? error.message : '刷新文件失败'
      }));
      return false;
    }
  }, []);
  
  // 处理搜索
  const handleSearch = useCallback((pattern: string) => {
    if (!editorManagerRef.current) return;
    const searchConfig: SearchConfig = {
      pattern,
      isRegex: false,
      caseSensitive: false,
      wholeWord: false
    };
    editorManagerRef.current.search(searchConfig);
  }, []);
  
  // 处理过滤
  const handleFilter = useCallback((pattern: string) => {
    if (!editorManagerRef.current || state.currentMode !== EditorMode.BROWSE) return;
    const filterConfig: FilterConfig = {
      pattern,
      isRegex: false,
      caseSensitive: false
    };
    if (state.currentMode === EditorMode.BROWSE) {
      editorManagerRef.current.applyFilter(filterConfig);
    }
  }, [state.currentMode]);
  
  // 处理编码变更
  const handleEncodingChange = useCallback((encoding: string) => {
    if (!editorManagerRef.current) return;
    editorManagerRef.current.setEncoding(encoding as BufferEncoding);
    setState(prev => ({ ...prev, encoding }));
  }, []);
  
  // 处理实时模式切换
  const handleRealtimeToggle = useCallback((enabled: boolean) => {
    if (!editorManagerRef.current || state.currentMode !== EditorMode.BROWSE) return;
    if (enabled) {
      editorManagerRef.current.startRealtime();
    } else {
      editorManagerRef.current.stopRealtime();
    }
    setState(prev => ({ ...prev, isRealtime: enabled }));
  }, [state.currentMode]);
  
  // 处理自动滚动切换
  const handleAutoScrollToggle = useCallback((enabled: boolean) => {
    if (!editorManagerRef.current || state.currentMode !== EditorMode.BROWSE) return;
    // 目前FileEditorManager没有直接的setAutoScroll方法，可能需要在BrowseMode中实现
    // 这里先更新状态
    setState(prev => ({ ...prev, isAutoScroll: enabled }));
  }, [state.currentMode]);
  
  // 获取浏览模式信息
  const getBrowseInfo = useCallback(() => {
    if (!editorManagerRef.current || state.currentMode !== EditorMode.BROWSE) {
      return undefined;
    }
    
    // 由于BrowseMode没有直接的getLoadedLines和getFilteredLines方法
    // 这里返回一个基本的信息对象
    return {
      totalLines: 0, // 需要实现获取总行数的方法
      loadedLines: 0, // 需要实现获取已加载行数的方法
      filteredLines: undefined // 需要实现获取已过滤行数的方法
    };
  }, [state.currentMode]);
  
  // 获取编辑模式信息
  const getEditInfo = useCallback(() => {
    if (!editorManagerRef.current || state.currentMode !== EditorMode.EDIT) {
      return undefined;
    }
    
    // 由于EditMode没有直接的getTotalLines、getSelectedText和getSelectionRange方法
    // 这里返回一个基本的信息对象
    return {
      totalLines: 0, // 需要实现获取总行数的方法
      selectedText: undefined, // 需要实现获取选中文本的方法
      selectionRange: undefined // 需要实现获取选择范围的方法
    };
  }, [state.currentMode]);
  
  return (
    <div className="dual-mode-editor">
      {/* 工具栏 */}
      <div className="dual-mode-editor-toolbar">
        <EditorToolbar
          currentMode={state.currentMode}
          onModeSwitch={handleModeSwitch}
          onSave={handleSave}
          onRefresh={handleRefresh}
          onSearch={handleSearch}
          onFilter={handleFilter}
          onEncodingChange={handleEncodingChange}
          onRealtimeToggle={handleRealtimeToggle}
          onAutoScrollToggle={handleAutoScrollToggle}
        />
      </div>
      
      {/* 编辑器主容器 */}
      <div className="dual-mode-editor-container">
        {/* 错误提示 */}
        {state.error && (
          <Alert
            message="错误"
            description={state.error}
            type="error"
            showIcon
            closable
            className="dual-mode-editor-error"
            onClose={() => setState(prev => ({ ...prev, error: null }))}
          />
        )}
        
        {/* 模式切换动画 */}
        <SwitchTransition mode="out-in">
          <CSSTransition
            key={state.currentMode}
            timeout={300}
            classNames="mode-transition"
            unmountOnExit
          >
            {state.currentMode === EditorMode.BROWSE ? (
              <div ref={browseContainerRef} className="browse-mode-container" />
            ) : (
              <div ref={editContainerRef} className="edit-mode-container" />
            )}
          </CSSTransition>
        </SwitchTransition>
        
        {/* 加载中遮罩 */}
        {state.isLoading && (
          <div className="dual-mode-editor-loading">
            <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
            <div className="loading-text">加载中...</div>
          </div>
        )}
      </div>
      
      {/* 状态栏 */}
      <FileStatusBar
        currentMode={state.currentMode}
        cursorPosition={state.cursorPosition}
        fileInfo={state.fileInfo ? {
          path: state.fileInfo.path,
          size: state.fileInfo.size,
          encoding: state.encoding,
          modified: state.fileInfo.modifyTime ? new Date(state.fileInfo.modifyTime) : undefined
        } : {
          path: filePath,
          size: 0,
          encoding: state.encoding
        }}
        browseInfo={getBrowseInfo()}
        editInfo={getEditInfo()}
        readOnly={state.readOnly}
        isDirty={state.isDirty}
      />
    </div>
  );
}));

export default DualModeEditor; 