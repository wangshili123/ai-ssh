import { ipcMain } from 'electron';
import { sftpManager } from '../services/sftp';
import { Result } from '../types/common';
import type { FileEntry } from '../types/file';
import type { SessionInfo } from '../../renderer/types';

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

  // 读取文件内容
  ipcMain.handle('sftp:read-file',
    async (event, connectionId: string, filePath: string, start: number = 0, length: number = -1, encoding: BufferEncoding | 'binary' = 'utf8'): Promise<Result<{
      content: string;
      totalSize: number;
      bytesRead: number;
    }>> => {
      try {
        console.log(`[SFTP] 读取文件 - connectionId: ${connectionId}, path: ${filePath}, start: ${start}, length: ${length}`);
        
        // 先获取文件状态
        const stats = await sftpManager.stat(connectionId, filePath);
        
        // 如果文件大小为0，直接返回空内容
        if (stats.size === 0) {
          return {
            success: true,
            data: {
              content: '',
              totalSize: 0,
              bytesRead: 0
            }
          };
        }

        const result = await sftpManager.readFile(connectionId, filePath, start, length, encoding);
        return {
          success: true,
          data: result
        };
      } catch (error) {
        console.error(`[SFTP] 读取文件失败:`, error);
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  );

  // 写入文件内容
  ipcMain.handle('sftp:write-file',
    async (event, connectionId: string, filePath: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<Result<void>> => {
      try {
        console.log(`[SFTP] 写入文件 - connectionId: ${connectionId}, path: ${filePath}`);
        await sftpManager.writeFile(connectionId, filePath, content, encoding);
        return { success: true };
      } catch (error) {
        console.error(`[SFTP] 写入文件失败:`, error);
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  );

  // 获取文件状态
  ipcMain.handle('sftp:stat',
    async (event, connectionId: string, filePath: string): Promise<Result<{
      size: number;
      modifyTime: number;
      isDirectory: boolean;
      permissions: number;
    }>> => {
      try {
        console.log(`[SFTP] 获取文件状态 - connectionId: ${connectionId}, path: ${filePath}`);
        const stats = await sftpManager.stat(connectionId, filePath);
        return {
          success: true,
          data: stats
        };
      } catch (error) {
        console.error(`[SFTP] 获取文件状态失败:`, error);
        return {
          success: false,
          error: (error as Error).message
        };
      }
    }
  );
} 