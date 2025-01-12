import { Client } from 'ssh2';
import type { SessionInfo } from './storage';
import { BrowserWindow } from 'electron';

console.log('Loading SSH service...');

class SSHService {
  private connections: Map<string, Client>;
  private shells: Map<string, any>;

  constructor() {
    console.log('Initializing SSHService...');
    this.connections = new Map();
    this.shells = new Map();
  }

  async connect(sessionInfo: SessionInfo) {
    console.log('SSHService.connect called with:', sessionInfo);
    const { id, host, port, username, password, privateKey } = sessionInfo;

    console.log('Connecting to SSH server with config:', {
      host,
      port,
      username,
      password: '***',
      privateKey: '***'
    });

    // 如果已经有连接，直接返回
    if (this.connections.has(id)) {
      console.log('Reusing existing connection');
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        console.log('SSH connection ready');
        this.connections.set(id, conn);
        resolve();
      });

      conn.on('error', (err) => {
        console.error('SSH connection error:', err);
        this.connections.delete(id);
        reject(err);
      });

      const config: any = {
        host,
        port,
        username
      };

      if (password) {
        config.password = password;
      }
      if (privateKey) {
        config.privateKey = privateKey;
      }

      conn.connect(config);
    });
  }

  async disconnect(shellId: string) {
    // 从 shellId 中提取 sessionId
    const sessionId = shellId.split('-')[0];
    
    // 先删除 shell
    this.shells.delete(shellId);

    // 检查是否还有其他使用这个连接的 shell
    const hasOtherShells = Array.from(this.shells.keys()).some(id => id.startsWith(sessionId + '-'));

    // 如果没有其他 shell 使用这个连接，就关闭连接
    if (!hasOtherShells) {
      const conn = this.connections.get(sessionId);
      if (conn) {
        console.log(`Closing SSH connection for session ${sessionId}`);
        conn.end();
        this.connections.delete(sessionId);
      }
    }
  }

  async createShell(shellId: string) {
    // 从 shellId 中提取 sessionId
    const sessionId = shellId.split('-')[0];
    const conn = this.connections.get(sessionId);
    
    if (!conn) {
      throw new Error('No SSH connection found');
    }

    // 如果这个 shellId 已经存在，先关闭它
    if (this.shells.has(shellId)) {
      console.log(`Shell ${shellId} already exists, closing it first`);
      const oldShell = this.shells.get(shellId);
      oldShell.end();
      this.shells.delete(shellId);
    }

    return new Promise<void>((resolve, reject) => {
      conn.shell((err, stream) => {
        if (err) {
          console.error('Failed to create shell:', err);
          reject(err);
          return;
        }

        console.log(`Shell created successfully: ${shellId}`);
        this.shells.set(shellId, stream);

        // 获取主窗口
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (!mainWindow) {
          console.error('No main window found');
          reject(new Error('No main window found'));
          return;
        }

        // 监听数据事件
        stream.on('data', (data: Buffer) => {
          const dataStr = data.toString();
          console.log(`Sending shell data to renderer [${shellId}]:`, dataStr);
          mainWindow.webContents.send(`ssh:data:${shellId}`, dataStr);
        });

        // 监听关闭事件
        stream.on('close', () => {
          console.log(`Shell session closed [${shellId}]`);
          mainWindow.webContents.send(`ssh:close:${shellId}`);
          this.shells.delete(shellId);
        });

        // 监听错误事件
        stream.on('error', (error: Error) => {
          console.error(`Shell error [${shellId}]:`, error);
          mainWindow.webContents.send(`ssh:close:${shellId}`);
          this.shells.delete(shellId);
        });
        
        resolve();
      });
    });
  }

  async write(shellId: string, data: string) {
    console.log(`Writing to shell [${shellId}]:`, data);
    const shell = this.shells.get(shellId);
    if (!shell) {
      throw new Error('No shell session found');
    }
    shell.write(data);
  }

  async resize(shellId: string, cols: number, rows: number) {
    console.log(`Resizing shell [${shellId}] to ${cols}x${rows}`);
    const shell = this.shells.get(shellId);
    if (!shell) {
      throw new Error('No shell session found');
    }
    shell.setWindow(rows, cols);
  }
}

console.log('Creating SSH service instance...');
export const sshService = new SSHService();
console.log('SSH service instance created.'); 