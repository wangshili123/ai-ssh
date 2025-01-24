import React, { useEffect, useState, useRef } from 'react';
import { Spin } from 'antd';
import DirectoryTree from '../DirectoryTree/DirectoryTree';
import FileList from '../FileList/FileList';
import Navigation from '../Navigation/Navigation';
import { FileBrowserMainProps, FileBrowserTabState } from './FileBrowserTypes';
import { FileBrowserStateManager } from './FileBrowserStateManager';
import { FileBrowserEventHandlers } from './FileBrowserEventHandlers';
import { FileBrowserConnectionManager } from './FileBrowserConnectionManager';
import './FileBrowserMain.css';

const FileBrowserMain: React.FC<FileBrowserMainProps> = ({ sessionInfo, tabId }) => {
  console.log('[FileBrowser] 组件渲染:', { sessionInfo, tabId });
  
  const [tabState, setTabState] = useState<FileBrowserTabState>();
  const [fileListLoading, setFileListLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  const mountedRef = useRef(false);

  // 初始化连接和加载数据
  useEffect(() => {
    console.log('[FileBrowser] 开始初始化:', { tabId, sessionId: sessionInfo?.id });
    
    const init = async () => {
      if (!sessionInfo) {
        console.log('[FileBrowser] 没有会话信息，跳过初始化');
        return;
      }
      
      try {
        setInitializing(true);
        await FileBrowserConnectionManager.initConnection(tabId, sessionInfo);
        if (mountedRef.current) {
          const state = FileBrowserStateManager.getTabState(tabId);
          if (state) {
            console.log('[FileBrowser] 初始化完成，状态:', state);
            setTabState(state);
          } else {
            console.log('[FileBrowser] 初始化完成，但没有找到状态');
          }
        }
      } catch (error) {
        console.error('[FileBrowser] 初始化失败:', error);
      } finally {
        if (mountedRef.current) {
          setInitializing(false);
          setFileListLoading(false);
        }
      }
    };

    mountedRef.current = true;
    init();

    return () => {
      console.log('[FileBrowser] 组件卸载:', { tabId });
      mountedRef.current = false;
    };
  }, [tabId, sessionInfo]);

  // 处理目录选择
  const handleSelect = async (path: string) => {
    if (!mountedRef.current) return;
    
    try {
      setFileListLoading(true);
      await FileBrowserEventHandlers.handleSelect(tabId, path);
      if (mountedRef.current) {
        const state = FileBrowserStateManager.getTabState(tabId);
        if (state) {
          console.log('[FileBrowser] 目录选择完成，状态:', state);
          setTabState(state);
        }
      }
    } finally {
      if (mountedRef.current) {
        setFileListLoading(false);
      }
    }
  };

  // 处理目录树展开
  const handleExpand = (keys: React.Key[]) => {
    if (!mountedRef.current) return;
    
    const newState = FileBrowserEventHandlers.handleExpand(tabId, keys.map(key => key.toString()));
    if (newState) {
      setTabState(newState);
    }
  };

  // 处理文件列表中的目录双击
  const handleDirectorySelect = async (path: string) => {
    if (!mountedRef.current) return;

    try {
      setFileListLoading(true);
      
      // 1. 获取从根目录到目标目录的路径数组
      const pathParts = path.split('/').filter(Boolean);
      const expandKeys = pathParts.reduce((acc: string[], part: string, index: number) => {
        const currentPath = '/' + pathParts.slice(0, index + 1).join('/');
        acc.push(currentPath);
        return acc;
      }, ['/']);
      
      console.log('[FileBrowser] 处理目录双击:', { path, expandKeys });

      // 2. 展开目录树
      handleExpand(expandKeys);
      
      // 3. 加载目录内容
      await handleSelect(path);
      
    } finally {
      if (mountedRef.current) {
        setFileListLoading(false);
      }
    }
  };

  // 处理树数据更新
  const handleTreeDataUpdate = (newTreeData: any[]) => {
    if (!mountedRef.current) return;
    
    FileBrowserEventHandlers.handleTreeDataUpdate(tabId, newTreeData);
    const state = FileBrowserStateManager.getTabState(tabId);
    if (state) {
      console.log('[FileBrowser] 树数据更新完成，状态:', state);
      setTabState(state);
    }
  };

  // 处理文件列表变化
  const handleFileListChange = (newFileList: any[]) => {
    if (!mountedRef.current) return;
    
    FileBrowserEventHandlers.handleFileListChange(tabId, newFileList);
    const state = FileBrowserStateManager.getTabState(tabId);
    if (state) {
      console.log('[FileBrowser] 文件列表更新完成，状态:', state);
      setTabState(state);
    }
  };

  console.log('[FileBrowser] 当前状态:', { 
    tabId, 
    hasState: !!tabState, 
    fileListLoading,
    fileCount: tabState?.fileList?.length,
    treeCount: tabState?.treeData?.length
  });

  if (!sessionInfo || !tabState) {
    return (
      <div className="file-browser-loading">
        <Spin tip="加载中..." />
      </div>
    );
  }

  return (
    <div className="file-browser-main">
      <div className="file-browser-navigation">
        <Navigation
          currentPath={tabState.currentPath}
          history={tabState.history}
          historyIndex={tabState.historyIndex}
          onPathChange={handleSelect}
        />
      </div>
      <div className="file-browser-content">
        <div className="file-browser-tree">
          <DirectoryTree
            sessionInfo={sessionInfo}
            tabId={tabId}
            treeData={tabState.treeData}
            expandedKeys={tabState.expandedKeys}
            loading={false}
            onExpand={handleExpand}
            onSelect={handleSelect}
            onTreeDataUpdate={handleTreeDataUpdate}
            currentPath={tabState.currentPath}
          />
        </div>
        <div className="file-browser-files">
          <FileList
            sessionInfo={sessionInfo}
            tabId={tabId}
            currentPath={tabState.currentPath}
            fileList={tabState.fileList}
            loading={fileListLoading}
            onFileListChange={handleFileListChange}
            onDirectorySelect={handleDirectorySelect}
          />
        </div>
      </div>
    </div>
  );
};

export default FileBrowserMain; 