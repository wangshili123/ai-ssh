import { ipcMain, dialog } from 'electron';
import { storageService, GroupInfo, UISettings } from '../services/storage';
import type { SessionInfo } from '../../renderer/types/index';

interface IPCResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// 注册IPC处理器
export function registerStorageHandlers(): void {
  // 保存会话
  ipcMain.handle('storage:save-sessions', async (_, sessions: SessionInfo[]): Promise<IPCResponse> => {
    try {
      await storageService.saveSessions(sessions);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('保存会话失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 加载会话
  ipcMain.handle('storage:load-sessions', async (): Promise<IPCResponse<SessionInfo[]>> => {
    try {
      const sessions = await storageService.loadSessions();
      return { success: true, data: sessions };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('加载会话失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 导出配置
  ipcMain.handle('storage:export-config', async (): Promise<IPCResponse> => {
    try {
      const { filePath } = await dialog.showSaveDialog({
        filters: [
          { name: 'JSON', extensions: ['json'] }
        ],
        defaultPath: 'sessions-config.json'
      });

      if (filePath) {
        await storageService.exportConfig(filePath);
        return { success: true };
      }
      return { success: false, error: '未选择保存位置' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('导出配置失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 导入配置
  ipcMain.handle('storage:import-config', async (): Promise<IPCResponse> => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        filters: [
          { name: 'JSON', extensions: ['json'] }
        ],
        properties: ['openFile']
      });

      if (filePaths.length > 0) {
        await storageService.importConfig(filePaths[0]);
        return { success: true };
      }
      return { success: false, error: '未选择文件' };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('导入配置失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 备份配置
  ipcMain.handle('storage:backup', async (): Promise<IPCResponse> => {
    try {
      await storageService.backup();
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('备份配置失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 保存分组
  ipcMain.handle('storage:save-groups', async (_, groups: GroupInfo[]): Promise<IPCResponse> => {
    try {
      await storageService.saveGroups(groups);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('保存分组失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 加载分组
  ipcMain.handle('storage:load-groups', async (): Promise<IPCResponse<GroupInfo[]>> => {
    try {
      const groups = await storageService.loadGroups();
      return { success: true, data: groups };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('加载分组失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 保存UI设置
  ipcMain.handle('storage:save-ui-settings', async (_, settings: UISettings): Promise<IPCResponse> => {
    try {
      await storageService.saveUISettings(settings);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('保存UI设置失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 加载UI设置
  ipcMain.handle('storage:load-ui-settings', async (): Promise<IPCResponse<UISettings>> => {
    try {
      const settings = await storageService.loadUISettings();
      return { success: true, data: settings };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('加载UI设置失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 保存基础配置
  ipcMain.handle('storage:save-base-config', async (_, config: any): Promise<IPCResponse> => {
    try {
      await storageService.saveBaseConfig(config);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('保存基础配置失败:', error);
      return { success: false, error: errorMessage };
    }
  });

  // 加载基础配置
  ipcMain.handle('storage:load-base-config', async (): Promise<IPCResponse<any>> => {
    try {
      const config = await storageService.loadBaseConfig();
      return { success: true, data: config };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      console.error('加载基础配置失败:', error);
      return { success: false, error: errorMessage };
    }
  });
}