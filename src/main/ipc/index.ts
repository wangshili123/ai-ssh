import { registerStorageHandlers } from './storage';
import { initSSHHandlers } from './ssh';
import { registerAIConfigHandlers } from './ai-config';

// 注册所有 IPC 处理程序
export function registerAllHandlers() {
  console.log('开始注册所有 IPC 处理程序...');
  
  try {
    // 注册存储处理程序
    console.log('注册存储处理程序...');
    registerStorageHandlers();
    
    // 注册 SSH 处理程序
    console.log('注册 SSH 处理程序...');
    initSSHHandlers();
    
    // 注册 AI 配置处理程序
    console.log('注册 AI 配置处理程序...');
    registerAIConfigHandlers();
    
    console.log('所有 IPC 处理程序注册完成');
  } catch (error) {
    console.error('注册 IPC 处理程序时出错:', error);
    throw error;
  }
} 