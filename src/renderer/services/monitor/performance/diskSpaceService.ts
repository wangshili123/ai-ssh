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
      // 使用du命令获取目录大小，并通过stat获取最后修改时间
      const cmd = `du -x --max-depth=1 ${mountpoint} 2>/dev/null | sort -rn | head -n 20 | while read size path; do echo -n "$size $path "; stat -c %Y "$path" 2>/dev/null || echo "0"; done`;
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      if (!output) return [];

      return output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 3) return null;

          const size = parts[0];
          const timestamp = parts[parts.length - 1];
          const path = parts.slice(1, -1).join(' ');

          const lastModified = parseInt(timestamp);
          if (isNaN(lastModified)) return null;

          const sizeInBytes = parseInt(size);
          if (isNaN(sizeInBytes)) return null;

          return {
            path,
            size: sizeInBytes * 1024,
            lastModified: lastModified * 1000
          } as DirSizeInfo;
        })
        .filter((item): item is DirSizeInfo => item !== null);
    } catch (error) {
      console.error('扫描大目录失败:', error);
      throw error;
    }
  }

  /**
   * 扫描大文件
   */
  private async scanLargeFiles(sessionId: string, mountpoint: string): Promise<DirSizeInfo[]> {
    try {
      // 使用find命令查找大文件，并通过stat获取准确的时间戳
      const cmd = `find ${mountpoint} -xdev -type f -size +100M -printf '%s %p\n' 2>/dev/null | sort -rn | head -n 20 | while read size path; do echo -n "$size $path "; stat -c %Y "$path" 2>/dev/null || echo "0"; done`;
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      if (!output) return [];

      const results: DirSizeInfo[] = [];
      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) continue;

        const size = parseInt(parts[0]);
        const timestamp = parseInt(parts[parts.length - 1]);
        const path = parts.slice(1, -1).join(' ');

        if (isNaN(size) || isNaN(timestamp)) continue;

        results.push({
          path,
          size,
          lastModified: timestamp * 1000 // 转换为毫秒
        });
      }

      return results;
    } catch (error) {
      console.error('扫描大文件失败:', error);
      throw error;
    }
  }

  /**
   * 分析文件类型分布
   */
  private async analyzeFileTypes(sessionId: string, mountpoint: string): Promise<FileTypeInfo[]> {
    try {
      // 使用更简单的命令统计文件类型和大小
      // 1. 找出所有文件
      // 2. 提取扩展名和大小
      // 3. 按大小排序并限制数量
      const cmd = `find ${mountpoint} -xdev -type f -printf "%s %f\n" 2>/dev/null | awk -F. '{if (NF>1) {size=$1; ext=$NF; print size " " ext}}' | awk '{size[$2]+=$1; count[$2]+=1} END {for (ext in size) print size[ext] " " count[ext] " " ext}' | sort -rn | head -n 20`;
      
      console.log('执行文件类型分析命令:', cmd);
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      console.log('分析文件类型输出:', output);
      
      if (!output) {
        console.log('命令输出为空');
        return [];
      }

      const lines = output.split('\n').filter(line => line.trim());
      console.log('解析的行数:', lines.length);

      return lines.map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 3) {
          console.log('行格式不正确:', line);
          return null;
        }

        const size = parseInt(parts[0]);
        const count = parseInt(parts[1]);
        const ext = parts[2];

        if (isNaN(size) || isNaN(count)) {
          console.log('数值解析失败:', line);
          return null;
        }

        return {
          extension: ext,
          count: count,
          totalSize: size
        };
      }).filter((item): item is FileTypeInfo => item !== null);
    } catch (error) {
      console.error('分析文件类型失败:', error);
      
      // 尝试使用备用命令
      try {
        console.log('尝试使用备用命令');
        const backupCmd = `find ${mountpoint} -xdev -type f -name "*.*" 2>/dev/null | sed 's/.*\\.//' | sort | uniq -c | sort -rn | head -n 20 | awk '{print "0 " $1 " " $2}'`;
        const backupOutput = await this.sshService.executeCommandDirect(sessionId, backupCmd);
        
        if (!backupOutput) return [];

        return backupOutput.split('\n')
          .filter(line => line.trim())
          .map(line => {
            const [, count, ext] = line.trim().split(/\s+/);
            return {
              extension: ext,
              count: parseInt(count) || 0,
              totalSize: 0
            };
          });
      } catch (backupError) {
        console.error('备用命令也失败了:', backupError);
        throw error;
      }
    }
  }

  destroy(): void {
    DiskSpaceService.instance = null as any;
  }
} 