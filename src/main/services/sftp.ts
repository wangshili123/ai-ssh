import { Client } from 'ssh2';
import type { SessionInfo } from '../types/storage';
import type { FileEntry } from '../types/file';

/**
 * SFTP客户端类
 */
class SFTPClient {
  private client: Client;
  private sftp: any;  // ssh2的SFTP类型定义不完整，暂时使用any

  constructor(private sessionInfo: SessionInfo) {
    this.client = new Client();
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
   */
  async readDirectory(path: string): Promise<FileEntry[]> {
    return new Promise((resolve, reject) => {
      this.sftp.readdir(path, (err: Error, list: any[]) => {
        if (err) {
          reject(err);
          return;
        }
        
        const entries: FileEntry[] = list.map(item => ({
          name: item.filename,
          path: `${path}/${item.filename}`.replace(/\/+/g, '/'),
          isDirectory: item.attrs.isDirectory(),
          size: item.attrs.size,
          modifyTime: item.attrs.mtime * 1000,
          permissions: item.attrs.mode,
          owner: item.attrs.uid,
          group: item.attrs.gid
        }));
        
        resolve(entries);
      });
    });
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
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
    
    const client = new SFTPClient(sessionInfo);
    await client.connect();
    this.clients.set(connectionId, client);
  }

  /**
   * 获取SFTP客户端
   * @param connectionId 连接ID
   */
  getClient(connectionId: string): SFTPClient | undefined {
    return this.clients.get(connectionId);
  }

  /**
   * 读取目录内容
   * @param connectionId 连接ID
   * @param path 目录路径
   */
  async readDirectory(connectionId: string, path: string): Promise<FileEntry[]> {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.readDirectory(path);
  }

  /**
   * 关闭SFTP客户端
   * @param connectionId 连接ID
   */
  async closeClient(connectionId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    if (client) {
      await client.close();
      this.clients.delete(connectionId);
    }
  }
}

// 导出单例
export const sftpManager = new SFTPManager(); 