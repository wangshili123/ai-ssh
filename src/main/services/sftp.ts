import { Client } from 'ssh2';
import type { SessionInfo } from '../types/storage';
import type { FileEntry } from '../types/file';
import { convertPermissionsToOctal, isDirectory, isSymlink, shouldFilterRegularFile } from '../../renderer/utils/fileUtils';


/**
 * SFTP连接的数据缓存
 */
interface SFTPCache {
  currentPath: string;
  pathHistory: string[];
  directoryCache: Map<string, FileEntry[]>;  // 目录路径 -> 文件列表的缓存
}

/**
 * SFTP客户端类
 */
class SFTPClient {
  private client: Client;
  private sftp: any;  // ssh2的SFTP类型定义不完整，暂时使用any
  private cache: SFTPCache;

  constructor(private sessionInfo: SessionInfo, private connectionId: string) {
    this.client = new Client();
    // 初始化缓存
    this.cache = {
      currentPath: '/',
      pathHistory: ['/'],
      directoryCache: new Map()
    };
    console.log(`[SFTPClient] 创建实例 - connectionId: ${connectionId}, sessionId: ${sessionInfo.id}`);
  }

  /**
   * 连接SFTP服务器
   */
  async connect(): Promise<void> {
    const { host, port, username, password, privateKey, authType } = this.sessionInfo;
    
    const config: any = {
      host,
      port,
      username
    };

    // 根据认证类型设置认证方式
    if (authType === 'password' && password) {
      config.password = password;
    } else if (authType === 'privateKey' && privateKey) {
      config.privateKey = privateKey;
    } else {
      throw new Error('无效的认证配置');
    }

    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        this.client.sftp((err, sftp) => {
          if (err) {
            reject(err);
            return;
          }
          this.sftp = sftp;
          resolve();
        });
      }).on('error', (err) => {
        reject(err);
      }).connect(config);
    });
  }

  /**
   * 读取目录内容
   * @param path 目录路径
   * @param useCache 是否使用缓存
   */
  async readDirectory(path: string, useCache: boolean = true): Promise<FileEntry[]> {
    console.log(`[SFTPClient] 读取目录 - connectionId: ${this.connectionId}, path: ${path}, useCache: ${useCache}`);
    
    // 更新当前路径和历史记录
    this.cache.currentPath = path;
    if (!this.cache.pathHistory.includes(path)) {
      this.cache.pathHistory.push(path);
      console.log(`[SFTPClient] 更新历史记录 - connectionId: ${this.connectionId}, history:`, this.cache.pathHistory);
    }

    // 检查缓存
    if (useCache && this.cache.directoryCache.has(path)) {
      console.log(`[SFTPClient] 使用缓存 - connectionId: ${this.connectionId}, path: ${path}`);
      return this.cache.directoryCache.get(path)!;
    }

    return new Promise((resolve, reject) => {
      this.sftp.readdir(path, (err: Error, list: any[]) => {
        if (err) {
          console.error(`[SFTPClient] 读取目录失败 - connectionId: ${this.connectionId}, path: ${path}:`, err);
          reject(err);
          return;
        }
        
        const entries: FileEntry[] = list.map(item => ({
          name: item.filename,
          path: `${path}/${item.filename}`.replace(/\/+/g, '/'),
          isDirectory: !shouldFilterRegularFile(item.attrs.mode),
          size: item.attrs.size,
          modifyTime: item.attrs.mtime * 1000,
          permissions: item.attrs.mode,
          owner: item.attrs.uid,
          group: item.attrs.gid
        }));
        
        // 更新缓存
        this.cache.directoryCache.set(path, entries);
        console.log(`[SFTPClient] 目录读取完成并缓存 - connectionId: ${this.connectionId}, path: ${path}, count: ${entries.length}`);
        resolve(entries);
      });
    });
  }

  /**
   * 清除指定路径的缓存
   * @param path 目录路径，如果不指定则清除所有缓存
   */
  clearCache(path?: string) {
    if (path) {
      console.log(`[SFTPClient] 清除路径缓存 - connectionId: ${this.connectionId}, path: ${path}`);
      this.cache.directoryCache.delete(path);
    } else {
      console.log(`[SFTPClient] 清除所有缓存 - connectionId: ${this.connectionId}`);
      this.cache.directoryCache.clear();
    }
  }

  /**
   * 获取当前路径
   */
  getCurrentPath(): string {
    console.log(`[SFTPClient] 获取当前路径 - connectionId: ${this.connectionId}, path: ${this.cache.currentPath}`);
    return this.cache.currentPath;
  }

  /**
   * 获取路径历史
   */
  getPathHistory(): string[] {
    console.log(`[SFTPClient] 获取历史记录 - connectionId: ${this.connectionId}, history:`, this.cache.pathHistory);
    return [...this.cache.pathHistory];
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    console.log(`[SFTPClient] 关闭连接 - connectionId: ${this.connectionId}`);
    return new Promise((resolve) => {
      this.client.end();
      resolve();
    });
  }
}

/**
 * SFTP管理器
 * 负责管理所有SFTP客户端实例
 */
class SFTPManager {
  private clients: Map<string, SFTPClient> = new Map();

  /**
   * 创建SFTP客户端
   * @param connectionId 连接ID
   * @param sessionInfo 会话信息
   */
  async createClient(connectionId: string, sessionInfo: SessionInfo): Promise<void> {
    // 如果已存在，先关闭旧的连接
    await this.closeClient(connectionId);
    
    console.log(`[SFTPManager] 创建新客户端 - connectionId: ${connectionId}`);
    const client = new SFTPClient(sessionInfo, connectionId);
    await client.connect();
    this.clients.set(connectionId, client);
    console.log(`[SFTPManager] 客户端创建成功 - connectionId: ${connectionId}, total: ${this.clients.size}`);
  }

  /**
   * 获取SFTP客户端
   * @param connectionId 连接ID
   */
  getClient(connectionId: string): SFTPClient | undefined {
    const client = this.clients.get(connectionId);
    if (!client) {
      console.log(`[SFTPManager] 未找到客户端 - connectionId: ${connectionId}`);
    }
    return client;
  }

  /**
   * 读取目录内容
   * @param connectionId 连接ID
   * @param path 目录路径
   * @param useCache 是否使用缓存
   */
  async readDirectory(connectionId: string, path: string, useCache: boolean = true): Promise<FileEntry[]> {
    console.log(`[SFTPManager] 读取目录 - connectionId: ${connectionId}, path: ${path}, useCache: ${useCache}`);
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.readDirectory(path, useCache);
  }

  /**
   * 清除缓存
   * @param connectionId 连接ID
   * @param path 目录路径，如果不指定则清除所有缓存
   */
  clearCache(connectionId: string, path?: string) {
    const client = this.getClient(connectionId);
    if (client) {
      client.clearCache(path);
    }
  }

  /**
   * 获取当前路径
   * @param connectionId 连接ID
   */
  getCurrentPath(connectionId: string): string {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.getCurrentPath();
  }

  /**
   * 获取路径历史
   * @param connectionId 连接ID
   */
  getPathHistory(connectionId: string): string[] {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.getPathHistory();
  }

  /**
   * 关闭SFTP客户端
   * @param connectionId 连接ID
   */
  async closeClient(connectionId: string): Promise<void> {
    console.log(`[SFTPManager] 关闭客户端 - connectionId: ${connectionId}`);
    const client = this.clients.get(connectionId);
    if (client) {
      await client.close();
      this.clients.delete(connectionId);
      console.log(`[SFTPManager] 客户端已关闭 - connectionId: ${connectionId}, remaining: ${this.clients.size}`);
    }
  }
}

// 导出单例
export const sftpManager = new SFTPManager(); 