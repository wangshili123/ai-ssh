import { ipcMain } from 'electron';
import { aiConfigService } from '../services/ai-config';

// 注册 AI 配置相关的 IPC 处理程序
export function registerAIConfigHandlers() {
  console.log('开始注册 AI 配置处理程序...');

  // 加载配置
  ipcMain.handle('ai-config:load', async () => {
    console.log('收到加载配置请求');
    try {
      const config = await aiConfigService.loadConfig();
      console.log('配置加载成功:', config);
      return { success: true, data: config };
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
      return { success: false, error: '加载配置失败' };
    }
  });

  // 保存配置
  ipcMain.handle('ai-config:save', async (_, config) => {
    console.log('收到保存配置请求:', config);
    try {
      await aiConfigService.saveConfig(config);
      console.log('配置保存成功');
      return { success: true };
    } catch (error) {
      console.error('保存 AI 配置失败:', error);
      return { success: false, error: '保存配置失败' };
    }
  });

  // 测试配置
  ipcMain.handle('ai-config:test', async (_, config) => {
    console.log('收到测试配置请求:', config);
    try {
      const isValid = await aiConfigService.testConfig(config);
      console.log('配置测试结果:', isValid);
      return { success: true, data: isValid };
    } catch (error) {
      console.error('测试 AI 配置失败:', error);
      return { success: false, error: '测试配置失败' };
    }
  });

  console.log('AI 配置处理程序注册完成');
} 