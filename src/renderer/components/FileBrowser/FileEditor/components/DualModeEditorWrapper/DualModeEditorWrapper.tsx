/**
 * 双模式编辑器包装组件
 * 将新的双模式编辑器整合到现有系统中，确保与FileEditorMain兼容
 */

import React, { forwardRef, useImperativeHandle, useRef, useState, useEffect, useCallback } from 'react';
import { observer } from 'mobx-react';
import { Alert, Spin, message } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { DualModeEditorWrapperProps, DualModeEditorWrapperRef } from './DualModeEditorWrapperTypes';
import { DualModeEditor, DualModeEditorRef } from '../DualModeEditor/DualModeEditorExport';
import { EditorMode, EditorEvents } from '../../types/FileEditorTypes';
import { useEditorTabStore } from '../../store/EditorTabStore';
import './DualModeEditorWrapperStyles.css';

/**
 * 双模式编辑器包装组件
 * 适配现有的API，实现平滑过渡
 */
export const DualModeEditorWrapper = observer(forwardRef<DualModeEditorWrapperRef, DualModeEditorWrapperProps>((props, ref) => {
  const { filePath, sessionId, tabId, initialConfig } = props;
  
  // 引用双模式编辑器
  const editorRef = useRef<DualModeEditorRef | null>(null);
  
  // 获取标签状态
  const tabStore = useEditorTabStore();
  const tab = tabStore.getTab(tabId);
  
  // 本地状态
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 初始模式设置
  const determineInitialMode = useCallback(async () => {
    if (initialConfig?.initialMode) {
      return initialConfig.initialMode;
    }
    
    try {
      // 获取文件大小，根据大小决定初始模式
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('sftp:stat', sessionId, filePath);
      
      if (result.success && result.data) {
        const fileSize = result.data.size;
        const LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
        
        // 大文件默认使用浏览模式
        if (fileSize > LARGE_FILE_THRESHOLD) {
          console.log(`大文件 (${fileSize} bytes)，默认使用浏览模式`);
          return EditorMode.BROWSE;
        }
      }
      
      // 小文件默认使用编辑模式
      console.log('小文件或无法获取文件大小，默认使用编辑模式');
      return EditorMode.EDIT;
    } catch (err) {
      console.error('获取文件信息失败:', err);
      return EditorMode.BROWSE; // 默认使用浏览模式，更安全
    }
  }, [filePath, sessionId, initialConfig]);
  
  // 初始化
  useEffect(() => {
    const initEditor = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // 根据文件大小决定初始模式
        const initialMode = await determineInitialMode();
        
        // 更新标签状态
        if (tab) {
          tabStore.updateTab(tabId, { mode: initialMode });
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error('初始化编辑器失败:', err);
        setError(err instanceof Error ? err.message : '初始化失败');
        setIsLoading(false);
      }
    };
    
    initEditor();
  }, [filePath, sessionId, tabId, determineInitialMode, tabStore]);
  
  // 暴露与FileEditorMainRef兼容的方法
  useImperativeHandle(ref, () => ({
    isDirty: editorRef.current?.isDirty || false,
    
    save: async () => {
      if (!editorRef.current) {
        message.error('编辑器未初始化');
        return;
      }
      
      try {
        await editorRef.current.save();
      } catch (err) {
        console.error('保存文件失败:', err);
        message.error('保存文件失败');
      }
    },
    
    refresh: async () => {
      if (!editorRef.current) {
        message.error('编辑器未初始化');
        return;
      }
      
      try {
        await editorRef.current.refresh();
      } catch (err) {
        console.error('刷新文件失败:', err);
        message.error('刷新文件失败');
      }
    },
    
    getCurrentMode: () => {
      return editorRef.current?.getCurrentMode() || EditorMode.BROWSE;
    }
  }));
  
  // 处理模式切换
  const handleModeSwitch = useCallback((mode: EditorMode, success: boolean) => {
    if (success && tab) {
      // 更新标签状态
      tabStore.updateTab(tabId, { mode });
    }
  }, [tabId, tabStore, tab]);
  
  return (
    <div className="dual-mode-editor-wrapper">
      {isLoading ? (
        <div className="loading-container">
          <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
          <div className="loading-text">加载中...</div>
        </div>
      ) : error ? (
        <Alert
          message="加载错误"
          description={error}
          type="error"
          showIcon
        />
      ) : (
        <DualModeEditor
          ref={editorRef}
          filePath={filePath}
          sessionId={sessionId}
          tabId={tabId}
          initialConfig={{
            readOnly: initialConfig?.readOnly,
            encoding: initialConfig?.encoding,
            initialMode: tab?.mode as EditorMode || EditorMode.BROWSE,
            autoSelectMode: true
          }}
        />
      )}
    </div>
  );
}));

export default DualModeEditorWrapper; 