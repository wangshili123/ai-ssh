import { ipcRenderer } from 'electron';
import type { SessionInfo } from '../types';
import type { FileEntry } from '../../main/types/file';
import { convertPermissionsToOctal, isDirectory, isSymlink, shouldFilterRegularFile } from '../utils/fileUtils';

/**
 * SFTP连接信息接口
 */
export interface SFTPConnection {
  id: string;  // 唯一连接ID
  sessionInfo: SessionInfo;  // 会话信息
  tabId: string;  // 标签页ID
}

/**
 * 标签页数据缓存接口
 */
interface TabCache {
  currentPath: string;  // 当前路径
  history: string[];  // 浏览历史
  directoryCache: Map<string, FileEntry[]>;  // 目录路径 -> 文件列表的缓存
  treeCache: Map<string, FileEntry[]>;  // 目录路径 -> 文件列表的缓存
}

/**
 * SFTP连接管理器
 * 负责管理所有标签页的SFTP连接和数据缓存
 */
class SFTPConnectionManager {
  // 存储所有SFTP连接，key 为 tabId
  private connections: Map<string, SFTPConnection> = new Map();
  // 存储所有标签页的数据缓存，key 为 tabId
  private tabCaches: Map<string, TabCache> = new Map();
  // 添加基于sessionId的连接映射，用于连接复用
  private sessionConnections: Map<string, string> = new Map(); // sessionId -> tabId
  
  /**
   * 创建新的SFTP连接
   * @param sessionInfo 会话信息
   * @param tabId 标签页ID
   * @returns 连接ID
   */
  async createConnection(tabId: string,sessionInfo: SessionInfo): Promise<string> {
    if (!tabId) {
      throw new Error('tabId 不能为空');
    }

    // 检查是否已有相同sessionId的连接可以复用
    const existingTabId = this.sessionConnections.get(sessionInfo.id);
    if (existingTabId && this.connections.has(existingTabId)) {
      const existingConn = this.connections.get(existingTabId)!;
      console.log(`[SFTPManager] 复用现有连接 - sessionId: ${sessionInfo.id}, 从 tabId: ${existingTabId} 复用到 tabId: ${tabId}`);

      // 为新的tabId创建连接引用，但复用相同的底层连接
      const newConnection: SFTPConnection = {
        id: existingConn.id, // 复用相同的连接ID
        sessionInfo,
        tabId
      };

      // 初始化新标签页的缓存
      const cache: TabCache = {
        currentPath: '/',
        history: ['/'],
        directoryCache: new Map(),
        treeCache: new Map()
      };

      this.connections.set(tabId, newConnection);
      this.tabCaches.set(tabId, cache);
      this.sessionConnections.set(sessionInfo.id, tabId); // 更新映射到新的tabId

      console.log(`[SFTPManager] 连接复用成功 - tabId: ${tabId}, total connections: ${this.connections.size}`);
      this.debugConnections();

      return newConnection.id;
    }

    // 如果已存在相同标签页的连接，先关闭它
    const existingConn = this.getConnection(tabId);
    if (existingConn) {
      console.log(`[SFTPManager] 关闭已存在的连接 - tabId: ${tabId}`);
      await this.closeConnection(tabId);
    }

    console.log(`[SFTPManager] 创建新连接 - tabId: ${tabId}, sessionId: ${sessionInfo.id}`);
    const connectionId = `sftp-${tabId}`;

    // 调用主进程创建SFTP客户端
    const result = await ipcRenderer.invoke('sftp:create-client', connectionId, sessionInfo);
    if (!result.success) {
      throw new Error(result.error);
    }

    // 保存连接信息
    const connection: SFTPConnection = {
      id: connectionId,
      sessionInfo,
      tabId
    };

    // 初始化标签页缓存
    const cache: TabCache = {
      currentPath: '/',
      history: ['/'],
      directoryCache: new Map(),
      treeCache: new Map()

    };

    this.connections.set(tabId, connection);
    this.tabCaches.set(tabId, cache);
    this.sessionConnections.set(sessionInfo.id, tabId); // 建立sessionId到tabId的映射

    console.log(`[SFTPManager] 连接创建成功 - tabId: ${tabId}, total connections: ${this.connections.size}`);
    this.debugConnections();

    return connectionId;
  }
  
  /**
   * 获取指定标签页的连接
   * @param tabId 标签页ID
   * @returns 连接信息
   */
  getConnection(tabId: string): SFTPConnection | undefined {
    return this.connections.get(tabId);
  }

  /**
   * 根据sessionId查找现有连接
   * @param sessionId 会话ID
   * @returns 连接信息
   */
  getConnectionBySessionId(sessionId: string): SFTPConnection | undefined {
    const tabId = this.sessionConnections.get(sessionId);
    if (tabId) {
      return this.connections.get(tabId);
    }
    return undefined;
  }

  /**
   * 获取标签页的缓存数据
   * @param tabId 标签页ID
   */
  private getTabCache(tabId: string): TabCache {
    let cache = this.tabCaches.get(tabId);
    if (!cache) {
      cache = {
        currentPath: '/',
        history: ['/'],
        directoryCache: new Map(),
        treeCache: new Map()
      };
      this.tabCaches.set(tabId, cache);
    }
    return cache;
  }
  
  /**
   * 读取目录内容
   * @param tabId 标签页ID
   * @param path 目录路径
   * @param forceRefresh 是否强制刷新（不使用缓存）
   */
  async readDirectory(tabId: string, path: string, forceRefresh: boolean = false): Promise<FileEntry[]> {
    const conn = this.getConnection(tabId);
    if (!conn) {
      throw new Error('SFTP连接不存在');
    }

    const cache = this.getTabCache(tabId);
    let result: FileEntry[] = [];
    // 如果不是强制刷新且缓存中有数据，直接返回缓存数据
    if (!forceRefresh && cache.directoryCache.has(path)) {
      console.log(`[SFTPManager] 使用缓存数据 - tabId: ${tabId}, path: ${path}`);
      result =  cache.directoryCache.get(path)!;
    }else{
      // 从服务器读取数据
      console.log(`[SFTPManager] 从服务器读取数据 - tabId: ${tabId}, path: ${path}, forceRefresh: ${forceRefresh}`);
      let directoryResult = await ipcRenderer.invoke('sftp:read-directory', conn.id, path, !forceRefresh);
      console.log(`[SFTPManager] 读取结果 - tabId: ${tabId}, path: ${path}, result:`, directoryResult);
      if (!directoryResult.success) {
        throw new Error(directoryResult.error);
      }
      result = directoryResult.data;
      console.log(`[SFTPManager] 处理后的结果 - tabId: ${tabId}, path: ${path}, files:`, result);
      // 更新缓存
      cache.currentPath = path;
      if (!cache.history.includes(path)) {
        cache.history.push(path);
      }
      cache.directoryCache.set(path, result);
      cache.treeCache.set(path, result.filter((entry: FileEntry) => entry.isDirectory));
    }
    return result;
  }
  
  /**
   * 更新连接的当前路径
   * @param tabId 标签页ID
   * @param path 新路径
   */
  updateCurrentPath(tabId: string, path: string) {
    const cache = this.getTabCache(tabId);
    cache.currentPath = path;
    if (!cache.history.includes(path)) {
      cache.history.push(path);
    }
  }

  /**
   * 获取当前路径
   * @param tabId 标签页ID
   */
  getCurrentPath(tabId: string): string {
    const cache = this.getTabCache(tabId);
    return cache.currentPath;
  }

  /**
   * 获取浏览历史
   * @param tabId 标签页ID
   */
  getHistory(tabId: string): string[] {
    const cache = this.getTabCache(tabId);
    return [...cache.history];
  }

  /**
   * 获取指定标签页的会话ID
   */
  getSessionId(tabId: string): string | undefined {
    const connection = this.connections.get(tabId);
    return connection?.sessionInfo.id;
  }

  /**
   * 关闭指定标签页的连接
   * @param tabId 标签页ID
   */
  async closeConnection(tabId: string) {
    const conn = this.connections.get(tabId);
    if (conn) {
      console.log(`[SFTPManager] 关闭连接 - tabId: ${tabId}`);

      // 检查是否还有其他tabId在使用相同的连接
      const sameConnectionTabs = Array.from(this.connections.entries())
        .filter(([otherTabId, otherConn]) =>
          otherTabId !== tabId && otherConn.id === conn.id
        );

      if (sameConnectionTabs.length > 0) {
        console.log(`[SFTPManager] 连接被其他标签页使用，不关闭底层连接 - connectionId: ${conn.id}, 使用者: ${sameConnectionTabs.map(([id]) => id).join(', ')}`);
      } else {
        console.log(`[SFTPManager] 关闭底层连接 - connectionId: ${conn.id}`);
        await ipcRenderer.invoke('sftp:close-client', conn.id);
        // 清理sessionId映射
        this.sessionConnections.delete(conn.sessionInfo.id);
      }

      this.connections.delete(tabId);
      this.tabCaches.delete(tabId);
      console.log(`[SFTPManager] 连接已关闭 - tabId: ${tabId}, remaining connections: ${this.connections.size}`);
    }
  }

  /**
   * 预热连接 - 为常用的会话预创建连接
   * @param sessionInfos 会话信息列表
   */
  async warmupConnections(sessionInfos: SessionInfo[]) {
    console.log('[SFTPManager] 开始预热连接...');
    const warmupPromises = sessionInfos.slice(0, 3).map(async (sessionInfo, index) => {
      try {
        const warmupTabId = `warmup-${sessionInfo.id}-${index}`;
        await this.createConnection(warmupTabId, sessionInfo);
        console.log(`[SFTPManager] 预热连接成功 - sessionId: ${sessionInfo.id}`);
      } catch (error) {
        console.warn(`[SFTPManager] 预热连接失败 - sessionId: ${sessionInfo.id}:`, error);
      }
    });

    await Promise.allSettled(warmupPromises);
    console.log('[SFTPManager] 连接预热完成');
  }

  /**
   * 调试用：打印当前所有连接
   */
  debugConnections() {
    console.log('[SFTPManager] 当前所有连接:');
    this.connections.forEach((conn, tabId) => {
      const cache = this.tabCaches.get(tabId);
      console.log(`- tabId: ${tabId}`);
      console.log(`  sessionId: ${conn.sessionInfo.id}`);
      console.log(`  connectionId: ${conn.id}`);
      console.log(`  currentPath: ${cache?.currentPath}`);
      console.log(`  cached paths: ${Array.from(cache?.directoryCache.keys() || []).join(', ')}`);
    });

    console.log('[SFTPManager] SessionId映射:');
    this.sessionConnections.forEach((tabId, sessionId) => {
      console.log(`- sessionId: ${sessionId} -> tabId: ${tabId}`);
    });
  }
}

// 导出单例
export const sftpConnectionManager = new SFTPConnectionManager(); 