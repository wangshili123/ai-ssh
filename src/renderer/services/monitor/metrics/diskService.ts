import { DiskInfo } from '../../../types/monitor';
import { SSHService } from '../../../types';

/**
 * 磁盘数据采集服务
 */
export class DiskMetricsService {
  private static instance: DiskMetricsService;
  private sshService: SSHService;
  private readonly MAX_HISTORY_POINTS = 60; // 保存60个历史数据点
  private lastDiskStats: { [key: string]: { time: number; read: number; write: number } } = {};

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
      // 使用 /proc/diskstats 获取IO统计
      const cmd = 'cat /proc/diskstats';
      const result = await this.sshService.executeCommandDirect(sessionId, cmd);
      const now = Date.now();
      
      return this.parseDiskIO(result || '', now);
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
  private parseDiskIO(output: string, timestamp: number): Pick<DiskInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory'> {
    const lines = output.split('\n');
    let totalRead = 0;
    let totalWrite = 0;
    const currentStats: { [key: string]: { time: number; read: number; write: number } } = {};

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.trim().split(/\s+/);
      // 跳过非物理设备
      if (parts[2].startsWith('loop') || parts[2].startsWith('ram')) continue;
      
      // /proc/diskstats 格式:
      // 字段3: 设备名
      // 字段6: 读取的扇区数
      // 字段10: 写入的扇区数
      const device = parts[2];
      const sectorsRead = parseInt(parts[5]) * 512; // 扇区大小是512字节
      const sectorsWritten = parseInt(parts[9]) * 512;
      
      currentStats[device] = {
        time: timestamp,
        read: sectorsRead,
        write: sectorsWritten
      };

      // 计算速率
      if (this.lastDiskStats[device]) {
        const timeDiff = (timestamp - this.lastDiskStats[device].time) / 1000; // 转换为秒
        if (timeDiff > 0) {
          const readDiff = sectorsRead - this.lastDiskStats[device].read;
          const writeDiff = sectorsWritten - this.lastDiskStats[device].write;
          
          totalRead += readDiff / timeDiff;
          totalWrite += writeDiff / timeDiff;
        }
      }
    }

    // 更新上次的统计数据
    this.lastDiskStats = currentStats;

    return {
      readSpeed: Math.max(0, totalRead),
      writeSpeed: Math.max(0, totalWrite),
      ioHistory: [{
        timestamp,
        readSpeed: Math.max(0, totalRead),
        writeSpeed: Math.max(0, totalWrite)
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