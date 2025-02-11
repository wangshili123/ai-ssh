import { ipcRenderer } from 'electron';
import type { GroupInfo, UISettings } from '../../main/services/storage';
import type { SessionInfo } from '../../renderer/types/index';

// 会话存储服务
class StorageService {
  // 保存会话列表
  async saveSessions(sessions: SessionInfo[]): Promise<void> {
    const response = await ipcRenderer.invoke('storage:save-sessions', sessions);
    if (!response.success) {
      throw new Error(response.error);
    }
  }

  // 加载会话列表
  async loadSessions(): Promise<SessionInfo[]> {
    const response = await ipcRenderer.invoke('storage:load-sessions');
    if (!response.success) {
      throw new Error(response.error);
    }
    return response.data || [];
  }

  // 保存分组列表
  async saveGroups(groups: GroupInfo[]): Promise<void> {
    const response = await ipcRenderer.invoke('storage:save-groups', groups);
    if (!response.success) {
      throw new Error(response.error);
    }
  }

  // 加载分组列表
  async loadGroups(): Promise<GroupInfo[]> {
    const response = await ipcRenderer.invoke('storage:load-groups');
    if (!response.success) {
      throw new Error(response.error);
    }
    return response.data || [];
  }

  // 导出配置
  async exportConfig(): Promise<void> {
    const response = await ipcRenderer.invoke('storage:export-config');
    if (!response.success) {
      throw new Error(response.error);
    }
  }

  // 导入配置
  async importConfig(): Promise<void> {
    const response = await ipcRenderer.invoke('storage:import-config');
    if (!response.success) {
      throw new Error(response.error);
    }
  }

  // 备份配置
  async backup(): Promise<void> {
    const response = await ipcRenderer.invoke('storage:backup');
    if (!response.success) {
      throw new Error(response.error);
    }
  }

  // 保存UI设置
  async saveUISettings(settings: UISettings): Promise<void> {
    const response = await ipcRenderer.invoke('storage:save-ui-settings', settings);
    if (!response.success) {
      throw new Error(response.error);
    }
  }

  // 加载UI设置
  async loadUISettings(): Promise<UISettings> {
    const response = await ipcRenderer.invoke('storage:load-ui-settings');
    if (!response.success) {
      throw new Error(response.error);
    }
    return response.data || { isFileBrowserVisible: true, isAIVisible: false };
  }
}

export const storageService = new StorageService(); 