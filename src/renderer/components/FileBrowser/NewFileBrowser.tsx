import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { Spin } from 'antd';
import type { Key } from 'rc-tree/lib/interface';
import { sftpConnectionManager } from '../../services/sftpConnectionManager';
import DirectoryTree from './DirectoryTree';
import FileList from './FileList';
import Navigation from './Navigation';
import type { SessionInfo } from '../../types';
import type { FileEntry } from '../../../main/types/file';
import './NewFileBrowser.css';
import { eventBus } from '../../services/eventBus';

interface NewFileBrowserProps {
  sessionInfo?: SessionInfo;
  tabId: string;
}

// 定义错误类型接口
interface SFTPError extends Error {
  code?: string;
  message: string;
}

// 定义标签页状态接口
interface TabState {
  currentPath: string;
  treeData: any[];
  expandedKeys: string[];
  fileList: FileEntry[];
  isInitialized: boolean;
  isConnected: boolean;
  sessionId: string;
}

// 用于存储所有标签页的状态
const tabStates = new Map<string, TabState>();

// 生成状态键
function getStateKey(tabId: string) {
  return tabId;  // 直接使用 tabId
}

// 使用 memo 包装子组件，避免不必要的重新渲染
const MemoizedDirectoryTree = memo(DirectoryTree);
const MemoizedFileList = memo(FileList);
const MemoizedNavigation = memo(Navigation);

const NewFileBrowser: React.FC<NewFileBrowserProps> = ({
  sessionInfo,
  tabId
}) => {
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(false);
  const connectionAttemptRef = useRef(0);
  const renderCountRef = useRef(0);
  const maxConnectionAttempts = 3;

  // 每次渲染时记录
  renderCountRef.current += 1;
  console.log('[FileBrowser] 组件渲染:', { 
    renderCount: renderCountRef.current,
    tabId, 
    sessionInfo,
    hasState: tabStates.has(tabId),
    mountedRef: mountedRef.current,
    stateSize: tabStates.size,
    loading
  });

  // 初始化状态
  const [tabState, setTabState] = useState<TabState | null>(() => {
    const state = tabStates.get(tabId);
    console.log('[FileBrowser] 初始化状态:', {
      tabId,
      hasState: !!state,
      state
    });
    if (!state && sessionInfo) {
      const initialState: TabState = {
        currentPath: '/',
        treeData: [],
        expandedKeys: [],
        fileList: [],
        isInitialized: false,
        isConnected: false,
        sessionId: sessionInfo.id
      };
      tabStates.set(tabId, initialState);
      return initialState;
    }
    return state || null;
  });

  // 监听组件挂载和卸载
  useEffect(() => {
    console.log('[FileBrowser] 组件挂载:', {
      tabId,
      sessionId: sessionInfo?.id,
      hasState: tabStates.has(tabId)
    });

    mountedRef.current = true;

    return () => {
      console.log('[FileBrowser] 组件卸载:', {
        tabId,
        sessionId: sessionInfo?.id,
        hasState: tabStates.has(tabId)
      });
      mountedRef.current = false;
    };
  }, []);

  // 监听 props 变化
  useEffect(() => {
    console.log('[FileBrowser] Props 变化:', {
      tabId,
      sessionId: sessionInfo?.id,
      hasState: tabStates.has(tabId),
      state: tabStates.get(tabId)
    });
  }, [tabId, sessionInfo]);

  // 更新标签页状态
  const updateTabState = useCallback((updates: Partial<TabState>) => {
    console.log('[FileBrowser] 更新状态:', {
      tabId,
      updates,
      currentState: tabStates.get(tabId)
    });

    if (!mountedRef.current || !sessionInfo) return;
    
    setTabState(prev => {
      if (!prev) return null;
      const newState = { ...prev, ...updates };
      tabStates.set(tabId, newState);
      return newState;
    });
  }, [tabId, sessionInfo]);

  // 获取或创建标签页状态
  const getTabState = useCallback(() => {
    if (!sessionInfo) return null;
    
    const stateKey = getStateKey(tabId);
    console.log('[FileBrowser] 获取标签页状态:', { stateKey, exists: tabStates.has(stateKey) });

    if (!tabStates.has(stateKey)) {
      const initialState = {
        currentPath: '/',
        treeData: [],
        expandedKeys: [],
        fileList: [],
        isInitialized: false,
        isConnected: false,
        sessionId: sessionInfo.id
      };
      console.log('[FileBrowser] 创建新的标签页状态:', initialState);
      tabStates.set(stateKey, initialState);
    }

    return tabStates.get(stateKey)!;
  }, [tabId, sessionInfo]);

  // 初始化SFTP连接
  const initConnection = useCallback(async () => {
    if (!sessionInfo || !mountedRef.current) return;
    if (connectionAttemptRef.current >= maxConnectionAttempts) {
      console.error(`[FileBrowser] 连接尝试次数过多，已停止重试 - tabId: ${tabId}`);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      connectionAttemptRef.current++;
      console.log(`[FileBrowser] 创建新连接(第${connectionAttemptRef.current}次尝试) - tabId: ${tabId}`);
      
      // 检查是否已经存在连接，如果不存在则创建
      if (!sftpConnectionManager.getConnection(tabId)) {
        await sftpConnectionManager.createConnection(sessionInfo, tabId);
      }
      
      console.log('[FileBrowser] 开始初始化根目录');
      const rootFiles = await sftpConnectionManager.readDirectory(tabId, '/');
      
      if (mountedRef.current) {
        const rootDirs = rootFiles
          .filter(file => file.isDirectory)
          .map(file => ({
            title: file.name,
            key: `/${file.name}`.replace(/\/+/g, '/'),
            isLeaf: false,
          }));
        
        console.log('[FileBrowser] 根目录初始化完成:', rootDirs);
        updateTabState({
          currentPath: '/',
          fileList: rootFiles,
          treeData: rootDirs,
          isInitialized: true,
          isConnected: true
        });
        
        // 重置连接尝试次数
        connectionAttemptRef.current = 0;
        setLoading(false);
      }
    } catch (error: unknown) {
      const sftpError = error as SFTPError;
      console.error(`[FileBrowser] 连接失败(第${connectionAttemptRef.current}次尝试) - tabId: ${tabId}:`, sftpError);
      
      if (sftpError.message?.includes('ECONNRESET') && connectionAttemptRef.current < maxConnectionAttempts) {
        setTimeout(() => {
          if (mountedRef.current) {
            initConnection();
          }
        }, 1000 * connectionAttemptRef.current);
      } else {
        setLoading(false);
      }
    }
  }, [sessionInfo, tabId, updateTabState]);

  // 监听会话信息变化
  useEffect(() => {
    if (!sessionInfo || !mountedRef.current) return;

    const currentState = tabStates.get(tabId);
    if (!currentState?.isInitialized || !currentState?.isConnected) {
      console.log('[FileBrowser] 需要初始化连接');
      initConnection();
    }
  }, [sessionInfo, tabId, initConnection]);

  // 处理目录树展开
  const handleExpand = useCallback((keys: Key[]) => {
    if (!mountedRef.current) return;
    console.log('[FileBrowser] 处理目录树展开:', keys);
    updateTabState({ expandedKeys: keys as string[] });
  }, [updateTabState]);

  // 处理目录选择
  const handleSelect = useCallback((path: string) => {
    if (!mountedRef.current) return;
    console.log('[FileBrowser] 选择目录:', path);
    updateTabState({ currentPath: path });

    // 加载选中目录的内容
    if (sessionInfo) {
      sftpConnectionManager.readDirectory(tabId, path).then(files => {
        if (mountedRef.current) {
          updateTabState({ fileList: files });
        }
      }).catch(error => {
        console.error('[FileBrowser] 加载目录内容失败:', error);
      });
    }
  }, [updateTabState, tabId, sessionInfo]);

  // 处理文件列表更新
  const handleFileListChange = useCallback((files: FileEntry[]) => {
    if (!mountedRef.current) return;
    console.log('[FileBrowser] 更新文件列表:', files.length);
    updateTabState({ fileList: files });
  }, [updateTabState]);

  // 处理目录树数据更新
  const handleTreeDataUpdate = useCallback((newTreeData: any[]) => {
    if (!mountedRef.current) return;
    console.log('[FileBrowser] 更新目录树数据:', newTreeData);
    updateTabState({ 
      treeData: newTreeData,
      isInitialized: true
    });
  }, [updateTabState]);

  // 监听标签页变化
  useEffect(() => {
    // 处理新标签页创建
    const handleTabCreate = (data: { tabId: string; sessionInfo?: SessionInfo; isNew?: boolean }) => {
      if (data.tabId === tabId && data.sessionInfo && data.sessionInfo.id === sessionInfo?.id && data.isNew) {
        console.log('[FileBrowser] 收到新标签页创建事件:', data);
        
        // 新标签页总是需要初始化
        const initialState = {
          currentPath: '/',
          treeData: [],
          expandedKeys: [],
          fileList: [],
          isInitialized: false,
          isConnected: false,
          sessionId: sessionInfo.id
        };
        
        tabStates.set(tabId, initialState);
        setTabState(initialState);
        initConnection();
      }
    };

    // 只监听 tab-create 事件
    eventBus.on('tab-create', handleTabCreate);

    // 检查是否需要初始化
    const currentState = tabStates.get(tabId);
    if (!currentState && sessionInfo) {
      console.log('[FileBrowser] 初始化新标签页:', tabId);
      const initialState = {
        currentPath: '/',
        treeData: [],
        expandedKeys: [],
        fileList: [],
        isInitialized: false,
        isConnected: false,
        sessionId: sessionInfo.id
      };
      
      tabStates.set(tabId, initialState);
      setTabState(initialState);
      initConnection();
    } else if (currentState) {
      console.log('[FileBrowser] 使用现有状态:', currentState);
      setTabState(currentState);
      setLoading(false);
    }

    return () => {
      eventBus.off('tab-create', handleTabCreate);
    };
  }, [tabId, sessionInfo?.id, initConnection]);

  // 添加一个清理函数
  const cleanupTab = useCallback(() => {
    if (tabId) {
      console.log('[FileBrowser] 清理标签页资源:', tabId);
      const currentState = tabStates.get(tabId);
      if (currentState?.isInitialized) {
        sftpConnectionManager.closeConnection(tabId);
      }
      tabStates.delete(tabId);
    }
  }, [tabId]);

  // 在组件完全卸载时清理资源
  useEffect(() => {
    return () => {
      // 检查标签页是否真的被删除了
      setTimeout(() => {
        if (!document.querySelector(`[data-tab-id="${tabId}"]`)) {
          cleanupTab();
        }
      }, 100);
    };
  }, [tabId, cleanupTab]);

  if (!sessionInfo || !tabState) {
    return (
      <div className="file-browser-main">
        <div className="file-browser-loading">
          <Spin tip="请先选择一个会话连接" />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="file-browser-main">
        <div className="file-browser-loading">
          <Spin tip={`正在连接${connectionAttemptRef.current > 0 ? `(第${connectionAttemptRef.current}次尝试)` : ''}...`} />
        </div>
      </div>
    );
  }

  return (
    <div 
      className="file-browser-main"
      data-tab-id={tabId}
      data-render-count={renderCountRef.current}
    >
      <div className="file-browser-sider">
        <div className="file-browser-tree">
          <MemoizedDirectoryTree
            sessionInfo={sessionInfo}
            tabId={tabId}
            treeData={tabState.treeData}
            expandedKeys={tabState.expandedKeys}
            loading={loading}
            onExpand={handleExpand}
            onSelect={handleSelect}
            onTreeDataUpdate={handleTreeDataUpdate}
          />
        </div>
      </div>
      <div className="file-browser-content">
        <div className="file-browser-navigation">
          <MemoizedNavigation
            currentPath={tabState.currentPath}
            history={[]}
            historyIndex={0}
            onPathChange={handleSelect}
          />
        </div>
        <div className="file-browser-files">
          <MemoizedFileList
            sessionInfo={sessionInfo}
            tabId={tabId}
            currentPath={tabState.currentPath}
            fileList={tabState.fileList}
            loading={loading}
            onFileListChange={handleFileListChange}
          />
        </div>
      </div>
    </div>
  );
};

export default memo(NewFileBrowser); 