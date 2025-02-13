import { SSHService } from '../../../types';

export interface DirSizeInfo {
  path: string;
  size: number;
  lastModified?: number;
}

export interface FileTypeInfo {
  extension: string;
  count: number;
  totalSize: number;
}

export interface SpaceAnalysis {
  largeDirectories: DirSizeInfo[];
  largeFiles: DirSizeInfo[];
  fileTypes: FileTypeInfo[];
  lastScan: number;
}

/**
 * 磁盘空间分析服务
 */
export class DiskSpaceService {
  private static instance: DiskSpaceService;
  private sshService: SSHService;
  private lastScanTime: number = 0;
  private scanInterval: number = 3600000; // 1小时扫描一次
  private scanResults: Map<string, SpaceAnalysis> = new Map();

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  static getInstance(sshService: SSHService): DiskSpaceService {
    if (!DiskSpaceService.instance) {
      DiskSpaceService.instance = new DiskSpaceService(sshService);
    }
    return DiskSpaceService.instance;
  }

  /**
   * 获取空间分析数据
   */
  async getSpaceAnalysis(sessionId: string, mountpoint: string = '/'): Promise<SpaceAnalysis> {
    const now = Date.now();
    const cacheKey = `${sessionId}:${mountpoint}`;
    const cachedResult = this.scanResults.get(cacheKey);

    // 如果有缓存且未过期，直接返回
    if (cachedResult && now - cachedResult.lastScan < this.scanInterval) {
      return cachedResult;
    }

    try {
      const [largeDirectories, largeFiles, fileTypes] = await Promise.all([
        this.scanLargeDirectories(sessionId, mountpoint),
        this.scanLargeFiles(sessionId, mountpoint),
        this.analyzeFileTypes(sessionId, mountpoint)
      ]);

      const result: SpaceAnalysis = {
        largeDirectories,
        largeFiles,
        fileTypes,
        lastScan: now
      };

      this.scanResults.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('空间分析失败:', error);
      return {
        largeDirectories: [],
        largeFiles: [],
        fileTypes: [],
        lastScan: 0
      };
    }
  }

  /**
   * 扫描大目录
   */
  private async scanLargeDirectories(sessionId: string, mountpoint: string): Promise<DirSizeInfo[]> {
    try {
      // 使用du命令获取目录大小，只扫描第一层目录
      const cmd = `du -x --max-depth=1 ${mountpoint} 2>/dev/null | sort -rn | head -n 20`;
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      if (!output) return [];

      return output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [size, path] = line.trim().split(/\s+/);
          return {
            path,
            size: parseInt(size) * 1024 // du默认输出KB，转换为bytes
          };
        });
    } catch (error) {
      console.error('扫描大目录失败:', error);
      return [];
    }
  }

  /**
   * 扫描大文件
   */
  private async scanLargeFiles(sessionId: string, mountpoint: string): Promise<DirSizeInfo[]> {
    try {
      // 使用find命令查找大文件
      const cmd = `find ${mountpoint} -xdev -type f -size +100M -exec ls -l --block-size=1 {} \\; 2>/dev/null | sort -rn -k5 | head -n 20`;
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      if (!output) return [];

      return output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split(/\s+/);
          return {
            path: parts.slice(8).join(' '),
            size: parseInt(parts[4]),
            lastModified: new Date(parts.slice(5, 8).join(' ')).getTime()
          };
        });
    } catch (error) {
      console.error('扫描大文件失败:', error);
      return [];
    }
  }

  /**
   * 分析文件类型分布
   */
  private async analyzeFileTypes(sessionId: string, mountpoint: string): Promise<FileTypeInfo[]> {
    try {
      // 使用find命令统计文件类型
      const cmd = `find ${mountpoint} -xdev -type f -exec basename {} \\; 2>/dev/null | awk -F. '{if (NF>1) print $NF}' | sort | uniq -c | sort -rn | head -n 20`;
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      if (!output) return [];

      const typeStats = new Map<string, { count: number; totalSize: number }>();
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const [count, ext] = line.trim().split(/\s+/);
        typeStats.set(ext, {
          count: parseInt(count),
          totalSize: 0 // 暂时不计算总大小，因为可能会很慢
        });
      }

      return Array.from(typeStats.entries()).map(([extension, stats]) => ({
        extension,
        count: stats.count,
        totalSize: stats.totalSize
      }));
    } catch (error) {
      console.error('分析文件类型失败:', error);
      return [];
    }
  }

  destroy(): void {
    DiskSpaceService.instance = null as any;
  }
} 