import { ipcRenderer } from 'electron';
import type { AIConfig } from '../../main/services/ai-config';

class AIConfigService {
  // 加载配置
  async loadConfig(): Promise<AIConfig> {
    console.log('正在加载AI配置...');
    try {
      const response = await ipcRenderer.invoke('ai-config:load');
      if (!response.success) {
        console.error('加载AI配置失败:', response.error);
        throw new Error(response.error);
      }
      console.log('AI配置加载成功:', response.data);
      return response.data;
    } catch (error) {
      console.error('加载AI配置时发生错误:', error);
      throw error;
    }
  }

  // 保存配置
  async saveConfig(config: AIConfig): Promise<void> {
    console.log('正在保存AI配置:', config);
    try {
      const response = await ipcRenderer.invoke('ai-config:save', config);
      if (!response.success) {
        console.error('保存AI配置失败:', response.error);
        throw new Error(response.error);
      }
      console.log('AI配置保存成功');
    } catch (error) {
      console.error('保存AI配置时发生错误:', error);
      throw error;
    }
  }

  // 测试配置
  async testConfig(config: AIConfig): Promise<boolean> {
    console.log('正在测试AI配置:', config);
    try {
      const response = await ipcRenderer.invoke('ai-config:test', config);
      if (!response.success) {
        console.error('测试AI配置失败:', response.error);
        throw new Error(response.error);
      }
      console.log('AI配置测试结果:', response.data);
      return response.data;
    } catch (error) {
      console.error('测试AI配置时发生错误:', error);
      throw error;
    }
  }
}

export const aiConfigService = new AIConfigService(); 