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

      // 更新分区的IO速度
      const partitions = diskUsage.partitions.map(partition => {
        const deviceName = partition.device.split('/').pop() || '';
        const deviceStats = diskIO.deviceStats?.[deviceName] || { readSpeed: 0, writeSpeed: 0 };
        return {
          ...partition,
          readSpeed: deviceStats.readSpeed,
          writeSpeed: deviceStats.writeSpeed
        };
      });

      return {
        ...diskUsage,
        ...diskIO,
        partitions
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
      
      // 获取磁盘类型信息
      const rotationalCmd = "find /sys/block/*/queue/rotational -type f -exec sh -c 'echo $(dirname $(dirname {})) $(cat {})' \\;";
      const rotationalResult = await this.sshService.executeCommandDirect(sessionId, rotationalCmd);
      
      return this.parseDiskUsage(dfResult || '', rotationalResult || '');
    } catch (error) {
      console.error('获取磁盘使用情况失败:', error);
      throw error;
    }
  }

  /**
   * 获取磁盘IO情况
   */
  private async getDiskIO(sessionId: string): Promise<Pick<DiskInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory' | 'deviceStats'>> {
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
        ioHistory: [],
        deviceStats: {}
      };
    }
  }

  /**
   * 解析磁盘使用情况
   */
  private parseDiskUsage(output: string, rotationalOutput: string): Omit<DiskInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory'> {
    // 解析磁盘类型信息
    const diskTypes = new Map<string, string>();
    rotationalOutput.split('\n').forEach(line => {
      if (!line.trim()) return;
      const [path, rotational] = line.trim().split(' ');
      const device = path.split('/').pop() || '';
      diskTypes.set(device, rotational === '0' ? 'SSD' : 'HDD');
    });

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
      
      // 获取设备名和磁盘类型
      const deviceName = device.split('/').pop() || '';
      const baseDevice = deviceName.replace(/[0-9]+$/, ''); // 移除分区号以获取基础设备名
      const diskType = diskTypes.get(baseDevice) || '未知';
      
      partitions.push({
        device,
        mountpoint,
        fstype,
        diskType,
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
      partitions,
      deviceStats: {}
    };
  }

  /**
   * 解析磁盘IO情况
   */
  private parseDiskIO(output: string, timestamp: number): Pick<DiskInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory' | 'deviceStats'> {
    const lines = output.split('\n');
    let totalRead = 0;
    let totalWrite = 0;
    const currentStats: { [key: string]: { time: number; read: number; write: number } } = {};
    const deviceStats: { [key: string]: { readSpeed: number; writeSpeed: number } } = {};

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.trim().split(/\s+/);
      // 跳过非物理设备
      if (parts[2].startsWith('loop') || parts[2].startsWith('ram')) continue;
      
      const device = parts[2];
      const sectorsRead = parseInt(parts[5]) * 512;
      const sectorsWritten = parseInt(parts[9]) * 512;
      
      currentStats[device] = {
        time: timestamp,
        read: sectorsRead,
        write: sectorsWritten
      };

      // 计算每个设备的速率
      if (this.lastDiskStats[device]) {
        const timeDiff = (timestamp - this.lastDiskStats[device].time) / 1000;
        if (timeDiff > 0) {
          const readDiff = sectorsRead - this.lastDiskStats[device].read;
          const writeDiff = sectorsWritten - this.lastDiskStats[device].write;
          
          const readSpeed = readDiff / timeDiff;
          const writeSpeed = writeDiff / timeDiff;
          
          deviceStats[device] = {
            readSpeed: Math.max(0, readSpeed),
            writeSpeed: Math.max(0, writeSpeed)
          };
          
          totalRead += readSpeed;
          totalWrite += writeSpeed;
        }
      }
    }

    // 更新上次的统计数据
    this.lastDiskStats = currentStats;

    return {
      readSpeed: Math.max(0, totalRead),
      writeSpeed: Math.max(0, totalWrite),
      deviceStats,
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