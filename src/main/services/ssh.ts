import { Client } from 'ssh2';
import type { SessionInfo } from './storage';
import { BrowserWindow } from 'electron';
import { sftpService } from './sftp';

console.log('Loading SSH service...');

class SSHService {
  private connections: Map<string, Client>;
  private shells: Map<string, any>;

  constructor() {
    console.log('Initializing SSHService...');
    this.connections = new Map();
    this.shells = new Map();
  }

  /**
   * 获取SSH连接
   */
  getConnection(sessionId: string): Client | undefined {
    console.log(`[SSH] 获取连接: ${sessionId}`);
    const conn = this.connections.get(sessionId);
    if (!conn) {
      console.log(`[SSH] 未找到连接: ${sessionId}`);
    }
    return conn;
  }

  /**
   * 检查连接状态
   */
  isConnected(sessionId: string): boolean {
    console.log(`[SSH] 检查连接状态: ${sessionId}`);
    const conn = this.connections.get(sessionId);
    return !!conn;
  }

  async connect(sessionInfo: SessionInfo) {
    console.log('SSHService.connect called with:', sessionInfo);
    const { id, host, port, username, password, privateKey, authType } = sessionInfo;

    console.log('Connecting to SSH server with config:', {
      host,
      port,
      username,
      authType,
      hasPassword: !!password,
      hasPrivateKey: !!privateKey
    });

    // 如果已经有连接，先关闭旧的SFTP客户端
    if (this.connections.has(id)) {
      console.log('Closing existing SFTP client');
      await sftpService.closeSFTPClient(id);
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

      // 根据认证类型设置认证方式
      if (authType === 'password' && password) {
        config.password = password;
      } else if (authType === 'privateKey' && privateKey) {
        config.privateKey = privateKey;
      } else {
        reject(new Error('Invalid authentication configuration'));
        return;
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
        // 关闭SFTP客户端
        await sftpService.closeSFTPClient(sessionId);
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
      // 设置 PTY 选项，启用正确的终端模式
      const ptyConfig = {
        term: 'xterm-256color',
        rows: 24,
        cols: 80,
        // 启用 PTY 模式
        pty: true
      };

      conn.shell(ptyConfig, (err, stream) => {
        if (err) {
          console.error('Failed to create shell:', err);
          reject(err);
          return;
        }

        // 设置流的编码
        stream.setEncoding('utf8');

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