/**
 * 文件编辑器主组件
 * 负责文件内容的显示、编辑和各种交互功能
 */

import React, { useEffect, useRef, useState, useCallback, forwardRef } from 'react';
import { observer } from 'mobx-react';
import * as monaco from 'monaco-editor';
import { FileEditorManager } from '../../core/FileEditorManager';
import { FileWatchManager } from '../../core/FileWatchManager';
import { EditorErrorType, EditorEvents, RemoteFileInfo } from '../../types/FileEditorTypes';
import { useEditorStore } from '../../store/FileEditorStore';
import { ErrorManager, ErrorType } from '../../core/ErrorManager';
import './FileEditorMain.css';
import { EditorContextMenu } from '../ContextMenu/EditorContextMenu';
import { Alert, Button, Select, Space, Tooltip } from 'antd';
import { CloudOutlined, DisconnectOutlined, LoadingOutlined, SaveOutlined } from '@ant-design/icons';
import { FileEditorToolbar } from '../FileEditorToolbar/FileEditorToolbar';
import { FileStatusBar } from '../FileStatusBar/FileStatusBar';
import { FileEditorStore, EditorStoreContext } from '../../store/FileEditorStore';
import { sftpService } from '../../../../../services/sftp';
import { FileSearchPanel } from '../FileSearchPanel/FileSearchPanel';
import { FileFilterPanel } from '../FileFilterPanel/FileFilterPanel';

interface FileEditorMainProps {
  filePath: string;
  sessionId: string;
  initialConfig?: {
    readOnly?: boolean;
    encoding?: string;
  };
}

export interface FileEditorMainRef {
  isDirty: boolean;
  save: () => Promise<void>;
}

const FileEditorMainInner = observer(forwardRef<FileEditorMainRef, FileEditorMainProps>((props, ref) => {
  const { filePath, sessionId, initialConfig } = props;
  
  // 编辑器实例引用
  const editorRef = useRef<FileEditorManager | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 管理器实例
  const [fileWatcher, setFileWatcher] = useState<FileWatchManager | null>(null);
  
  // Store
  const editorStore = useEditorStore();

  // 错误管理器实例
  const errorManager = useRef<ErrorManager>(new ErrorManager());

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  
  // 文件状态
  const [isPartiallyLoaded, setIsPartiallyLoaded] = useState(false);
  const [showLoadCompletePrompt, setShowLoadCompletePrompt] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // 初始化 store
  useEffect(() => {
    editorStore.setCurrentFile(filePath);
    editorStore.setSessionInfo({
      sessionId,
      connectionId: sessionId,
      isConnected: true,
      lastError: null
    });
  }, [filePath, sessionId]);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;

    // 创建错误管理器
    const manager = new ErrorManager({
      maxRetries: 3,
      retryDelay: 1000,
      autoRetry: true
    });

    // 创建编辑器管理器
    const editor = new FileEditorManager(manager, {
      theme: 'vs-dark',
      readOnly: initialConfig?.readOnly,
      encoding: initialConfig?.encoding
    });

    // 创建文件监控管理器
    const watcher = new FileWatchManager();

    editorRef.current = editor;
    setFileWatcher(watcher);

    // 初始化编辑器
    const initEditor = async () => {
      try {
        // 先获取文件信息
        const stats = await sftpService.stat(sessionId, filePath);
        const fileInfo = {
          size: stats.size,
          modifyTime: stats.modifyTime,
          isDirectory: stats.isDirectory,
          permissions: stats.permissions,
          encoding: initialConfig?.encoding || 'UTF-8',
          isPartiallyLoaded: false
        };
        editorStore.setFileInfo(fileInfo);

        // 然后初始化编辑器
        await editor.initialize(containerRef.current!, sessionId, filePath);
      } catch (error) {
        editorStore.setError(error as Error);
      }
    };

    initEditor();

    // 监听编辑器事件
    editor.on(EditorEvents.CONTENT_CHANGED, () => {
      editorStore.setDirty(true);
    });

    editor.on(EditorEvents.FILE_LOADED, (content: string) => {
      editorStore.setLoading(false);
    });

    editor.on(EditorEvents.FILE_SAVED, () => {
      editorStore.setDirty(false);
      editorStore.setSaving(false);
    });

    editor.on(EditorEvents.ENCODING_CHANGED, (encoding: string) => {
      editorStore.setEncoding(encoding);
    });

    editor.on(EditorEvents.CONNECTION_LOST, () => {
      editorStore.setError(new Error('连接已断开'));
      editorStore.setConnected(false);
    });

    editor.on('cursorChanged', (position: { line: number; column: number }) => {
      editorStore.setCursorPosition(position);
    });

    // 监听文件变化
    watcher.on(EditorEvents.FILE_CHANGED, async () => {
      if (editorStore.isRealtime) {
        try {
          await editor.reload();
        } catch (error) {
          editorStore.setError(error as Error);
        }
      }
    });

    // 开始文件监控
    watcher.startWatch(sessionId, filePath).catch(error => {
      editorStore.setError(error as Error);
    });

    // 清理函数
    return () => {
      editor.destroy();
      watcher.destroy();
    };
  }, [filePath, sessionId, initialConfig, editorStore]);

  // 暴露方法给父组件
  React.useImperativeHandle(ref, () => ({
    isDirty: editorStore.isDirty,
    save: async () => {
      if (!editorRef.current) return;
      
      try {
        editorStore.setSaving(true);
        await editorRef.current.save();
      } catch (error) {
        editorStore.setError(error as Error);
      }
    }
  }));

  // 处理编码变更
  const handleEncodingChange = useCallback((encoding: string) => {
    if (!editorRef.current) return;
    editorRef.current.setEncoding(encoding);
  }, []);

  // 处理重新连接
  const handleReconnect = useCallback(async () => {
    try {
      await editorStore.reconnect();
      if (editorRef.current) {
        await editorRef.current.reload();
      }
    } catch (error) {
      editorStore.setError(error as Error);
    }
  }, [editorStore]);

  // 处理完整加载
  const handleLoadComplete = useCallback(async () => {
    if (!editorRef.current) return;

    try {
      editorStore.setLoading(true);
      await editorRef.current.reload();
      setIsPartiallyLoaded(false);
      setShowLoadCompletePrompt(false);
    } catch (error) {
      editorStore.setError(error as Error);
    } finally {
      editorStore.setLoading(false);
    }
  }, [editorStore]);

  // 处理右键菜单
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    if (editorRef.current) {
      setContextMenu({
        x: event.clientX,
        y: event.clientY
      });
    }
  }, []);

  // 处理复制
  const handleCopy = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.executeCommand('copy');
    }
  }, []);

  // 处理粘贴
  const handlePaste = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.executeCommand('paste');
    }
  }, []);

  // 处理剪切
  const handleCut = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.executeCommand('cut');
    }
  }, []);

  // 处理全选
  const handleSelectAll = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.executeCommand('selectAll');
    }
  }, []);

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 检查是否有选中文本
  const hasSelection = useCallback((): boolean => {
    const editor = editorRef.current;
    if (editor) {
      return editor.hasSelection();
    }
    return false;
  }, []);

  // 处理搜索
  const handleSearch = useCallback(() => {
    setShowSearchPanel(true);
  }, []);

  // 处理过滤
  const handleFilter = useCallback(() => {
    setShowFilterPanel(true);
  }, []);

  // 处理搜索面板关闭
  const handleSearchClose = useCallback(() => {
    setShowSearchPanel(false);
  }, []);

  // 处理过滤面板关闭
  const handleFilterClose = useCallback(() => {
    setShowFilterPanel(false);
  }, []);

  return (
    <div className="file-editor-main">
      {editorStore.isLoading ? (
        <div className="loading-indicator">
          <LoadingOutlined style={{ marginRight: 8 }} />
          <span>正在加载文件...</span>
        </div>
      ) : editorStore.error ? (
        <div className="error-message">
          <div className="error-content">
            <span className="error-text">{editorStore.error.message}</span>
            {!editorStore.isConnected && (
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
      ) : (
        <>
          <FileEditorToolbar
            onSave={() => editorRef.current?.save()}
            onReconnect={handleReconnect}
            onSearch={handleSearch}
            onFilter={handleFilter}
          />

          {showLoadCompletePrompt && (
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
              onClose={() => setShowLoadCompletePrompt(false)}
              style={{ marginBottom: 16 }}
            />
          )}

          <div
            className="editor-container"
            ref={containerRef}
            onContextMenu={handleContextMenu}
          />

          {/* 搜索面板 */}
          {showSearchPanel && (
            <FileSearchPanel
              searchManager={editorRef.current?.getSearchManager() || null}
              onClose={handleSearchClose}
            />
          )}

          {/* 过滤面板 */}
          {showFilterPanel && (
            <FileFilterPanel
              filterManager={editorRef.current?.getFilterManager() || null}
              onClose={handleFilterClose}
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

          {editorStore.isRefreshing && (
            <div className="refresh-indicator">
              <LoadingOutlined style={{ marginRight: 8 }} />
              <span>正在更新内容...</span>
            </div>
          )}

          <FileStatusBar cursorPosition={editorStore.cursorPosition} />
        </>
      )}
    </div>
  );
}));

export const FileEditorMain = forwardRef<FileEditorMainRef, FileEditorMainProps>((props, ref) => {
  const store = new FileEditorStore();

  return (
    <EditorStoreContext.Provider value={store}>
      <FileEditorMainInner {...props} ref={ref} />
    </EditorStoreContext.Provider>
  );
}); 