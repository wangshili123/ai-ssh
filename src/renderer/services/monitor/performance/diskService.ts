import { DiskBasicInfo, DiskDetailInfo } from '../../../types/monitor';
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
  async collectMetrics(sessionId: string): Promise<DiskDetailInfo> {
    try {
      const [diskUsage, diskIO] = await Promise.all([
        this.getDiskUsage(sessionId),
        this.getDiskIO(sessionId)
      ]);
      console.log('采集磁盘基础数据:', {
        diskUsage,
        diskIO
      });

      // 更新分区的IO速度
      const partitions = diskUsage.partitions.map(partition => {
        // 获取完整设备名（包含分区号）
        const fullDeviceName = partition.device.split('/').pop() || '';
        
        // 只使用完整设备名进行匹配
        const possibleNames = [
          fullDeviceName,                // 完整设备名（如 sda1, sda2）
          partition.device               // 完整路径（如 /dev/sda1）
        ];
        
        console.log('尝试匹配设备IO:', {
          partition: partition.device,
          mountpoint: partition.mountpoint,
          fullDeviceName,
          possibleNames,
          availableStats: Object.keys(diskIO.deviceStats || {})
        });

        // 查找第一个匹配的设备统计信息
        let matchedName;
        const matchedStats = possibleNames
          .find(name => {
            if (diskIO.deviceStats?.[name]) {
              matchedName = name;
              return true;
            }
            return false;
          });

        const stats = matchedStats ? diskIO.deviceStats[matchedName!] : { readSpeed: 0, writeSpeed: 0 };
        
        console.log('设备IO匹配结果:', {
          partition: partition.device,
          mountpoint: partition.mountpoint,
          matchedName,
          stats
        });

        return {
          ...partition,
          readSpeed: stats.readSpeed,
          writeSpeed: stats.writeSpeed
        };
      });

      console.log('采集磁盘指标数据:', {
        diskUsage,
        diskIO,
        partitions: partitions.map(p => ({
          device: p.device,
          mountpoint: p.mountpoint,
          readSpeed: p.readSpeed,
          writeSpeed: p.writeSpeed
        }))
      });

      return {
        ...diskUsage,
        ...diskIO,
        partitions
      };
    } catch (error) {
      console.error('采集磁盘指标失败:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0,
        partitions: [],
        deviceStats: {},
        readSpeed: 0,
        writeSpeed: 0,
        ioHistory: []
      };
    }
  }

  /**
   * 获取磁盘使用情况
   */
  private async getDiskUsage(sessionId: string): Promise<Omit<DiskDetailInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory'>> {
    try {
      // 使用df命令获取磁盘使用情况
      const dfCmd = 'df -B1 --output=source,target,fstype,size,used,avail,pcent';
      const dfResult = await this.sshService.executeCommandDirect(sessionId, dfCmd);
      
      // 使用lsblk命令获取磁盘类型信息，添加TYPE字段，并获取根设备信息
      const lsblkCmd = "lsblk -o NAME,TYPE,ROTA,TRAN,MOUNTPOINT -n";
      const lsblkResult = await this.sshService.executeCommandDirect(sessionId, lsblkCmd);

      // 获取根分区对应的实际设备
      const findmntCmd = "findmnt -n -o SOURCE /";
      const rootDevice = await this.sshService.executeCommandDirect(sessionId, findmntCmd);
      
      return this.parseDiskUsage(dfResult || '', rootDevice?.trim() || '', lsblkResult || '');
    } catch (error) {
      console.error('获取磁盘使用情况失败:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0,
        partitions: [],
        deviceStats: {}
      };
    }
  }

  /**
   * 获取磁盘IO情况
   */
  private async getDiskIO(sessionId: string): Promise<Pick<DiskDetailInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory' | 'deviceStats'>> {
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
  private parseDiskUsage(output: string, rootDevice: string, lsblkOutput: string): Omit<DiskDetailInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory'> {
    // 解析磁盘类型信息
    const diskTypes = new Map<string, string>();
    let rootDeviceName = '';
    
    // 从lsblk输出解析
    const lsblkLines = lsblkOutput.split('\n');
    console.log('原始lsblk输出:', lsblkOutput);
    console.log('根设备:', rootDevice);
    
    lsblkLines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.trim().split(/\s+/);
      // 去除树形结构符号（如 └─）
      const name = parts[0].replace(/[└─├─]/g, '');
      const type = parts[1];
      const mountpoint = parts[parts.length - 1];
      
      console.log('处理lsblk行:', {
        line,
        parts,
        cleanName: name,
        type,
        mountpoint
      });
      
      // 记录根分区对应的设备名
      if (mountpoint === '/') {
        rootDeviceName = name.replace(/[0-9]+$/, '');
        console.log('找到根分区设备:', rootDeviceName);
      }
      
      // 只处理disk类型的设备，跳过分区
      if (type === 'disk') {
        let diskType = 'HDD';
        // 根据设备名判断是否为云盘
        if (name.startsWith('vd')) {
          diskType = 'ESSD云盘';
          console.log('检测到ESSD云盘:', name);
        } else if (parts.includes('sata') && parts.includes('0')) {
          diskType = 'SSD';
          console.log('检测到SATA SSD:', name);
        } else if (parts.includes('nvme')) {
          diskType = 'SSD';
          console.log('检测到NVMe SSD:', name);
        }
        console.log('设置磁盘类型:', { name, diskType });
        diskTypes.set(name, diskType);
      }
    });

    console.log('最终磁盘类型映射:', Object.fromEntries(diskTypes));
    console.log('根设备名:', rootDeviceName);

    const lines = output.split('\n').slice(1); // 跳过标题行
    const partitions = [];
    let totalSize = 0;
    let totalUsed = 0;
    let totalFree = 0;

    // 分别存储物理分区和虚拟分区
    const physicalPartitions = [];
    const virtualPartitions = [];

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const [device, mountpoint, fstype, size, used, free, usageStr] = line.trim().split(/\s+/);
      
      const usagePercent = parseInt(usageStr.replace('%', ''));
      
      // 获取设备名和磁盘类型，移除所有特殊字符
      let fullDeviceName = device.split('/').pop() || '';
      let baseDeviceName = fullDeviceName.replace(/[0-9]+$/, '').replace(/[└─├─]/g, '');
      
      // 特殊处理 /dev/root
      if (device === '/dev/root' && rootDeviceName) {
        baseDeviceName = rootDeviceName.replace(/[└─├─]/g, '');
        console.log('将/dev/root映射到实际设备:', baseDeviceName);
      }
      
      console.log('处理分区:', { 
        device,
        mountpoint,
        fullDeviceName,
        baseDeviceName,
        foundType: diskTypes.get(baseDeviceName),
        allTypes: Object.fromEntries(diskTypes)
      });
      
      // 根据文件系统类型判断是否为虚拟分区
      const isVirtual = ['tmpfs', 'devtmpfs', 'sysfs', 'proc', 'devpts', 'securityfs', 'cgroup', 'pstore', 'hugetlbfs', 'mqueue', 'debugfs'].includes(fstype);
      
      // 判断是否为Docker存储
      const isDocker = fstype === 'overlay' || fstype === 'overlay2' || device.includes('/var/lib/docker');
      
      let diskType;
      if (isVirtual) {
        diskType = '虚拟分区';
      } else if (isDocker) {
        diskType = 'Docker存储';
      } else {
        // 先尝试从diskTypes获取类型
        diskType = diskTypes.get(baseDeviceName);
        console.log('尝试获取磁盘类型:', {
          baseDeviceName,
          diskType,
          startWithVd: baseDeviceName.startsWith('vd')
        });
        
        // 如果没有找到类型，但设备名以vd开头，则设为ESSD云盘
        if (!diskType && baseDeviceName.startsWith('vd')) {
          diskType = 'ESSD云盘';
          console.log('通过设备名判定为ESSD云盘:', baseDeviceName);
        }
        
        // 如果仍然没有类型，则设为未知
        if (!diskType) {
          diskType = '未知';
          console.log('设置为未知类型:', baseDeviceName);
        }
      }
      
      console.log('最终分区信息:', {
        device,
        mountpoint,
        diskType
      });

      const partition = {
        device,
        mountpoint,
        fstype,
        diskType,
        total: parseInt(size),
        used: parseInt(used),
        free: parseInt(free),
        usagePercent,
        readSpeed: 0,
        writeSpeed: 0
      };

      // 根据分区类型分别存储
      if (isVirtual) {
        virtualPartitions.push(partition);
      } else {
        physicalPartitions.push(partition);
        totalSize += parseInt(size);
        totalUsed += parseInt(used);
        totalFree += parseInt(free);
      }
    }

    // 对物理分区按照挂载点排序
    physicalPartitions.sort((a, b) => {
      // 根目录排在最前面
      if (a.mountpoint === '/') return -1;
      if (b.mountpoint === '/') return 1;
      return a.mountpoint.localeCompare(b.mountpoint);
    });

    // 对虚拟分区按照挂载点排序
    virtualPartitions.sort((a, b) => a.mountpoint.localeCompare(b.mountpoint));

    // 合并物理分区和虚拟分区
    const allPartitions = [...physicalPartitions, ...virtualPartitions];

    return {
      total: totalSize,
      used: totalUsed,
      free: totalFree,
      usagePercent: totalSize > 0 ? (totalUsed / totalSize) * 100 : 0,
      partitions: allPartitions,
      deviceStats: {}
    };
  }

  /**
   * 解析磁盘IO情况
   */
  private parseDiskIO(output: string, timestamp: number): Pick<DiskDetailInfo, 'readSpeed' | 'writeSpeed' | 'ioHistory' | 'deviceStats'> {
    const lines = output.split('\n');
    
    let totalRead = 0;
    let totalWrite = 0;
    const currentStats: { [key: string]: { time: number; read: number; write: number } } = {};
    const deviceStats: { [key: string]: { readSpeed: number; writeSpeed: number } } = {};
    // 记录已处理的基础设备，避免重复计算分区速率
    const processedBaseDevices = new Set<string>();

    for (const line of lines) {
      if (!line.trim()) continue;
      
      const parts = line.trim().split(/\s+/);
      // 跳过非物理设备
      if (parts[2].startsWith('loop') || parts[2].startsWith('ram')) {
        continue;
      }
      
      const device = parts[2];
      // 获取基础设备名（移除分区号）
      const baseDevice = device.replace(/[0-9]+$/, '');
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
          
          // 只有在基础设备未处理过时才累加到总速率
          if (!processedBaseDevices.has(baseDevice)) {
            totalRead += readSpeed;
            totalWrite += writeSpeed;
            processedBaseDevices.add(baseDevice);
   
          } else {
     
          }
        } else {
         
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


  async collectBasicMetrics(sessionId: string): Promise<DiskBasicInfo> {
    try {
      // 只使用df命令获取基础磁盘使用情况，使用-B1参数以字节为单位
      const dfCmd = 'df -B1 --output=source,target,fstype,size,used,avail,pcent';
      const dfResult = await this.sshService.executeCommandDirect(sessionId, dfCmd);
      
      const lines = dfResult.split('\n').slice(1); // 跳过标题行
      let totalSize = 0;
      let totalUsed = 0;
      let totalFree = 0;

      // 分别存储物理分区和虚拟分区
      const physicalPartitions = [];
      const virtualPartitions = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        const [device, mountpoint, fstype, size, used, free] = line.trim().split(/\s+/);
        
        // 根据文件系统类型判断是否为虚拟分区
        const isVirtual = ['tmpfs', 'devtmpfs', 'sysfs', 'proc', 'devpts', 'securityfs', 'cgroup', 'pstore', 'hugetlbfs', 'mqueue', 'debugfs'].includes(fstype);
        
        // 判断是否为Docker存储
        const isDocker = fstype === 'overlay' || fstype === 'overlay2' || device.includes('/var/lib/docker');
        
        if (!isVirtual && !isDocker) {
          totalSize += parseInt(size) || 0;
          totalUsed += parseInt(used) || 0;
          totalFree += parseInt(free) || 0;
        }
      }

      return {
        total: totalSize,
        used: totalUsed,
        free: totalFree,
        usagePercent: totalSize > 0 ? (totalUsed / totalSize) * 100 : 0
      };
    } catch (error) {
      console.error('获取磁盘基础使用情况失败:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0
      };
    }
  }

  async collectDetailMetrics(sessionId: string): Promise<DiskDetailInfo> {
    return this.collectMetrics(sessionId);
  }


  /**
   * 销毁实例
   */
  destroy(): void {
    DiskMetricsService.instance = null as any;
  }
} 