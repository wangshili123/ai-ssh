import { ipcMain } from 'electron';
import { sftpService } from '../services/sftp';
import type { FileEntry } from '../types/file';

interface IPCResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 初始化SFTP相关的IPC处理器
 */
export function initSFTPHandlers() {
  console.log('Initializing SFTP handlers...');

  // 读取目录内容
  ipcMain.handle('sftp:read-directory', async (_, sessionId: string, path: string): Promise<IPCResponse<FileEntry[]>> => {
    try {
      console.log(`[IPC] 处理 sftp:read-directory 请求: sessionId=${sessionId}, path=${path}`);
      const entries = await sftpService.readDirectory(sessionId, path);
      return { success: true, data: entries };
    } catch (error: any) {
      console.error('[IPC] SFTP read directory error:', error);
      return { success: false, error: error.message };
    }
  });

  // 关闭SFTP客户端
  ipcMain.handle('sftp:close', async (_, sessionId: string): Promise<IPCResponse> => {
    try {
      console.log(`[IPC] 处理 sftp:close 请求: sessionId=${sessionId}`);
      await sftpService.closeSFTPClient(sessionId);
      return { success: true };
    } catch (error: any) {
      console.error('[IPC] SFTP close error:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('SFTP handlers initialized.');
} 