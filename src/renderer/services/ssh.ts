import { ipcRenderer } from 'electron';
import type { SessionInfo } from '../../main/services/storage';
import { terminalOutputService } from './terminalOutput';
import { eventBus } from './eventBus';

console.log('Loading renderer SSH service...');

class SSHService {
  private dataCallbacks: Map<string, (data: string) => void>;
  private closeCallbacks: Map<string, () => void>;

  constructor() {
    console.log('Initializing renderer SSHService...');
    this.dataCallbacks = new Map();
    this.closeCallbacks = new Map();
  }

  async connect(sessionInfo: SessionInfo) {
    console.log('Renderer SSHService.connect called with:', sessionInfo);
    const result = await ipcRenderer.invoke('ssh:connect', sessionInfo);
    console.log('SSH connect result:', result);
    if (!result.success) {
      console.error('SSH connect error in renderer:', result.error);
      throw new Error(result.error);
    }
  }

  async disconnect(sessionId: string) {
    console.log('Renderer SSHService.disconnect called with:', sessionId);
    const result = await ipcRenderer.invoke('ssh:disconnect', sessionId);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  async createShell(sessionId: string, onData: (data: string) => void, onClose?: () => void) {
    console.log('Renderer SSHService.createShell called with:', sessionId);
    
    // 设置数据和关闭事件监听器
    const dataChannel = `ssh:data:${sessionId}`;
    const closeChannel = `ssh:close:${sessionId}`;
    
    console.log('Setting up event listeners for channels:', { dataChannel, closeChannel });
    
    // 注册数据回调
    this.dataCallbacks.set(sessionId, onData);
    ipcRenderer.on(dataChannel, (_, data: string) => {
      console.log('Received SSH data:', { sessionId, data });
      onData(data);
    });

    // 注册关闭回调
    if (onClose) {
      this.closeCallbacks.set(sessionId, onClose);
      ipcRenderer.on(closeChannel, () => {
        console.log('SSH connection closed:', sessionId);
        onClose();
        this.dataCallbacks.delete(sessionId);
        this.closeCallbacks.delete(sessionId);
        // 移除事件监听器
        ipcRenderer.removeAllListeners(dataChannel);
        ipcRenderer.removeAllListeners(closeChannel);
      });
    }

    // 创建shell
    const result = await ipcRenderer.invoke('ssh:create-shell', sessionId);
    if (!result.success) {
      // 清理事件监听器
      ipcRenderer.removeAllListeners(dataChannel);
      ipcRenderer.removeAllListeners(closeChannel);
      throw new Error(result.error);
    }
  }

  async write(sessionId: string, data: string) {
    console.log('Renderer SSHService.write called with:', { sessionId, data });
    const result = await ipcRenderer.invoke('ssh:write', sessionId, data);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  async executeCommand(command: string) {
    console.log('Renderer SSHService.executeCommand called with:', { command });
    
    // 获取当前活动的 shell ID
    const currentShellId = eventBus.getCurrentShellId();
    if (!currentShellId) {
      throw new Error('No active shell session found');
    }

    // 记录命令到历史记录
    terminalOutputService.addCommand(command);

    try {
      // 发送命令到终端
      await this.write(currentShellId, command + '\n');

      // 等待命令执行完成
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Command execution timeout'));
        }, 360000); // 360秒超时

        const checkOutput = () => {
          const output = terminalOutputService.getHistory();
          const lastOutput = output[output.length - 1]?.output;
          
          // 检查输出中是否包含命令提示符（$ 或 #）
          if (lastOutput && (lastOutput.includes('$ ') || lastOutput.includes('# '))) {
            clearTimeout(timeout);
            resolve();
          } else {
            setTimeout(checkOutput, 100);
          }
        };

        checkOutput();
      });
    } catch (error) {
      console.error('Failed to execute command:', error);
      throw error;
    }
  }

  async resize(sessionId: string, cols: number, rows: number) {
    console.log('Renderer SSHService.resize called with:', { sessionId, cols, rows });
    const result = await ipcRenderer.invoke('ssh:resize', sessionId, cols, rows);
    if (!result.success) {
      throw new Error(result.error);
    }
  }
}

console.log('Creating renderer SSH service instance...');
export const sshService = new SSHService();
console.log('Renderer SSH service instance created.'); 