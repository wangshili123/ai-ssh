import { ipcRenderer } from 'electron';
import type { SessionInfo } from '../../renderer/types/index';
import { terminalOutputService } from './terminalOutput';
import { eventBus } from './eventBus';

console.log('Loading renderer SSH service...');

class SSHService {
  private dataCallbacks: Map<string, (data: string) => void>;
  private closeCallbacks: Map<string, () => void>;
  private currentDirectories: Map<string, string> = new Map();

  constructor() {
    console.log('Initializing renderer SSHService...');
    this.dataCallbacks = new Map();
    this.closeCallbacks = new Map();

    // 监听目录变更事件
    ipcRenderer.on('ssh:directory-change', (_, { shellId, directory }) => {
      this.currentDirectories.set(shellId, directory);
    });
  }

  async connect(sessionInfo: SessionInfo) {
    const result = await ipcRenderer.invoke('ssh:connect', sessionInfo);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  async disconnect(sessionId: string) {
    const result = await ipcRenderer.invoke('ssh:disconnect', sessionId);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  async createShell(
    sessionId: string, 
    onData: (data: string) => void,
    onClose?: () => void,
    initialSize?: { rows: number; cols: number }
  ) {
    const dataChannel = `ssh:data:${sessionId}`;
    const closeChannel = `ssh:close:${sessionId}`;
    
    this.dataCallbacks.set(sessionId, onData);
    ipcRenderer.on(dataChannel, (_, data: string) => {
      onData(data);
    });

    if (onClose) {
      this.closeCallbacks.set(sessionId, onClose);
      ipcRenderer.on(closeChannel, () => {
        onClose();
        this.dataCallbacks.delete(sessionId);
        this.closeCallbacks.delete(sessionId);
        ipcRenderer.removeAllListeners(dataChannel);
        ipcRenderer.removeAllListeners(closeChannel);
      });
    }

    const result = await ipcRenderer.invoke('ssh:create-shell', sessionId, initialSize);
    if (!result.success) {
      ipcRenderer.removeAllListeners(dataChannel);
      ipcRenderer.removeAllListeners(closeChannel);
      throw new Error(result.error);
    }
  }

  async write(sessionId: string, data: string) {
    // 直接发送数据，不做任何缓冲或延迟
    const result = await ipcRenderer.invoke('ssh:write', sessionId, data);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  async executeCommand(command: string): Promise<string> {
    const currentShellId = eventBus.getCurrentShellId();
    if (!currentShellId) {
      throw new Error('No active shell session found');
    }

    terminalOutputService.addCommand(command);

    try {
      await this.write(currentShellId, command + '\n');

      return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Command execution timeout'));
        }, 360000);

        const checkOutput = () => {
          const output = terminalOutputService.getHistory();
          const lastOutput = output[output.length - 1]?.output || '';
          
          if (lastOutput && (lastOutput.includes('$ ') || lastOutput.includes('# '))) {
            clearTimeout(timeout);
            resolve(lastOutput);
          } else {
            setTimeout(checkOutput, 10);
          }
        };

        checkOutput();
      });
    } catch (error) {
      console.error('Failed to execute command:', error);
      throw error;
    }
  }

  // 新增：直接执行命令（不依赖shell session）
  async executeCommandDirect(sessionId: string, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      ipcRenderer.invoke('ssh:execute-command', sessionId, command)
        .then((result: any) => {
          if (result.success) {
            resolve(result.data);
          } else {
            reject(new Error(result.error));
          }
        })
        .catch(reject);
    });
  }

  async resize(sessionId: string, cols: number, rows: number) {
    const result = await ipcRenderer.invoke('ssh:resize', sessionId, cols, rows);
    if (!result.success) {
      throw new Error(result.error);
    }
  }

  // 获取当前目录
  getCurrentDirectory(shellId: string): string {
    return this.currentDirectories.get(shellId) || '~';
  }
}

console.log('Creating renderer SSH service instance...');
export const sshService = new SSHService();
console.log('Renderer SSH service instance created.'); 