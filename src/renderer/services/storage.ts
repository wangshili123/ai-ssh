import { ipcRenderer } from 'electron';
import { SessionInfo } from '../../main/services/storage';

class StorageService {
  // 保存会话数据
  async saveSessions(sessions: SessionInfo[]): Promise<void> {
    const result = await ipcRenderer.invoke('storage:save-sessions', sessions);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  // 加载会话数据
  async loadSessions(): Promise<SessionInfo[]> {
    const result = await ipcRenderer.invoke('storage:load-sessions');
    if (!result.success) {
      throw new Error(result.error);
    }
    return result.data;
  }

  // 导出配置
  async exportConfig(): Promise<void> {
    const result = await ipcRenderer.invoke('storage:export-config');
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  // 导入配置
  async importConfig(): Promise<void> {
    const result = await ipcRenderer.invoke('storage:import-config');
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  // 备份配置
  async backup(): Promise<void> {
    const result = await ipcRenderer.invoke('storage:backup');
    if (!result.success) {
      throw new Error(result.error);
    }
  }
}

export const storageService = new StorageService(); 