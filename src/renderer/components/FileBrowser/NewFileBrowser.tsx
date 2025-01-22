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
function getStateKey(tabId: string, sessionId: string) {
  return `${sessionId}:${tabId}`;
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
    
    const stateKey = getStateKey(tabId, sessionInfo.id);
    if (!tabStates.has(stateKey)) {
      tabStates.set(stateKey, {
        currentPath: '/',
        treeData: [],
        expandedKeys: [],
        fileList: [],
        isInitialized: false,
        isConnected: false,
        sessionId: sessionInfo.id
      });
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
      const stateKey = getStateKey(tabId, sessionInfo.id);
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
        updateTabState({ isConnected: true });
        setLoading(false);
        return;
      }

      setLoading(true);
      connectionAttemptRef.current++;
      console.log(`[FileBrowser] 创建新连接(第${connectionAttemptRef.current}次尝试) - tabId: ${tabId}`);
      
      await sftpConnectionManager.createConnection(sessionInfo, tabId);
      
      // 如果标签页未初始化，则初始化根目录
      if (tabState && !tabState.isInitialized) {
        const rootFiles = await sftpConnectionManager.readDirectory(tabId, '/');
        if (mountedRef.current) {
          const rootDirs = rootFiles
            .filter(file => file.isDirectory)
            .map(file => ({
              title: file.name,
              key: `/${file.name}`.replace(/\/+/g, '/'),
              isLeaf: false,
            }));
          
          updateTabState({
            fileList: rootFiles,
            treeData: rootDirs,
            isInitialized: true,
            isConnected: true
          });
        }
      }
      
      if (mountedRef.current) {
        updateTabState({ isConnected: true });
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
    setTabState(newState);

    if (sessionInfo && newState && !newState.isConnected) {
      initConnection();
    }
    
    return () => {
      mountedRef.current = false;
    };
  }, [sessionInfo, getTabState, initConnection]);

  // 处理目录树展开
  const handleExpand = useCallback((keys: Key[]) => {
    if (!mountedRef.current) return;
    updateTabState({ expandedKeys: keys as string[] });
  }, [updateTabState]);

  // 处理目录选择
  const handleSelect = useCallback((path: string) => {
    if (!mountedRef.current) return;
    updateTabState({ currentPath: path });
  }, [updateTabState]);

  // 处理文件列表更新
  const handleFileListChange = useCallback((files: FileEntry[]) => {
    if (!mountedRef.current) return;
    updateTabState({ fileList: files });
  }, [updateTabState]);

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