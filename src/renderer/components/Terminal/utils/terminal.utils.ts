import { sshService } from '../../../services/ssh';
import type { SessionInfo } from '../../../../renderer/types/index';

// 检查是否在主进程中
const isMainProcess = typeof window === 'undefined';
let ipcRenderer: any = null;

if (!isMainProcess) {
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (error) {
    console.warn('[terminal.utils] 无法导入 ipcRenderer:', error);
  }
}

// 检查主进程SSH连接是否存在
const checkMainProcessConnection = async (sessionId: string): Promise<boolean> => {
  if (!ipcRenderer) return false;

  try {
    const result = await ipcRenderer.invoke('ssh:is-connected', sessionId);
    return result.success && result.data;
  } catch (error) {
    console.error('[terminal.utils] 检查主进程连接失败:', error);
    return false;
  }
};

// 等待 SSH 连接就绪（优化版：支持连接复用和更好的错误处理）
export const waitForConnection = async (sessionInfo: SessionInfo): Promise<void> => {
  console.log(`[terminal.utils] 等待连接就绪: ${sessionInfo.id}`);

  // 1. 首先检查主进程是否已有连接
  const hasExistingConnection = await checkMainProcessConnection(sessionInfo.id);
  if (hasExistingConnection) {
    console.log(`[terminal.utils] 发现现有连接，直接复用: ${sessionInfo.id}`);
    return;
  }

  // 2. 如果没有现有连接，创建新连接
  console.log(`[terminal.utils] 没有现有连接，创建新连接: ${sessionInfo.id}`);
  let retries = 3; // 减少重试次数，避免长时间等待
  let lastError: any = null;

  while (retries > 0) {
    try {
      console.log(`[terminal.utils] 尝试连接 (剩余重试: ${retries}): ${sessionInfo.id}`);
      await sshService.connect(sessionInfo);
      console.log(`[terminal.utils] 连接创建成功: ${sessionInfo.id}`);
      return;
    } catch (error) {
      lastError = error;
      retries--;
      console.error(`[terminal.utils] 连接失败，剩余重试次数: ${retries}`, error);

      if (retries === 0) {
        // 最后一次重试失败，抛出详细错误信息
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`连接失败: ${errorMessage}. 请检查网络连接和服务器状态。`);
      }

      // 等待2秒后重试
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};