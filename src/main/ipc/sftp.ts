import { ipcMain } from 'electron';
import { sftpService } from '../services/sftp';
import type { FileEntry } from '../types/file';

interface IPCResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 注册SFTP相关的IPC处理器
 */
export function initSFTPHandlers() {
  console.log('初始化SFTP处理器...');

  // 读取目录内容
  ipcMain.handle('sftp:read-directory', async (_, sessionId: string, path: string): Promise<IPCResponse<FileEntry[]>> => {
    try {
      const entries = await sftpService.readDirectory(sessionId, path);
      return { success: true, data: entries };
    } catch (error: any) {
      console.error('读取目录失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 关闭SFTP客户端
  ipcMain.handle('sftp:close', async (_, sessionId: string): Promise<IPCResponse> => {
    try {
      await sftpService.closeSFTPClient(sessionId);
      return { success: true };
    } catch (error: any) {
      console.error('关闭SFTP客户端失败:', error);
      return { success: false, error: error.message };
    }
  });

  console.log('SFTP处理器初始化完成');
} 