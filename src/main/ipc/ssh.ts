import { ipcMain } from 'electron';
import { sshService } from '../services/ssh';
import type { SessionInfo } from '../../renderer/types';

// 初始化SSH相关的IPC处理器
export function initSSHHandlers() {
  console.log('Initializing SSH handlers...');

  // 连接到SSH服务器
  ipcMain.handle('ssh:connect', async (_, sessionInfo: SessionInfo) => {
    console.log('Handling ssh:connect...', sessionInfo);
    try {
      await sshService.connect(sessionInfo);
      return { success: true };
    } catch (error: any) {
      console.error('SSH connect error:', error);
      return { success: false, error: error.message };
    }
  });

  // 断开SSH连接
  ipcMain.handle('ssh:disconnect', async (_, sessionId: string) => {
    try {
      await sshService.disconnect(sessionId);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 创建Shell会话
  ipcMain.handle('ssh:create-shell', async (_, sessionId: string, initialSize?: { rows: number; cols: number }) => {
    try {
      await sshService.createShell(sessionId, initialSize);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 向Shell发送数据
  ipcMain.handle('ssh:write', async (_, sessionId: string, data: string) => {
    try {
      await sshService.write(sessionId, data);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 调整Shell大小
  ipcMain.handle('ssh:resize', async (_, sessionId: string, cols: number, rows: number) => {
    try {
      await sshService.resize(sessionId, cols, rows);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 直接执行命令
  ipcMain.handle('ssh:execute-command', async (_, sessionId: string, command: string) => {
    try {
      const result = await sshService.executeCommandDirect(sessionId, command);
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  console.log('SSH handlers initialized.');
} 