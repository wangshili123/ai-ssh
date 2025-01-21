import { ipcRenderer } from 'electron';
import type { FileEntry } from '../../main/types/file';

class SFTPService {
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
    const result = await ipcRenderer.invoke('sftp:close', sessionId);
    if (!result.success) {
      throw new Error(result.error);
    }
  }
}

export const sftpService = new SFTPService(); 