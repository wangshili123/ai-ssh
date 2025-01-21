import { ipcRenderer } from 'electron';
import type { SessionInfo } from '../types';

/**
 * SFTP连接信息接口
 */
export interface SFTPConnection {
  id: string;  // 唯一连接ID
  sessionInfo: SessionInfo;  // 会话信息
  tabId: string;  // 标签页ID
  currentPath: string;  // 当前路径
  history: string[];  // 浏览历史
}

/**
 * SFTP连接管理器
 * 负责管理所有标签页的SFTP连接
 */
class SFTPConnectionManager {
  // 存储所有SFTP连接
  private connections: Map<string, SFTPConnection> = new Map();
  
  /**
   * 创建新的SFTP连接
   * @param sessionInfo 会话信息
   * @param tabId 标签页ID
   * @returns 连接ID
   */
  async createConnection(sessionInfo: SessionInfo, tabId: string): Promise<string> {
    const connectionId = `sftp-${sessionInfo.id}-${tabId}`;
    
    // 如果已存在相同标签页的连接，先关闭它
    await this.closeConnection(tabId);
    
    // 调用主进程创建SFTP客户端
    const result = await ipcRenderer.invoke('sftp:create-client', connectionId, sessionInfo);
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // 保存连接信息
    this.connections.set(connectionId, {
      id: connectionId,
      sessionInfo,
      tabId,
      currentPath: '/',
      history: ['/']
    });
    
    return connectionId;
  }
  
  /**
   * 获取指定标签页的连接信息
   * @param tabId 标签页ID
   */
  getConnection(tabId: string): SFTPConnection | undefined {
    return Array.from(this.connections.values())
      .find(conn => conn.tabId === tabId);
  }
  
  /**
   * 更新连接的当前路径
   * @param tabId 标签页ID
   * @param path 新路径
   */
  updateCurrentPath(tabId: string, path: string): void {
    const conn = this.getConnection(tabId);
    if (conn) {
      conn.currentPath = path;
      conn.history.push(path);
      // 限制历史记录最大数量
      if (conn.history.length > 50) {
        conn.history.shift();
      }
    }
  }
  
  /**
   * 关闭SFTP连接
   * @param tabId 标签页ID
   */
  async closeConnection(tabId: string): Promise<void> {
    const conn = this.getConnection(tabId);
    if (conn) {
      const result = await ipcRenderer.invoke('sftp:close-client', conn.id);
      if (!result.success) {
        console.error('关闭SFTP连接失败:', result.error);
      }
      this.connections.delete(conn.id);
    }
  }
  
  /**
   * 获取连接的浏览历史
   * @param tabId 标签页ID
   */
  getHistory(tabId: string): string[] {
    const conn = this.getConnection(tabId);
    return conn ? [...conn.history] : [];
  }
}

// 导出单例
export const sftpConnectionManager = new SFTPConnectionManager(); 