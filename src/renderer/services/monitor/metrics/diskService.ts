import { DiskInfo } from '../../../types/monitor';
import { SSHService } from '../../../types';

/**
 * 磁盘数据采集服务
 */
export class DiskMetricsService {
  private static instance: DiskMetricsService;
  private sshService: SSHService;
  private readonly MAX_HISTORY_POINTS = 60; // 保存60个历史数据点

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  /**
   * 获取单例实例
   */
  static getInstance(sshService: SSHService): DiskMetricsService {
    if (!DiskMetricsService.instance) {
      DiskMetricsService.instance = new DiskMetricsService(sshService);
    }
    return DiskMetricsService.instance;
  }

  /**
   * 采集磁盘所有指标数据
   */
  async collectMetrics(sessionId: string): Promise<DiskInfo> {
    try {
      const [diskUsage, diskIO] = await Promise.all([
        this.getDiskUsage(sessionId),
        this.getDiskIO(sessionId)
      ]);

      return {
        ...diskUsage,
        ...diskIO
      };
    } catch (error) {
      console.error('采集磁盘指标失败:', error);
      throw error;
    }
  }

  /**
   * 获取磁盘使用情况
   */
  private async getDiskUsage(sessionId: string): Promise<Omit<DiskInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory'>> {
    try {
      // 使用df命令获取磁盘使用情况
      const dfCmd = 'df -B1 --output=source,target,fstype,size,used,avail,pcent';
      const dfResult = await this.sshService.executeCommandDirect(sessionId, dfCmd);
      
      return this.parseDiskUsage(dfResult || '');
    } catch (error) {
      console.error('获取磁盘使用情况失败:', error);
      throw error;
    }
  }

  /**
   * 获取磁盘IO情况
   */
  private async getDiskIO(sessionId: string): Promise<Pick<DiskInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory'>> {
    try {
      // 使用iostat命令获取IO统计
      const iostatCmd = 'iostat -d -k 1 1';
      const result = await this.sshService.executeCommandDirect(sessionId, iostatCmd);
      
      return this.parseDiskIO(result || '');
    } catch (error) {
      console.error('获取磁盘IO信息失败:', error);
      return {
        readSpeed: 0,
        writeSpeed: 0,
        ioHistory: []
      };
    }
  }

  /**
   * 解析磁盘使用情况
   */
  private parseDiskUsage(output: string): Omit<DiskInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory'> {
    const lines = output.split('\n').slice(1); // 跳过标题行
    const partitions = [];
    let totalSize = 0;
    let totalUsed = 0;
    let totalFree = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [device, mountpoint, fstype, size, used, free, usageStr] = line.trim().split(/\s+/);
      
      // 跳过特殊文件系统
      if (['tmpfs', 'devtmpfs', 'squashfs'].includes(fstype)) continue;
      
      const usagePercent = parseInt(usageStr.replace('%', ''));
      
      partitions.push({
        device,
        mountpoint,
        fstype,
        total: parseInt(size),
        used: parseInt(used),
        free: parseInt(free),
        usagePercent,
        readSpeed: 0,  // 将在IO数据中更新
        writeSpeed: 0  // 将在IO数据中更新
      });

      totalSize += parseInt(size);
      totalUsed += parseInt(used);
      totalFree += parseInt(free);
    }

    return {
      total: totalSize,
      used: totalUsed,
      free: totalFree,
      usagePercent: totalSize > 0 ? (totalUsed / totalSize) * 100 : 0,
      partitions
    };
  }

  /**
   * 解析磁盘IO情况
   */
  private parseDiskIO(output: string): Pick<DiskInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory'> {
    const lines = output.split('\n');
    let totalRead = 0;
    let totalWrite = 0;

    // 查找Device:行后的数据行
    const dataStartIndex = lines.findIndex(line => line.includes('Device:')) + 1;
    if (dataStartIndex > 0 && dataStartIndex < lines.length) {
      const dataLines = lines.slice(dataStartIndex).filter(line => line.trim());
      
      for (const line of dataLines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3) {
          totalRead += parseFloat(parts[2]) * 1024;  // 转换为bytes
          totalWrite += parseFloat(parts[3]) * 1024; // 转换为bytes
        }
      }
    }

    const now = Date.now();
    return {
      readSpeed: totalRead,
      writeSpeed: totalWrite,
      ioHistory: [{
        timestamp: now,
        readSpeed: totalRead,
        writeSpeed: totalWrite
      }]
    };
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    DiskMetricsService.instance = null as any;
  }
} 