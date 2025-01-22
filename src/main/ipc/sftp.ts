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
        console.log(`[SFTP] 创建客户端 - connectionId: ${connectionId}`);
        await sftpManager.createClient(connectionId, sessionInfo);
        return { success: true };
      } catch (error) {
        console.error(`[SFTP] 创建客户端失败:`, error);
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
        console.log(`[SFTP] 读取目录 - connectionId: ${connectionId}, path: ${path}`);
        const entries = await sftpManager.readDirectory(connectionId, path);
        return {
          success: true,
          data: entries
        };
      } catch (error) {
        console.error(`[SFTP] 读取目录失败:`, error);
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  );

  // 获取当前路径
  ipcMain.handle('sftp:get-current-path',
    async (event, connectionId: string): Promise<Result<string>> => {
      try {
        console.log(`[SFTP] 获取当前路径 - connectionId: ${connectionId}`);
        const path = sftpManager.getCurrentPath(connectionId);
        return {
          success: true,
          data: path
        };
      } catch (error) {
        console.error(`[SFTP] 获取当前路径失败:`, error);
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  );

  // 获取路径历史
  ipcMain.handle('sftp:get-path-history',
    async (event, connectionId: string): Promise<Result<string[]>> => {
      try {
        console.log(`[SFTP] 获取路径历史 - connectionId: ${connectionId}`);
        const history = sftpManager.getPathHistory(connectionId);
        return {
          success: true,
          data: history
        };
      } catch (error) {
        console.error(`[SFTP] 获取路径历史失败:`, error);
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
        console.log(`[SFTP] 关闭客户端 - connectionId: ${connectionId}`);
        await sftpManager.closeClient(connectionId);
        return { success: true };
      } catch (error) {
        console.error(`[SFTP] 关闭客户端失败:`, error);
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  );
} 