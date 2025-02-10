import { Client, Channel } from 'ssh2';
import type { SessionInfo } from './storage';
import { BrowserWindow } from 'electron';
import { sftpManager } from './sftp';
import { storageService } from './storage';

console.log('Loading SSH service...');

class SSHService {
  private connections: Map<string, Client> = new Map();
  private shells: Map<string, Channel> = new Map();
  private currentDirectories: Map<string, string> = new Map();

  constructor() {
    console.log('Initializing SSHService...');
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
        conn.end();
        this.connections.delete(sessionId);
      }
    }
  }

  async createShell(
    shellId: string,
    initialSize?: { rows: number; cols: number }
  ) {
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
      if (oldShell) {
        oldShell.end();
        this.shells.delete(shellId);
      }
    }
    console.log(`[SSH] Creating shell with config:`, initialSize);
    return new Promise<void>((resolve, reject) => {
      // 设置 PTY 选项，启用正确的终端模式
      const ptyConfig = {
        term: 'xterm-256color',
        pty: true,
        rows: initialSize?.rows || 24,  // 使用传入的尺寸或默认值
        cols: initialSize?.cols || 80    // 使用传入的尺寸或默认值
      };

      console.log(`[SSH] Creating shell with config:`, ptyConfig);

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

        // 初始化目录为用户主目录
        this.updateCurrentDirectory(shellId, '~');

        // 监听数据事件
        stream.on('data', (data: Buffer) => {
          const dataStr = data.toString();
          console.log(`Sending shell data to renderer [${shellId}]:`, dataStr);
          mainWindow.webContents.send(`ssh:data:${shellId}`, dataStr);

          // 检查是否是 cd 命令
          if (this.isChangeDirectoryCommand(dataStr)) {
            this.handleDirectoryChange(shellId, dataStr);
          }
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
    shell.setWindow(rows, cols, 0, 0);
  }

  // 新增：检查是否是 cd 命令
  private isChangeDirectoryCommand(data: string): boolean {
    // 匹配 cd 命令，包括带参数的情况
    const cdPattern = /^cd\s+.+$/;
    const isCD = cdPattern.test(data.trim());
    console.log('[SSH] isChangeDirectoryCommand check:', { data: data.trim(), isCD });
    return isCD;
  }

  // 新增：处理目录变更
  private async handleDirectoryChange(shellId: string, command: string) {
    console.log('[SSH] handleDirectoryChange:', { shellId, command });
    try {
      // 执行 pwd 命令获取新的工作目录
      const shell = this.shells.get(shellId);
      if (!shell) {
        console.log('[SSH] Shell not found for directory change:', shellId);
        return;
      }

      shell.write('pwd\n');
      console.log('[SSH] Sent pwd command to get new directory');
      
      // 等待并处理 pwd 命令的输出
      const output = await new Promise<string>((resolve) => {
        const handler = (data: Buffer) => {
          const pwd = data.toString().trim();
          console.log('[SSH] Received pwd output:', pwd);
          if (pwd.startsWith('/')) {  // 确保是有效的路径
            shell.removeListener('data', handler);
            resolve(pwd);
          }
        };
        shell.on('data', handler);
      });

      // 更新当前目录
      this.updateCurrentDirectory(shellId, output);
    } catch (error) {
      console.error(`[SSH] Failed to handle directory change [${shellId}]:`, error);
    }
  }

  // 新增：更新当前目录
  private async updateCurrentDirectory(shellId: string, directory: string) {
    console.log('[SSH] Updating current directory:', { shellId, directory });
    
    // 更新目录映射
    this.currentDirectories.set(shellId, directory);
    
    // 更新 SessionInfo 中的 currentDirectory
    const sessionId = shellId.split('-')[0];
    try {
      const sessions = await storageService.loadSessions();
      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex !== -1) {
        sessions[sessionIndex].currentDirectory = directory;
        await storageService.saveSessions(sessions);
        console.log('[SSH] Updated SessionInfo currentDirectory:', { sessionId, directory });
      } else {
        console.log('[SSH] Session not found:', sessionId);
      }
    } catch (error) {
      console.error('[SSH] Failed to update SessionInfo:', error);
    }
  }

  // 获取当前目录
  getCurrentDirectory(shellId: string): string {
    const directory = this.currentDirectories.get(shellId);
    console.log('[SSH] Getting current directory:', { shellId, directory });
    return directory || '~';
  }
}

console.log('Creating SSH service instance...');
export const sshService = new SSHService();
console.log('SSH service instance created.'); 