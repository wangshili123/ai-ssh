import { Client } from 'ssh2';
import type { SessionInfo } from '../../renderer/types';
import type { FileEntry } from '../types/file';
import { convertPermissionsToOctal, isDirectory, isSymlink, shouldFilterRegularFile } from '../utils/fileUtils';
import * as path from 'path';


/**
 * SFTP连接的数据缓存
 */
interface SFTPCache {
  currentPath: string;
  pathHistory: string[];
  directoryCache: Map<string, FileEntry[]>;  // 目录路径 -> 文件列表的缓存
}

/**
 * SFTP客户端类
 */
class SFTPClient {
  private client: Client;
  private sftp: any;  // ssh2的SFTP类型定义不完整，暂时使用any
  private cache: SFTPCache;

  constructor(private sessionInfo: SessionInfo, private connectionId: string) {
    this.client = new Client();
    // 初始化缓存
    this.cache = {
      currentPath: '/',
      pathHistory: ['/'],
      directoryCache: new Map()
    };
    console.log(`[SFTPClient] 创建实例 - connectionId: ${connectionId}, sessionId: ${sessionInfo.id}`);
  }

  /**
   * 连接SFTP服务器
   */
  async connect(): Promise<void> {
    const { host, port, username, password, privateKey, authType } = this.sessionInfo;
    
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
      throw new Error('无效的认证配置');
    }

    return new Promise((resolve, reject) => {
      this.client.on('ready', () => {
        this.client.sftp((err, sftp) => {
          if (err) {
            reject(err);
            return;
          }
          this.sftp = sftp;
          resolve();
        });
      }).on('error', (err) => {
        reject(err);
      }).connect(config);
    });
  }

  /**
   * 读取目录内容
   * @param path 目录路径
   * @param useCache 是否使用缓存
   */
  async readDirectory(path: string, useCache: boolean = true): Promise<FileEntry[]> {
    console.log(`[SFTPClient] 读取目录 - connectionId: ${this.connectionId}, path: ${path}, useCache: ${useCache}`);
    
    // 更新当前路径和历史记录
    this.cache.currentPath = path;
    if (!this.cache.pathHistory.includes(path)) {
      this.cache.pathHistory.push(path);
      console.log(`[SFTPClient] 更新历史记录 - connectionId: ${this.connectionId}, history:`, this.cache.pathHistory);
    }

    // 检查缓存
    if (useCache && this.cache.directoryCache.has(path)) {
      console.log(`[SFTPClient] 使用缓存 - connectionId: ${this.connectionId}, path: ${path}`);
      return this.cache.directoryCache.get(path)!;
    }

    return new Promise((resolve, reject) => {
      this.sftp.readdir(path, (err: Error, list: any[]) => {
        if (err) {
          console.error(`[SFTPClient] 读取目录失败 - connectionId: ${this.connectionId}, path: ${path}:`, err);
          reject(err);
          return;
        }
        
        const entries: FileEntry[] = list.map(item => {
          const filename = item.filename;
          const isDir = !shouldFilterRegularFile(item.attrs.mode);
          const ext = isDir ? '' : filename.includes('.') ? filename.split('.').pop()?.toLowerCase() || '' : '';
          
          return {
            name: filename,
            path: `${path}/${filename}`.replace(/\/+/g, '/'),
            isDirectory: isDir,
            size: item.attrs.size,
            modifyTime: item.attrs.mtime * 1000,
            permissions: item.attrs.mode,
            owner: item.attrs.uid,
            group: item.attrs.gid,
            extension: ext
          };
        });
        
        // 更新缓存
        this.cache.directoryCache.set(path, entries);
        console.log(`[SFTPClient] 目录读取完成并缓存 - connectionId: ${this.connectionId}, path: ${path}, count: ${entries.length}`);
        resolve(entries);
      });
    });
  }

  /**
   * 清除指定路径的缓存
   * @param path 目录路径，如果不指定则清除所有缓存
   */
  clearCache(path?: string) {
    if (path) {
      console.log(`[SFTPClient] 清除路径缓存 - connectionId: ${this.connectionId}, path: ${path}`);
      this.cache.directoryCache.delete(path);
    } else {
      console.log(`[SFTPClient] 清除所有缓存 - connectionId: ${this.connectionId}`);
      this.cache.directoryCache.clear();
    }
  }

  /**
   * 获取当前路径
   */
  getCurrentPath(): string {
    console.log(`[SFTPClient] 获取当前路径 - connectionId: ${this.connectionId}, path: ${this.cache.currentPath}`);
    return this.cache.currentPath;
  }

  /**
   * 获取路径历史
   */
  getPathHistory(): string[] {
    console.log(`[SFTPClient] 获取历史记录 - connectionId: ${this.connectionId}, history:`, this.cache.pathHistory);
    return [...this.cache.pathHistory];
  }

  /**
   * 读取文件内容
   * @param filePath 文件路径
   * @param start 起始位置
   * @param length 读取长度
   * @param encoding 编码方式
   */
  async readFile(filePath: string, start: number = 0, length: number = -1, encoding: BufferEncoding | 'binary' = 'utf8'): Promise<{
    content: string;
    totalSize: number;
    bytesRead: number;
  }> {
    console.log(`[SFTPClient] 读取文件 - connectionId: ${this.connectionId}, path: ${filePath}, start: ${start}, length: ${length}, encoding: ${encoding}`);
    
    return new Promise((resolve, reject) => {
      this.sftp.stat(filePath, (err: Error, stats: any) => {
        if (err) {
          console.error(`[SFTPClient] 获取文件状态失败:`, err);
          reject(err);
          return;
        }

        const totalSize = stats.size;
        console.log(`[SFTPClient] 文件状态 - size: ${totalSize}, isDirectory: ${stats.isDirectory()}, mode: ${stats.mode.toString(8)}`);
        
        // 如果文件大小为0，直接返回空内容
        if (totalSize === 0) {
          console.log(`[SFTPClient] 文件大小为0，返回空内容`);
          resolve({
            content: '',
            totalSize: 0,
            bytesRead: 0
          });
          return;
        }

        const readLength = length === -1 ? totalSize - start : length;
        console.log(`[SFTPClient] 计算读取长度 - 请求长度: ${length}, 起始位置: ${start}, 文件大小: ${totalSize}, 实际读取长度: ${readLength}`);
        
        const buffer = Buffer.alloc(readLength);
        console.log(`[SFTPClient] 分配缓冲区 - 大小: ${buffer.length} 字节`);

        this.sftp.open(filePath, 'r', (err: Error, handle: Buffer) => {
          if (err) {
            console.error(`[SFTPClient] 打开文件失败:`, err);
            reject(err);
            return;
          }
          
          console.log(`[SFTPClient] 文件已打开，开始读取 - handle: ${handle ? handle.toString('hex').substring(0, 16) + '...' : 'null'}`);

          this.sftp.read(handle, buffer, 0, readLength, start, (err: Error, bytesRead: number, buffer: Buffer) => {
            console.log(`[SFTPClient] 读取操作完成 - 错误: ${err ? err.message : '无'}, 读取字节数: ${bytesRead}, 缓冲区大小: ${buffer ? buffer.length : 0}`);
            
            if (bytesRead < readLength) {
              console.warn(`[SFTPClient] 警告：实际读取字节数(${bytesRead})小于请求字节数(${readLength})，差异: ${readLength - bytesRead}`);
            }
            
            this.sftp.close(handle, (closeErr: Error) => {
              if (closeErr) {
                console.warn(`[SFTPClient] 关闭文件句柄警告:`, closeErr);
              }
              
              if (err) {
                reject(err);
                return;
              }

              let content: string;
              try {
                if (encoding === 'binary') {
                  content = buffer.slice(0, bytesRead).toString('binary');
                } else {
                  content = buffer.slice(0, bytesRead).toString(encoding);
                }
                console.log(`[SFTPClient] 内容已转换为${encoding === 'binary' ? '二进制' : '文本'} - 长度: ${content.length}`);
              } catch (e) {
                console.warn(`[SFTPClient] 使用指定编码(${encoding})转换内容失败，回退到utf8:`, e);
                content = buffer.slice(0, bytesRead).toString('utf8');
              }

              console.log(`[SFTPClient] 读取文件完成 - 总大小: ${totalSize}, 读取字节数: ${bytesRead}, 内容长度: ${content.length}`);
              resolve({
                content,
                totalSize,
                bytesRead
              });
            });
          });
        });
      });
    });
  }

  /**
   * 写入文件内容
   * @param filePath 文件路径
   * @param content 文件内容
   * @param encoding 编码方式
   */
  async writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf8'): Promise<void> {
    console.log(`[SFTPClient] 写入文件 - connectionId: ${this.connectionId}, path: ${filePath}`);

    return new Promise((resolve, reject) => {
      const buffer = Buffer.from(content, encoding as BufferEncoding);

      this.sftp.open(filePath, 'w', (err: Error, handle: Buffer) => {
        if (err) {
          reject(err);
          return;
        }

        this.sftp.write(handle, buffer, 0, buffer.length, 0, (err: Error) => {
          this.sftp.close(handle, () => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  /**
   * 执行远程命令
   * @param command 要执行的命令
   */
  async executeCommand(command: string): Promise<{ success: boolean; stdout: string; stderr: string; exitCode: number }> {
    console.log(`[SFTPClient] 执行命令 - connectionId: ${this.connectionId}, command: ${command}`);

    return new Promise((resolve, reject) => {
      this.client.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let stdout = '';
        let stderr = '';
        let exitCode = 0;

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });

        stream.on('exit', (code: number) => {
          exitCode = code;
        });

        stream.on('close', () => {
          resolve({
            success: exitCode === 0,
            stdout,
            stderr,
            exitCode
          });
        });

        stream.on('error', (err: Error) => {
          reject(err);
        });
      });
    });
  }

  /**
   * 删除文件
   * @param filePath 文件路径
   */
  async deleteFile(filePath: string): Promise<void> {
    console.log(`[SFTPClient] 删除文件 - connectionId: ${this.connectionId}, path: ${filePath}`);

    return new Promise((resolve, reject) => {
      this.sftp.unlink(filePath, (err: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * 获取文件状态
   * @param filePath 文件路径
   */
  async stat(filePath: string): Promise<{
    size: number;
    modifyTime: number;
    isDirectory: boolean;
    permissions: number;
  }> {
    return new Promise((resolve, reject) => {
      this.sftp.stat(filePath, (err: Error, stats: any) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          size: stats.size,
          modifyTime: stats.mtime * 1000,
          isDirectory: !!(stats.mode & 0x4000),
          permissions: stats.mode
        });
      });
    });
  }

  /**
   * 上传文件
   * @param localPath 本地文件路径
   * @param remotePath 远程文件路径
   * @param options 上传选项
   */
  async uploadFile(
    localPath: string,
    remotePath: string,
    options?: {
      onProgress?: (transferred: number, total: number) => void;
      abortSignal?: AbortSignal;
    }
  ): Promise<void> {
    console.log(`[SFTPClient] 上传文件 - connectionId: ${this.connectionId}, local: ${localPath}, remote: ${remotePath}`);

    return new Promise((resolve, reject) => {
      // 检查本地文件是否存在
      if (!require('fs').existsSync(localPath)) {
        reject(new Error(`本地文件不存在: ${localPath}`));
        return;
      }

      // 获取文件大小用于进度计算
      const stats = require('fs').statSync(localPath);
      const totalSize = stats.size;
      let transferred = 0;

      // 创建读取流
      const readStream = require('fs').createReadStream(localPath);

      // 创建写入流
      const writeStream = this.sftp.createWriteStream(remotePath);

      // 监听进度
      readStream.on('data', (chunk: Buffer) => {
        transferred += chunk.length;
        options?.onProgress?.(transferred, totalSize);
      });

      // 监听完成
      writeStream.on('close', () => {
        console.log(`[SFTPClient] 文件上传完成 - ${remotePath}`);
        resolve();
      });

      // 监听错误
      writeStream.on('error', (err: Error) => {
        console.error(`[SFTPClient] 文件上传失败 - ${remotePath}:`, err);
        reject(err);
      });

      readStream.on('error', (err: Error) => {
        console.error(`[SFTPClient] 读取本地文件失败 - ${localPath}:`, err);
        reject(err);
      });

      // 处理取消信号
      if (options?.abortSignal) {
        options.abortSignal.addEventListener('abort', () => {
          readStream.destroy();
          writeStream.destroy();
          reject(new Error('上传被取消'));
        });
      }

      // 开始传输
      readStream.pipe(writeStream);
    });
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    console.log(`[SFTPClient] 关闭连接 - connectionId: ${this.connectionId}`);
    return new Promise((resolve) => {
      this.client.end();
      resolve();
    });
  }

  /**
   * 使用服务端grep命令过滤文件内容
   * @param filePath 文件路径
   * @param pattern 过滤模式
   * @param options 过滤选项
   */
  async grepFile(
    filePath: string,
    pattern: string,
    options: {
      isRegex: boolean;
      caseSensitive: boolean;
    }
  ): Promise<{
    content: string[];
    totalLines: number;
    matchedLines: number;
  }> {
    console.log(`[SFTPClient] 服务端过滤文件 - connectionId: ${this.connectionId}, path: ${filePath}, pattern: ${pattern}`);

    return new Promise((resolve, reject) => {
      // 构建grep命令
      let grepCmd = 'grep';
      if (!options.caseSensitive) {
        grepCmd += ' -i';
      }
      if (options.isRegex) {
        grepCmd += ' -E';
      } else {
        grepCmd += ' -F';
      }
      grepCmd += ` "${pattern.replace(/"/g, '\\"')}" "${filePath}"`;
      
      // 添加统计命令
      const countCmd = `wc -l "${filePath}"`;
      
      // 组合命令
      const cmd = `${countCmd}; ${grepCmd}`;

      // 在SSH会话中执行命令
      this.client.exec(cmd, (err: Error | undefined, stream: any) => {
        if (err) {
          reject(err);
          return;
        }

        let output = '';
        let totalLines = 0;
        let matchedLines: string[] = [];

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          console.error(`[SFTPClient] Grep错误 - ${data.toString()}`);
        });

        stream.on('close', () => {
          try {
            // 解析结果
            const lines = output.split('\n');
            // 第一行是总行数
            totalLines = parseInt(lines[0].trim(), 10);
            // 剩下的是匹配行
            matchedLines = lines.slice(1).filter(line => line.trim());

            resolve({
              content: matchedLines,
              totalLines,
              matchedLines: matchedLines.length
            });
          } catch (error) {
            reject(new Error('解析过滤结果失败: ' + error));
          }
        });
      });
    });
  }
}

/**
 * SFTP管理器
 * 负责管理所有SFTP客户端实例
 */
class SFTPManager {
  private clients: Map<string, SFTPClient> = new Map();
  // 连接预热缓存：sessionId -> 预热的连接
  private warmupConnections: Map<string, SFTPClient> = new Map();
  // 正在预热的连接
  private warmupPromises: Map<string, Promise<SFTPClient>> = new Map();

  /**
   * 创建SFTP客户端
   * @param connectionId 连接ID
   * @param sessionInfo 会话信息
   */
  async createClient(connectionId: string, sessionInfo: SessionInfo): Promise<void> {
    // 如果已存在，先关闭旧的连接
    await this.closeClient(connectionId);
    
    console.log(`[SFTPManager] 创建新客户端 - connectionId: ${connectionId}`);
    const client = new SFTPClient(sessionInfo, connectionId);
    await client.connect();
    this.clients.set(connectionId, client);
    console.log(`[SFTPManager] 客户端创建成功 - connectionId: ${connectionId}, total: ${this.clients.size}`);
  }

  /**
   * 获取SFTP客户端
   * @param connectionId 连接ID
   */
  getClient(connectionId: string): SFTPClient | undefined {
    const client = this.clients.get(connectionId);
    if (!client) {
      console.log(`[SFTPManager] 未找到客户端 - connectionId: ${connectionId}`);
    }
    return client;
  }

  /**
   * 读取目录内容
   * @param connectionId 连接ID
   * @param path 目录路径
   * @param useCache 是否使用缓存
   */
  async readDirectory(connectionId: string, path: string, useCache: boolean = true): Promise<FileEntry[]> {
    console.log(`[SFTPManager] 读取目录 - connectionId: ${connectionId}, path: ${path}, useCache: ${useCache}`);
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.readDirectory(path, useCache);
  }

  /**
   * 清除缓存
   * @param connectionId 连接ID
   * @param path 目录路径，如果不指定则清除所有缓存
   */
  clearCache(connectionId: string, path?: string) {
    const client = this.getClient(connectionId);
    if (client) {
      client.clearCache(path);
    }
  }

  /**
   * 获取当前路径
   * @param connectionId 连接ID
   */
  getCurrentPath(connectionId: string): string {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.getCurrentPath();
  }

  /**
   * 获取路径历史
   * @param connectionId 连接ID
   */
  getPathHistory(connectionId: string): string[] {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.getPathHistory();
  }

  /**
   * 读取文件内容
   */
  async readFile(connectionId: string, filePath: string, start: number = 0, length: number = -1, encoding: BufferEncoding | 'binary' = 'utf8') {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.readFile(filePath, start, length, encoding);
  }

  /**
   * 写入文件内容
   */
  async writeFile(connectionId: string, filePath: string, content: string, encoding: BufferEncoding = 'utf8') {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.writeFile(filePath, content, encoding);
  }

  /**
   * 上传文件
   * @param connectionId 连接ID
   * @param localPath 本地文件路径
   * @param remotePath 远程文件路径
   * @param options 上传选项
   */
  async uploadFile(
    connectionId: string,
    localPath: string,
    remotePath: string,
    options?: {
      onProgress?: (transferred: number, total: number) => void;
      abortSignal?: AbortSignal;
    }
  ): Promise<void> {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.uploadFile(localPath, remotePath, options);
  }

  /**
   * 获取文件状态
   */
  async stat(connectionId: string, filePath: string) {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.stat(filePath);
  }

  /**
   * 关闭SFTP客户端
   * @param connectionId 连接ID
   */
  async closeClient(connectionId: string): Promise<void> {
    console.log(`[SFTPManager] 关闭客户端 - connectionId: ${connectionId}`);
    const client = this.clients.get(connectionId);
    if (client) {
      await client.close();
      this.clients.delete(connectionId);
      console.log(`[SFTPManager] 客户端已关闭 - connectionId: ${connectionId}, remaining: ${this.clients.size}`);
    }
  }

  /**
   * 使用服务端grep过滤文件
   */
  async grepFile(
    connectionId: string,
    filePath: string,
    pattern: string,
    options: {
      isRegex: boolean;
      caseSensitive: boolean;
    }
  ) {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.grepFile(filePath, pattern, options);
  }

  /**
   * 执行远程命令
   */
  async executeCommand(connectionId: string, command: string) {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.executeCommand(command);
  }

  /**
   * 检查文件是否存在
   */
  async exists(connectionId: string, filePath: string): Promise<boolean> {
    try {
      await this.stat(connectionId, filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 删除文件
   */
  async deleteFile(connectionId: string, filePath: string): Promise<void> {
    const client = this.getClient(connectionId);
    if (!client) {
      throw new Error('SFTP连接不存在');
    }
    return client.deleteFile(filePath);
  }
}

// 导出单例
export const sftpManager = new SFTPManager(); 