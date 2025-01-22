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
  const maxConnectionAttempts = 3;

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

  // 使用标签页状态
  const [tabState, setTabState] = useState<TabState | null>(() => getTabState());

  // 更新标签页状态
  const updateTabState = useCallback((updates: Partial<TabState>) => {
    if (!mountedRef.current || !sessionInfo) return;
    
    setTabState(prev => {
      if (!prev) return null;
      const newState = { ...prev, ...updates };
      const stateKey = getStateKey(tabId);
      console.log('[FileBrowser] 更新标签页状态:', { stateKey, updates, newState });
      tabStates.set(stateKey, newState);
      return newState;
    });
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
      // 检查是否已经存在连接
      const existingConn = sftpConnectionManager.getConnection(tabId);
      if (existingConn) {
        console.log(`[FileBrowser] 复用已有连接 - tabId: ${tabId}`);
        if (!tabState?.isConnected) {
          updateTabState({ isConnected: true });
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      connectionAttemptRef.current++;
      console.log(`[FileBrowser] 创建新连接(第${connectionAttemptRef.current}次尝试) - tabId: ${tabId}`);
      
      await sftpConnectionManager.createConnection(sessionInfo, tabId);
      
      // 如果标签页未初始化，则初始化根目录
      if (tabState && !tabState.isInitialized) {
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
            fileList: rootFiles,
            treeData: rootDirs,
            isInitialized: true,
            isConnected: true
          });
        }
      }
      
      if (mountedRef.current) {
        if (!tabState?.isConnected) {
          updateTabState({ isConnected: true });
        }
        // 重置连接尝试次数
        connectionAttemptRef.current = 0;
      }
    } catch (error: unknown) {
      const sftpError = error as SFTPError;
      console.error(`[FileBrowser] 连接失败(第${connectionAttemptRef.current}次尝试) - tabId: ${tabId}:`, sftpError);
      // 如果是连接重置错误，等待一段时间后重试
      if (sftpError.message?.includes('ECONNRESET') && connectionAttemptRef.current < maxConnectionAttempts) {
        setTimeout(() => {
          if (mountedRef.current) {
            initConnection();
          }
        }, 1000 * connectionAttemptRef.current); // 递增重试延迟
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [sessionInfo, tabId, tabState, updateTabState]);

  // 监听会话信息变化
  useEffect(() => {
    mountedRef.current = true;
    connectionAttemptRef.current = 0;

    // 重新获取状态
    const newState = getTabState();
    if (newState) {
      console.log('[FileBrowser] 设置新的标签页状态:', newState);
      setTabState(newState);
      
      // 只在首次连接时初始化
      if (sessionInfo && !newState.isInitialized && !newState.isConnected) {
        console.log('[FileBrowser] 开始初始化连接');
        initConnection();
      }
    }
    
    return () => {
      mountedRef.current = false;
      // 清理当前标签页的状态
      if (tabId) {
        console.log('[FileBrowser] 清理标签页状态:', tabId);
        tabStates.delete(tabId);
        // 清理 SFTP 连接
        sftpConnectionManager.closeConnection(tabId);
      }
    };
  }, [sessionInfo?.id, tabId]); // 只在sessionInfo.id或tabId变化时重新运行

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
    const handleTabChange = (data: { tabId: string; sessionInfo?: SessionInfo }) => {
      if (data.tabId === tabId && data.sessionInfo && data.sessionInfo.id === sessionInfo?.id) {
        console.log('[FileBrowser] 收到标签页变化事件:', data);
        
        const currentState = tabStates.get(tabId);
        if (!currentState?.isInitialized && !currentState?.isConnected) {
          console.log('[FileBrowser] 开始初始化连接');
          initConnection();
        } else if (currentState?.currentPath) {
          // 如果已经初始化过，重新加载当前目录
          sftpConnectionManager.readDirectory(tabId, currentState.currentPath)
            .then(files => {
              if (mountedRef.current) {
                updateTabState({ fileList: files });
              }
            })
            .catch(error => {
              console.error('[FileBrowser] 重新加载目录失败:', error);
            });
        }
      }
    };

    eventBus.on('tab-change', handleTabChange);
    return () => {
      eventBus.off('tab-change', handleTabChange);
    };
  }, [tabId, sessionInfo?.id, initConnection, updateTabState]);

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
    <div className="file-browser-main">
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