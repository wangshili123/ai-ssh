import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';
import { downloadService } from '../../../../services/downloadService';
import { uploadService } from '../../../../services/uploadService';
import type { DownloadTask, UploadTask } from '../../../../services/transferService';
import { message } from 'antd';

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
   * 使用downloadService复用现有的下载逻辑，支持进度显示、大文件处理等
   */
  async downloadFile(session: ActiveEditorSession): Promise<FileOperationResult> {
    const { file, sessionInfo, id, tabId } = session;

    try {
      console.log('[TempFileManager] 开始下载文件:', file.path);

      // 生成临时文件路径
      const tempFilePath = this.getTempFilePath(file, id);

      // 确保临时目录存在
      await this.ensureDirectory(path.dirname(tempFilePath));

      // 使用downloadService下载文件，获得进度显示和大文件支持
      const downloadConfig = {
        savePath: path.dirname(tempFilePath),
        fileName: path.basename(tempFilePath),
        sessionId: tabId,
        overwrite: true,
        openFolder: false, // 不打开文件夹
        // 最大性能配置 - 启用所有优化选项
        useCompression: true, // 启用压缩
        compressionMethod: 'auto' as const, // 自动选择最适合的压缩方法
        useParallelDownload: true, // 启用并行下载（注意字段名是useParallelDownload）
        maxParallelChunks: 30 // 最大并行块数，获得最高传输速度
      };

      console.log('[TempFileManager] 使用downloadService下载文件，配置:', downloadConfig);

      // 启动下载任务
      const taskId = await downloadService.startTransfer({ file, config: downloadConfig });

      // 等待下载完成
      const downloadResult = await this.waitForDownloadComplete(taskId);

      if (!downloadResult.success) {
        throw new Error(downloadResult.error || '下载失败');
      }

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
   * 等待下载任务完成
   */
  private async waitForDownloadComplete(taskId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const handleDownloadCompleted = (task: DownloadTask) => {
        if (task.id === taskId) {
          console.log('[TempFileManager] 下载任务完成:', task.id);
          downloadService.off('download-completed', handleDownloadCompleted);
          downloadService.off('download-error', handleDownloadError);
          resolve({ success: true });
        }
      };

      const handleDownloadError = (task: DownloadTask) => {
        if (task.id === taskId) {
          console.error('[TempFileManager] 下载任务失败:', task.id, task.error);
          downloadService.off('download-completed', handleDownloadCompleted);
          downloadService.off('download-error', handleDownloadError);
          resolve({ success: false, error: task.error || '下载失败' });
        }
      };

      // 监听下载事件
      downloadService.on('download-completed', handleDownloadCompleted);
      downloadService.on('download-error', handleDownloadError);

      // 设置超时（5分钟）
      setTimeout(() => {
        downloadService.off('download-completed', handleDownloadCompleted);
        downloadService.off('download-error', handleDownloadError);
        resolve({ success: false, error: '下载超时' });
      }, 5 * 60 * 1000);
    });
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

      // 获取文件统计信息
      const stats = await stat(tempFilePath);

      // 读取本地文件内容并创建File对象
      const content = await readFile(tempFilePath);
      const uploadFile = new File([content], file.name, {
        type: 'application/octet-stream',
        lastModified: stats.mtime.getTime()
      });

      // 使用uploadService上传文件，获得进度显示和大文件支持
      const uploadConfig = {
        remotePath: path.dirname(file.path),
        sessionId: tabId,
        overwrite: true,
        preservePermissions: true,
        // 最大性能配置 - 启用所有优化选项
        useCompression: true, // 启用压缩
        compressionMethod: 'auto' as const, // 自动选择最适合的压缩方法
        useParallelTransfer: true, // 启用并行传输
        maxParallelChunks: 30 // 最大并行块数，获得最高传输速度
      };

      console.log('[TempFileManager] 使用uploadService上传文件，配置:', uploadConfig);

      // 启动上传任务
      const taskId = await uploadService.startUpload([uploadFile], uploadConfig);

      // 等待上传完成
      const uploadResult = await this.waitForUploadComplete(taskId);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || '上传失败');
      }

      // 更新文件修改时间
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
   * 等待上传任务完成
   */
  private async waitForUploadComplete(taskId: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      const handleUploadCompleted = (task: UploadTask) => {
        if (task.id === taskId) {
          console.log('[TempFileManager] 上传任务完成:', task.id);
          uploadService.off('upload-completed', handleUploadCompleted);
          uploadService.off('upload-error', handleUploadError);
          resolve({ success: true });
        }
      };

      const handleUploadError = (task: UploadTask) => {
        if (task.id === taskId) {
          console.error('[TempFileManager] 上传任务失败:', task.id, task.error);
          uploadService.off('upload-completed', handleUploadCompleted);
          uploadService.off('upload-error', handleUploadError);
          resolve({ success: false, error: task.error || '上传失败' });
        }
      };

      // 监听上传事件
      uploadService.on('upload-completed', handleUploadCompleted);
      uploadService.on('upload-error', handleUploadError);

      // 设置超时（5分钟）
      setTimeout(() => {
        uploadService.off('upload-completed', handleUploadCompleted);
        uploadService.off('upload-error', handleUploadError);
        resolve({ success: false, error: '上传超时' });
      }, 5 * 60 * 1000);
    });
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
