/**
 * 文件编辑器主组件
 * 负责文件内容的显示、编辑和各种交互功能
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { observer } from 'mobx-react';
import * as monaco from 'monaco-editor';
import { FileLoaderManager } from '../../core/FileLoaderManager';
import { FileWatchManager } from '../../core/FileWatchManager';
import { EditorErrorType, EditorEvents } from '../../types/FileEditorTypes';
import { useEditorStore } from '../../store/FileEditorStore';
import { VirtualScroller, ScrollConfig } from '../../core/VirtualScroller';
import { ErrorManager, ErrorInfo, ErrorType } from '../../core/ErrorManager';
import './FileEditorMain.css';
import { EditorContextMenu } from '../ContextMenu/EditorContextMenu';

interface FileEditorMainProps {
  filePath: string;
  initialConfig?: {
    readOnly?: boolean;
    filter?: {
      pattern: string;
      isRegex: boolean;
      caseSensitive: boolean;
    };
  };
}

export interface FileEditorMainRef {
  isDirty: boolean;
  save: () => Promise<void>;
}

export const FileEditorMain = React.forwardRef<FileEditorMainRef, FileEditorMainProps>((props, ref) => {
  const { filePath, initialConfig } = props;
  
  // 编辑器实例引用
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 管理器实例
  const [fileLoader, setFileLoader] = useState<FileLoaderManager | null>(null);
  const [fileWatcher, setFileWatcher] = useState<FileWatchManager | null>(null);
  
  // Store
  const editorStore = useEditorStore();

  // VirtualScroller 实例
  const [scroller, setScroller] = useState<VirtualScroller | null>(null);

  // 错误管理器实例
  const errorManager = useRef<ErrorManager>(new ErrorManager());

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  
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
      const action = editor.getAction('editor.action.clipboardCopyAction');
      action?.run();
    }
  }, []);

  // 处理粘贴
  const handlePaste = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      const action = editor.getAction('editor.action.clipboardPasteAction');
      action?.run();
    }
  }, []);

  // 处理剪切
  const handleCut = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      const action = editor.getAction('editor.action.clipboardCutAction');
      action?.run();
    }
  }, []);

  // 处理全选
  const handleSelectAll = useCallback(() => {
    const editor = editorRef.current;
    if (editor) {
      const action = editor.getAction('editor.action.selectAll');
      action?.run();
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
      const selection = editor.getSelection();
      return selection ? !selection.isEmpty() : false;
    }
    return false;
  }, []);

  // 处理文件监控错误
  const handleWatchError = useCallback((error: Error) => {
    errorManager.current.handleError(error, ErrorType.OPERATION_FAILED);
    editorStore.setErrorRecoverable(true);
  }, [editorStore]);

  // 初始化文件监控
  const initializeFileWatch = useCallback(async () => {
    try {
      if (!fileWatcher) {
        return;
      }
      await fileWatcher.startWatch(filePath);
      editorStore.setRefreshing(true);
    } catch (error) {
      errorManager.current.handleError(error as Error, ErrorType.OPERATION_FAILED);
    } finally {
      editorStore.setRefreshing(false);
    }
  }, [filePath, fileWatcher, editorStore]);

  // 初始化编辑器
  useEffect(() => {
    if (!containerRef.current) return;

    // 创建编辑器实例
    const editor = monaco.editor.create(containerRef.current, {
      value: '',
      language: 'plaintext',
      theme: 'vs-dark',
      readOnly: initialConfig?.readOnly ?? false,
      wordWrap: 'on',
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true
    });

    editorRef.current = editor;

    // 创建文件加载管理器
    const loader = new FileLoaderManager(filePath, errorManager.current);
    setFileLoader(loader);

    // 创建文件监控管理器
    const watcher = new FileWatchManager();
    setFileWatcher(watcher);

    // 创建虚拟滚动管理器
    const scrollerConfig: ScrollConfig = {
      blockSize: 100,
      preloadBlocks: 2,
      lineHeight: 20,
      containerHeight: containerRef.current.clientHeight,
      totalLines: 0
    };
    const virtualScroller = new VirtualScroller(scrollerConfig);
    setScroller(virtualScroller);

    // 监听文件加载事件
    loader.on(EditorEvents.FILE_LOADED, (content: string[]) => {
      if (editorRef.current) {
        editorRef.current.setValue(content.join('\n'));
        editorStore.setLoading(false);
      }
    });

    // 监听文件变化事件
    watcher.on(EditorEvents.FILE_CHANGED, async () => {
      if (editorStore.isRealtime) {
        editorStore.setRefreshing(true);
        try {
          const chunk = await loader.loadChunk(0, 1000); // 重新加载前1000行
          if (editorRef.current) {
            const model = editorRef.current.getModel();
            if (model) {
              const currentPosition = editorRef.current.getPosition();
              model.setValue(chunk.content.join('\n'));
              
              // 如果启用了自动滚动，滚动到底部
              if (editorStore.isAutoScroll) {
                editorRef.current.revealLine(model.getLineCount());
              } else if (currentPosition) {
                // 否则保持当前位置
                editorRef.current.setPosition(currentPosition);
              }
            }
          }
        } catch (error) {
          editorStore.setError(new Error(EditorErrorType.WATCH_ERROR));
        } finally {
          editorStore.setRefreshing(false);
        }
      }
    });

    // 监听错误事件
    const handleError = (error: Error) => {
      editorStore.setError(error);
      editorStore.setLoading(false);
      editorStore.setRefreshing(false);
    };

    loader.on(EditorEvents.ERROR_OCCURRED, handleError);
    watcher.on(EditorEvents.ERROR_OCCURRED, handleError);

    // 初始化加载
    initializeEditor(loader, watcher);

    return () => {
      editor.dispose();
      loader.removeAllListeners();
      watcher.destroy();
      virtualScroller.clearLoadedBlocks();
    };
  }, [filePath]);

  // 初始化编辑器内容
  const initializeEditor = async (loader: FileLoaderManager, watcher: FileWatchManager) => {
    try {
      editorStore.setLoading(true);
      
      // 获取文件信息
      const fileInfo = await loader.getFileInfo();
      
      // 如果有初始过滤条件，应用它
      if (initialConfig?.filter) {
        loader.applyFilter(initialConfig.filter);
        editorStore.setFilterActive(true);
      }

      // 加载第一块内容
      const firstChunk = await loader.loadChunk(0, 1000);
      if (editorRef.current) {
        editorRef.current.setValue(firstChunk.content.join('\n'));
      }

      // 如果启用了实时模式，开始监控文件
      if (editorStore.isRealtime) {
        watcher.startWatch(filePath);
      }

      editorStore.setLoading(false);
    } catch (error) {
      editorStore.setError(error as Error);
      editorStore.setLoading(false);
    }
  };

  // 监听实时模式变化
  useEffect(() => {
    if (!fileWatcher) return;

    if (editorStore.isRealtime) {
      fileWatcher.startWatch(filePath);
    } else {
      fileWatcher.stopWatch();
    }
  }, [editorStore.isRealtime, fileWatcher, filePath]);

  // 处理滚动事件，实现虚拟滚动
  useEffect(() => {
    if (!editorRef.current || !fileLoader || !scroller) return;

    const handleScroll = async () => {
      const scrollTop = editorRef.current!.getScrollTop();
      const { blocksToLoad, blocksToRelease } = scroller.calculateScrollState(scrollTop);

      // 加载需要显示的块
      for (const blockIndex of blocksToLoad) {
        const [startLine, endLine] = scroller.getBlockRange(blockIndex);
        try {
          const chunk = await fileLoader.loadChunk(startLine, endLine);
          const model = editorRef.current!.getModel();
          if (model) {
            const lines = model.getLinesContent();
            const newLines = lines.slice(0, startLine).concat(chunk.content, lines.slice(endLine));
            model.setValue(newLines.join('\n'));
          }
        } catch (error) {
          errorManager.current.handleError(error as Error);
        }
      }

      // 释放不再需要的块
      for (const blockIndex of blocksToRelease) {
        const [startLine, endLine] = scroller.getBlockRange(blockIndex);
        const model = editorRef.current!.getModel();
        if (model) {
          const lines = model.getLinesContent();
          const newLines = lines.slice(0, startLine).concat(Array(endLine - startLine).fill(''), lines.slice(endLine));
          model.setValue(newLines.join('\n'));
        }
      }
    };

    const scrollDisposable = editorRef.current.onDidScrollChange(handleScroll);
    return () => scrollDisposable.dispose();
  }, [fileLoader, scroller]);

  // 监听错误管理器事件
  useEffect(() => {
    const handleError = (errorInfo: ErrorInfo) => {
      editorStore.setError(new Error(errorInfo.message));
      
      // 如果错误可恢复，显示重试按钮
      if (errorInfo.recoverable) {
        editorStore.setErrorRecoverable(true);
      }
    };

    const handleRetry = async () => {
      editorStore.setError(null);
      editorStore.setErrorRecoverable(false);
      
      // 根据错误类型执行不同的重试操作
      const currentError = errorManager.current.getCurrentError();
      if (currentError) {
        switch (currentError.type) {
          case ErrorType.FILE_NOT_FOUND:
          case ErrorType.FILE_PERMISSION_DENIED:
          case ErrorType.FILE_LOCKED:
            // 重新初始化编辑器
            if (fileLoader && fileWatcher) {
              await initializeEditor(fileLoader, fileWatcher);
            }
            break;
          
          case ErrorType.OPERATION_TIMEOUT:
          case ErrorType.OPERATION_FAILED:
            // 重试当前操作
            if (editorRef.current && fileLoader && scroller) {
              const scrollTop = editorRef.current.getScrollTop();
              const { blocksToLoad } = scroller.calculateScrollState(scrollTop);
              for (const blockIndex of blocksToLoad) {
                const [startLine, endLine] = scroller.getBlockRange(blockIndex);
                await fileLoader.loadChunk(startLine, endLine);
              }
            }
            break;
          
          case ErrorType.SYSTEM_MEMORY_LOW:
            // 清理内存并重试
            if (fileLoader) {
              fileLoader.clearCache();
              if (editorRef.current && scroller) {
                const scrollTop = editorRef.current.getScrollTop();
                const { blocksToLoad } = scroller.calculateScrollState(scrollTop);
                for (const blockIndex of blocksToLoad) {
                  const [startLine, endLine] = scroller.getBlockRange(blockIndex);
                  await fileLoader.loadChunk(startLine, endLine);
                }
              }
            }
            break;
        }
      }
    };

    const handleRetryFailed = (errorInfo: ErrorInfo) => {
      editorStore.setError(new Error(`重试失败: ${errorInfo.message} (已重试 ${errorInfo.retryCount} 次)`));
      editorStore.setErrorRecoverable(false);
    };

    errorManager.current.on('error', handleError);
    errorManager.current.on('retry', handleRetry);
    errorManager.current.on('retryFailed', handleRetryFailed);

    return () => {
      errorManager.current.off('error', handleError);
      errorManager.current.off('retry', handleRetry);
      errorManager.current.off('retryFailed', handleRetryFailed);
    };
  }, [editorStore, fileLoader, fileWatcher, scroller]);

  // 暴露方法给父组件
  React.useImperativeHandle(ref, () => ({
    isDirty: editorStore.isDirty,
    save: async () => {
      // 实现保存逻辑
      if (editorRef.current) {
        const content = editorRef.current.getValue();
        // TODO: 调用保存文件的方法
        editorStore.setDirty(false);
      }
    }
  }));

  return (
    <div className="file-editor-main">
      {editorStore.isLoading ? (
        <div className="loading-indicator">
          <span>正在加载文件...</span>
        </div>
      ) : editorStore.error ? (
        <div className="error-message">
          <div className="error-content">
            <span className="error-text">{editorStore.error.message}</span>
            {editorStore.errorRecoverable && (
              <button
                className="retry-button"
                onClick={() => errorManager.current.retry()}
              >
                重试
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div
            className="editor-container"
            ref={containerRef}
            style={{ height: scroller?.getTotalHeight() }}
            onContextMenu={handleContextMenu}
          />
          {editorStore.filterActive && (
            <div className="filter-stats">
              <span>
                匹配行数: {editorStore.filterStats.matchedLines} / {editorStore.filterStats.totalLines}
              </span>
            </div>
          )}
          {editorStore.isRefreshing && (
            <div className="refresh-indicator">
              <span>正在更新内容...</span>
            </div>
          )}
        </>
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
    </div>
  );
}); 