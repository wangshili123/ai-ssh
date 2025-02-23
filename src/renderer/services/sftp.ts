import { ipcRenderer } from 'electron';
import type { FileEntry } from '../../main/types/file';
import type { SessionInfo } from '../types';

class SFTPService {
  /**
   * 创建 SFTP 客户端
   */
  async createClient(connectionId: string, sessionInfo: SessionInfo): Promise<void> {
    const result = await ipcRenderer.invoke('sftp:create-client', connectionId, sessionInfo);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  /**
   * 读取目录内容
   */
  async readDirectory(sessionId: string, path: string): Promise<FileEntry[]> {
    const result = await ipcRenderer.invoke('sftp:read-directory', sessionId, path);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data!;
  }

  /**
   * 关闭SFTP客户端
   */
  async close(sessionId: string): Promise<void> {
    const result = await ipcRenderer.invoke('sftp:close-client', sessionId);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  /**
   * 读取文件内容
   * @param sessionId 会话ID
   * @param filePath 文件路径
   * @param start 起始位置
   * @param length 读取长度
   * @param encoding 编码方式
   */
  async readFile(
    sessionId: string,
    filePath: string,
    start: number = 0,
    length: number = -1,
    encoding: BufferEncoding | 'binary' = 'utf8'
  ): Promise<{
    content: string;
    totalSize: number;
    bytesRead: number;
  }> {
    const result = await ipcRenderer.invoke('sftp:read-file', sessionId, filePath, start, length, encoding);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data!;
  }

  /**
   * 写入文件内容
   * @param sessionId 会话ID
   * @param filePath 文件路径
   * @param content 文件内容
   * @param encoding 编码方式
   */
  async writeFile(
    sessionId: string,
    filePath: string,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    const result = await ipcRenderer.invoke('sftp:write-file', sessionId, filePath, content, encoding);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  /**
   * 获取文件状态信息
   * @param sessionId 会话ID
   * @param filePath 文件路径
   */
  async stat(
    sessionId: string,
    filePath: string
  ): Promise<{
    size: number;
    modifyTime: number;
    isDirectory: boolean;
    permissions: number;
  }> {
    const result = await ipcRenderer.invoke('sftp:stat', sessionId, filePath);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data!;
  }

  /**
   * 读取文件指定范围的内容
   * @param sessionId 会话ID
   * @param filePath 文件路径
   * @param start 起始位置
   * @param size 读取大小
   * @param encoding 编码方式
   */
  async readChunk(
    sessionId: string,
    filePath: string,
    start: number = 0,
    size: number = -1,
    encoding: BufferEncoding | 'binary' = 'utf8'
  ): Promise<{
    content: string;
    totalSize: number;
    bytesRead: number;
  }> {
    const result = await ipcRenderer.invoke('sftp:read-file', sessionId, filePath, start, size, encoding);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data!;
  }
}

export const sftpService = new SFTPService(); 