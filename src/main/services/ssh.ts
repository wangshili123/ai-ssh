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

    return new Promise<void>((resolve, reject) => {
      const conn = new Client();
      
      conn.on('ready', () => {
        console.log('SSH connection ready');
        this.connections.set(id, conn);
        resolve();
      });

      conn.on('error', (err) => {
        console.error('SSH connection error:', err);
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

  async disconnect(sessionId: string) {
    const conn = this.connections.get(sessionId);
    if (conn) {
      conn.end();
      this.connections.delete(sessionId);
      this.shells.delete(sessionId);
    }
  }

  async createShell(sessionId: string) {
    const conn = this.connections.get(sessionId);
    if (!conn) {
      throw new Error('No SSH connection found');
    }

    return new Promise<void>((resolve, reject) => {
      conn.shell((err, stream) => {
        if (err) {
          console.error('Failed to create shell:', err);
          reject(err);
          return;
        }

        console.log('Shell created successfully');
        this.shells.set(sessionId, stream);

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
          console.log(`Sending shell data to renderer [${sessionId}]:`, dataStr);
          mainWindow.webContents.send(`ssh:data:${sessionId}`, dataStr);
        });

        // 监听关闭事件
        stream.on('close', () => {
          console.log(`Shell session closed [${sessionId}]`);
          mainWindow.webContents.send(`ssh:close:${sessionId}`);
          this.shells.delete(sessionId);
        });
        
        resolve();
      });
    });
  }

  async write(sessionId: string, data: string) {
    console.log(`Writing to shell [${sessionId}]:`, data);
    const shell = this.shells.get(sessionId);
    if (!shell) {
      throw new Error('No shell session found');
    }
    shell.write(data);
  }

  async resize(sessionId: string, cols: number, rows: number) {
    console.log(`Resizing shell [${sessionId}] to ${cols}x${rows}`);
    const shell = this.shells.get(sessionId);
    if (!shell) {
      throw new Error('No shell session found');
    }
    shell.setWindow(rows, cols);
  }
}

console.log('Creating SSH service instance...');
export const sshService = new SSHService();
console.log('SSH service instance created.'); 