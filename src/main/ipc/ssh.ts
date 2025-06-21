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

  // 检查SSH连接状态
  ipcMain.handle('ssh:is-connected', async (_, sessionId: string) => {
    try {
      const isConnected = sshService.isConnected(sessionId);
      return { success: true, data: isConnected };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 直接执行SSH命令
  ipcMain.handle('ssh:execute-command-direct', async (_, sessionId: string, command: string) => {
    try {
      const result = await sshService.executeCommandDirect(sessionId, command);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('SSH execute command direct error:', error);
      return { success: false, error: error.message };
    }
  });

  // 获取SFTP连接（复用SSH连接）
  ipcMain.handle('ssh:get-sftp-connection', async (_, sessionId: string) => {
    try {
      const sftpConnection = await sshService.getSFTPConnection(sessionId);
      // 存储SFTP连接引用，用于后续操作
      const connectionId = `sftp-${sessionId}-${Date.now()}`;
      // 这里需要一个全局的SFTP连接管理器来存储连接
      return { success: true, data: { connectionId, available: true } };
    } catch (error: any) {
      console.error('SSH get SFTP connection error:', error);
      return { success: false, error: error.message };
    }
  });

  // 获取连接状态统计（新增）
  ipcMain.handle('ssh:get-connection-stats', async (_, sessionId: string) => {
    try {
      const { GlobalSSHManager } = await import('../services/GlobalSSHManager');
      const globalManager = GlobalSSHManager.getInstance();
      const stats = globalManager.getConnectionStats(sessionId);
      return { success: true, data: stats };
    } catch (error: any) {
      console.error('SSH get connection stats error:', error);
      return { success: false, error: error.message };
    }
  });

  // 执行健康检查（新增）
  ipcMain.handle('ssh:health-check', async () => {
    try {
      const { GlobalSSHManager } = await import('../services/GlobalSSHManager');
      const globalManager = GlobalSSHManager.getInstance();
      await globalManager.healthCheck();
      return { success: true };
    } catch (error: any) {
      console.error('SSH health check error:', error);
      return { success: false, error: error.message };
    }
  });

  // 释放传输连接池（新增）
  ipcMain.handle('ssh:release-transfer-pool', async (_, sessionId: string) => {
    try {
      const { GlobalSSHManager } = await import('../services/GlobalSSHManager');
      const globalManager = GlobalSSHManager.getInstance();
      await globalManager.releaseTransferPool(sessionId);
      return { success: true };
    } catch (error: any) {
      console.error('SSH release transfer pool error:', error);
      return { success: false, error: error.message };
    }
  });

  // 释放SFTP连接
  ipcMain.handle('ssh:release-sftp-connection', async (_, sessionId: string, connectionId: string) => {
    try {
      // 这里需要从全局SFTP连接管理器中获取连接并释放
      console.log(`[SSH] 释放SFTP连接: ${sessionId}, connectionId: ${connectionId}`);
      return { success: true };
    } catch (error: any) {
      console.error('SSH release SFTP connection error:', error);
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