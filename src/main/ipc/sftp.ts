import { ipcMain } from 'electron';
import { sftpManager } from '../services/sftp';
import { Result } from '../types/common';
import type { FileEntry } from '../types/file';
import type { SessionInfo } from '../types/storage';

/**
 * 注册SFTP相关的IPC处理器
 */
export function registerSFTPHandlers(): void {
  // 创建SFTP客户端
  ipcMain.handle('sftp:create-client', 
    async (event, connectionId: string, sessionInfo: SessionInfo): Promise<Result<void>> => {
      try {
        await sftpManager.createClient(connectionId, sessionInfo);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  );

  // 读取目录内容
  ipcMain.handle('sftp:read-directory',
    async (event, connectionId: string, path: string): Promise<Result<FileEntry[]>> => {
      try {
        const entries = await sftpManager.readDirectory(connectionId, path);
        return {
          success: true,
          data: entries
        };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  );

  // 关闭SFTP客户端
  ipcMain.handle('sftp:close-client',
    async (event, connectionId: string): Promise<Result<void>> => {
      try {
        await sftpManager.closeClient(connectionId);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  );
} 