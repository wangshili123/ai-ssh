import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';
import { sftpService } from '../../../../services/sftp';

// 将fs方法转换为Promise版本
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const access = promisify(fs.access);
const open = promisify(fs.open);
const close = promisify(fs.close);
import type { 
  ActiveEditorSession, 
  TempFileInfo, 
  FileOperationResult,
  TempFileCleanupOptions
} from '../types/ExternalEditorTypes';
import type { FileEntry } from '../../../../../main/types/file';
import type { SessionInfo } from '../../../../types';

/**
 * 临时文件管理器
 * 负责文件的下载、上传和临时文件的管理
 */
export class TempFileManager {
  private tempDir: string;
  private activeTempFiles: Map<string, TempFileInfo> = new Map();

  constructor(tempDir?: string) {
    this.tempDir = tempDir || path.join(os.tmpdir(), 'ssh-editor');
    this.ensureTempDirectory();
  }

  /**
   * 下载远程文件到本地临时目录
   */
  async downloadFile(session: ActiveEditorSession): Promise<FileOperationResult> {
    const { file, sessionInfo, id, tabId } = session;

    try {
      console.log('[TempFileManager] 开始下载文件:', file.path);

      // 生成临时文件路径
      const tempFilePath = this.getTempFilePath(file, id);

      // 确保临时目录存在
      await this.ensureDirectory(path.dirname(tempFilePath));

      // 使用SFTP服务下载文件，使用正确的连接ID格式
      const connectionId = `sftp-${tabId}`;
      console.log('[TempFileManager] 使用connectionId:', connectionId, '下载文件');
      const result = await sftpService.readFile(connectionId, file.path);
      const content = result.content;

      // 写入临时文件
      await writeFile(tempFilePath, content);

      // 获取文件统计信息
      const stats = await stat(tempFilePath);
      
      // 更新会话信息
      session.tempFilePath = tempFilePath;
      session.lastModified = stats.mtime.getTime();
      
      // 记录临时文件信息
      const tempFileInfo: TempFileInfo = {
        sessionId: id,
        localPath: tempFilePath,
        remotePath: file.path,
        originalSize: stats.size,
        lastModified: stats.mtime.getTime(),
        sessionInfo
      };
      
      this.activeTempFiles.set(id, tempFileInfo);
      
      console.log('[TempFileManager] 文件下载成功:', tempFilePath);
      
      return {
        success: true,
        message: `文件 ${file.name} 下载成功`
      };
      
    } catch (error) {
      console.error('[TempFileManager] 文件下载失败:', error);
      return {
        success: false,
        error: `文件下载失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 上传本地文件到远程服务器
   */
  async uploadFile(session: ActiveEditorSession): Promise<FileOperationResult> {
    const { tempFilePath, file, sessionInfo, id, tabId } = session;

    try {
      console.log('[TempFileManager] 开始上传文件:', tempFilePath);

      // 检查临时文件是否存在
      if (!await this.pathExists(tempFilePath)) {
        throw new Error('临时文件不存在');
      }

      // 读取本地文件内容
      const content = await readFile(tempFilePath);

      // 上传到远程服务器，使用正确的连接ID格式
      const connectionId = `sftp-${tabId}`;
      console.log('[TempFileManager] 使用connectionId:', connectionId, '上传文件');
      await sftpService.writeFile(connectionId, file.path, content.toString());

      // 更新文件修改时间
      const stats = await stat(tempFilePath);
      session.lastModified = stats.mtime.getTime();
      
      // 更新临时文件信息
      const tempFileInfo = this.activeTempFiles.get(id);
      if (tempFileInfo) {
        tempFileInfo.lastModified = stats.mtime.getTime();
      }
      
      console.log('[TempFileManager] 文件上传成功:', file.path);
      
      return {
        success: true,
        message: `文件 ${file.name} 上传成功`
      };
      
    } catch (error) {
      console.error('[TempFileManager] 文件上传失败:', error);
      return {
        success: false,
        error: `文件上传失败: ${(error as Error).message}`
      };
    }
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFile(sessionId: string): Promise<void> {
    try {
      const tempFileInfo = this.activeTempFiles.get(sessionId);
      if (!tempFileInfo) {
        console.log('[TempFileManager] 临时文件信息不存在:', sessionId);
        return;
      }
      
      const { localPath } = tempFileInfo;
      
      // 删除临时文件
      if (await this.pathExists(localPath)) {
        await unlink(localPath);
        console.log('[TempFileManager] 临时文件已删除:', localPath);
      }
      
      // 从记录中移除
      this.activeTempFiles.delete(sessionId);
      
    } catch (error) {
      console.error('[TempFileManager] 清理临时文件失败:', error);
    }
  }

  /**
   * 清理所有临时文件
   */
  async cleanupAllTempFiles(options?: TempFileCleanupOptions): Promise<void> {
    try {
      console.log('[TempFileManager] 开始清理所有临时文件');
      
      const { sessionId, olderThan, force } = options || {};
      const now = Date.now();
      
      for (const [id, tempFileInfo] of this.activeTempFiles.entries()) {
        let shouldCleanup = force || false;
        
        // 检查是否指定了特定会话
        if (sessionId && id !== sessionId) {
          continue;
        }
        
        // 检查文件年龄
        if (olderThan && (now - tempFileInfo.lastModified) < olderThan) {
          continue;
        }
        
        // 如果没有强制清理，检查文件是否仍在使用
        if (!force) {
          shouldCleanup = !(await this.isFileInUse(tempFileInfo.localPath));
        }
        
        if (shouldCleanup) {
          await this.cleanupTempFile(id);
        }
      }
      
      console.log('[TempFileManager] 临时文件清理完成');
      
    } catch (error) {
      console.error('[TempFileManager] 清理临时文件失败:', error);
    }
  }

  /**
   * 获取临时文件信息
   */
  getTempFileInfo(sessionId: string): TempFileInfo | undefined {
    return this.activeTempFiles.get(sessionId);
  }

  /**
   * 获取所有活动的临时文件
   */
  getActiveTempFiles(): TempFileInfo[] {
    return Array.from(this.activeTempFiles.values());
  }

  /**
   * 检查文件是否被修改
   */
  async isFileModified(sessionId: string): Promise<boolean> {
    const tempFileInfo = this.activeTempFiles.get(sessionId);
    if (!tempFileInfo) return false;
    
    try {
      const stats = await stat(tempFileInfo.localPath);
      return stats.mtime.getTime() > tempFileInfo.lastModified;
    } catch (error) {
      console.error('[TempFileManager] 检查文件修改状态失败:', error);
      return false;
    }
  }

  /**
   * 设置临时目录
   */
  setTempDirectory(directory: string): void {
    this.tempDir = directory;
    this.ensureTempDirectory();
  }

  /**
   * 获取临时目录
   */
  getTempDirectory(): string {
    return this.tempDir;
  }

  /**
   * 生成临时文件路径
   */
  private getTempFilePath(file: FileEntry, sessionId: string): string {
    // 使用会话ID和文件名生成唯一的临时文件名
    const fileName = `${sessionId}_${file.name}`;
    return path.join(this.tempDir, fileName);
  }

  /**
   * 确保临时目录存在
   */
  private async ensureTempDirectory(): Promise<void> {
    try {
      await this.ensureDirectory(this.tempDir);
      console.log('[TempFileManager] 临时目录已准备:', this.tempDir);
    } catch (error) {
      console.error('[TempFileManager] 创建临时目录失败:', error);
      throw new Error(`无法创建临时目录: ${this.tempDir}`);
    }
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await access(dirPath);
    } catch (error) {
      // 目录不存在，创建它
      await mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 检查路径是否存在
   */
  private async pathExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 检查文件是否正在被使用
   */
  private async isFileInUse(filePath: string): Promise<boolean> {
    try {
      // 在Windows上，尝试以独占模式打开文件来检查是否被占用
      if (process.platform === 'win32') {
        const handle = await open(filePath, 'r+');
        await close(handle);
        return false;
      } else {
        // 在其他平台上，简单检查文件是否存在
        return await this.pathExists(filePath);
      }
    } catch (error) {
      // 如果无法打开文件，可能是被占用
      return true;
    }
  }

  /**
   * 获取临时目录大小
   */
  async getTempDirectorySize(): Promise<number> {
    try {
      let totalSize = 0;
      const files = await readdir(this.tempDir);

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await stat(filePath);
        if (stats.isFile()) {
          totalSize += stats.size;
        }
      }

      return totalSize;
    } catch (error) {
      console.error('[TempFileManager] 获取临时目录大小失败:', error);
      return 0;
    }
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 销毁管理器，清理所有资源
   */
  async destroy(): Promise<void> {
    console.log('[TempFileManager] 销毁临时文件管理器');
    await this.cleanupAllTempFiles({ force: true });
  }
}
