import { Client, SFTPWrapper } from 'ssh2';
import type { FileEntry } from '../types/file';
import { sshService } from './ssh';

interface SFTPError extends Error {
  code?: string;
  message: string;
}

interface SFTPAttributes {
  size: number;
  uid: number;
  gid: number;
  mode: number;
  atime: number;
  mtime: number;
  isDirectory: () => boolean;
}

interface SFTPFile {
  filename: string;
  longname: string;
  attrs: SFTPAttributes;
}

class SFTPService {
  private sftpClients: Map<string, SFTPWrapper>;

  constructor() {
    this.sftpClients = new Map();
  }

  /**
   * 获取SFTP客户端
   */
  private async getSFTPClient(sessionId: string): Promise<SFTPWrapper> {
    console.log(`[SFTP] 尝试获取SFTP客户端: ${sessionId}`);

    // 检查SSH连接状态
    if (!sshService.isConnected(sessionId)) {
      console.error(`[SFTP] SSH连接未建立: ${sessionId}`);
      throw new Error('SSH connection not established');
    }

    // 如果已经存在SFTP客户端，直接返回
    if (this.sftpClients.has(sessionId)) {
      console.log(`[SFTP] 使用现有SFTP客户端: ${sessionId}`);
      return this.sftpClients.get(sessionId)!;
    }

    // 获取SSH连接
    const conn = sshService.getConnection(sessionId);
    if (!conn) {
      console.error(`[SFTP] 无法获取SSH连接: ${sessionId}`);
      throw new Error('No SSH connection found');
    }

    // 创建SFTP客户端
    return new Promise<SFTPWrapper>((resolve, reject) => {
      console.log(`[SFTP] 正在创建新的SFTP客户端: ${sessionId}`);
      conn.sftp((err, sftp) => {
        if (err) {
          console.error(`[SFTP] 创建SFTP客户端失败:`, err);
          reject(new Error(`Failed to create SFTP client: ${err.message}`));
          return;
        }
        console.log(`[SFTP] SFTP客户端创建成功: ${sessionId}`);
        this.sftpClients.set(sessionId, sftp);
        resolve(sftp);
      });
    });
  }

  /**
   * 读取目录内容
   */
  async readDirectory(sessionId: string, path: string): Promise<FileEntry[]> {
    console.log(`[SFTP] 开始读取目录: ${path}, sessionId: ${sessionId}`);
    try {
      const sftp = await this.getSFTPClient(sessionId);
      console.log(`[SFTP] 成功获取SFTP客户端`);
      
      return new Promise<FileEntry[]>((resolve, reject) => {
        console.log(`[SFTP] 正在读取目录...`);
        sftp.readdir(path, (err, list) => {
          if (err) {
            console.error(`[SFTP] 读取目录失败:`, err);
            reject(new Error(`Failed to read directory: ${err.message}`));
            return;
          }

          console.log(`[SFTP] 读取到 ${list.length} 个条目`);
          // 转换为FileEntry格式
          const entries: FileEntry[] = list.map(item => ({
            name: item.filename,
            path: `${path}/${item.filename}`.replace(/\/+/g, '/'),
            isDirectory: item.attrs.isDirectory(),
            size: item.attrs.size,
            modifyTime: new Date(item.attrs.mtime * 1000),
            permissions: item.attrs.mode,
            owner: item.attrs.uid,
            group: item.attrs.gid
          }));

          console.log(`[SFTP] 转换完成，返回数据`);
          resolve(entries);
        });
      });
    } catch (error) {
      console.error('[SFTP] 读取目录失败:', error);
      throw error;
    }
  }

  /**
   * 关闭SFTP客户端
   */
  async closeSFTPClient(sessionId: string): Promise<void> {
    const sftp = this.sftpClients.get(sessionId);
    if (sftp) {
      sftp.end();
      this.sftpClients.delete(sessionId);
    }
  }
}

export const sftpService = new SFTPService(); 