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
  
  /**
   * 创建新的SFTP连接
   * @param sessionInfo 会话信息
   * @param tabId 标签页ID
   * @returns 连接ID
   */
  async createConnection(sessionInfo: SessionInfo, tabId: string): Promise<string> {
    if (!tabId) {
      throw new Error('tabId 不能为空');
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
      history: ['/']
    };
    
    this.connections.set(tabId, connection);
    this.tabCaches.set(tabId, cache);
    
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
   * 获取标签页的缓存数据
   * @param tabId 标签页ID
   */
  private getTabCache(tabId: string): TabCache {
    let cache = this.tabCaches.get(tabId);
    if (!cache) {
      cache = {
        currentPath: '/',
        history: ['/']
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


    // 从服务器读取数据
    console.log(`[SFTPManager] 从服务器读取数据 - tabId: ${tabId}, path: ${path}`);
    const result = await ipcRenderer.invoke('sftp:read-directory', conn.id, path);
    console.log(`[SFTPManager] 读取结果 - tabId: ${tabId}, path: ${path}, result: `,result);
    if (!result.success) {
      throw new Error(result.error);
    }

    // 更新缓存
    cache.currentPath = path;
    if (!cache.history.includes(path)) {
      cache.history.push(path);
    }

    // 过滤掉普通文件，保留目录和链接文件，并按目录名排序
    const entries = result.data
      .filter((entry: any) => !shouldFilterRegularFile(entry.permissions))
      .sort((a: FileEntry, b: FileEntry) => {
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      });
    return entries;
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
   * 读取目录下的所有文件（包括普通文件、目录和链接文件）
   * @param tabId 标签页ID
   * @param path 目录路径
   * @param forceRefresh 是否强制刷新（不使用缓存）
   */
  async readAllFiles(tabId: string, path: string, forceRefresh: boolean = false): Promise<FileEntry[]> {
    const conn = this.getConnection(tabId);
    if (!conn) {
      throw new Error('SFTP连接不存在');
    }

    const cache = this.getTabCache(tabId);

    // 从服务器读取数据
    console.log(`[SFTPManager] 读取所有文件 - tabId: ${tabId}, path: ${path}`);
    const result = await ipcRenderer.invoke('sftp:read-directory', conn.id, path);
    console.log(`[SFTPManager] 读取结果 - tabId: ${tabId}, path: ${path}, result: `,result);
    if (!result.success) {
      throw new Error(result.error);
    }

    // 更新缓存
    cache.currentPath = path;
    if (!cache.history.includes(path)) {
      cache.history.push(path);
    }

    // 对所有文件进行排序：目录在前，其他文件按名称排序
    const entries = result.data.sort((a: FileEntry, b: FileEntry) => {
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    
    return entries;
  }

  /**
   * 关闭指定标签页的连接
   * @param tabId 标签页ID
   */
  async closeConnection(tabId: string) {
    const conn = this.connections.get(tabId);
    if (conn) {
      console.log(`[SFTPManager] 关闭连接 - tabId: ${tabId}`);
      await ipcRenderer.invoke('sftp:close-client', conn.id);
      this.connections.delete(tabId);
      this.tabCaches.delete(tabId);
      console.log(`[SFTPManager] 连接已关闭 - tabId: ${tabId}, remaining connections: ${this.connections.size}`);
    }
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
      console.log(`  currentPath: ${cache?.currentPath}`);
    
    });
  }
}

// 导出单例
export const sftpConnectionManager = new SFTPConnectionManager(); 