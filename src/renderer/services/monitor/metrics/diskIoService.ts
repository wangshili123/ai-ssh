import { SSHService } from '../../../types';

export interface IoProcessInfo {
  pid: number;
  name: string;
  command: string;
  readBytes: number;
  writeBytes: number;
  readSpeed: number;
  writeSpeed: number;
}

export interface IoStats {
  device: string;
  tps: number;
  readSpeed: number;
  writeSpeed: number;
  await: number;
  svctm: number;
  util: number;
}

export interface IoAnalysis {
  topProcesses: IoProcessInfo[];
  deviceStats: IoStats[];
  timestamp: number;
}

/**
 * 磁盘IO分析服务
 */
export class DiskIoService {
  private static instance: DiskIoService;
  private sshService: SSHService;
  private lastProcessStats: Map<number, { readBytes: number; writeBytes: number; timestamp: number }> = new Map();

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  static getInstance(sshService: SSHService): DiskIoService {
    if (!DiskIoService.instance) {
      DiskIoService.instance = new DiskIoService(sshService);
    }
    return DiskIoService.instance;
  }

  /**
   * 获取IO分析数据
   */
  async getIoAnalysis(sessionId: string): Promise<IoAnalysis | undefined> {
    try {
      console.log('开始获取IO分析数据:', {
        sessionId,
        timestamp: new Date().toISOString()
      });

      // 获取进程IO统计
      const topProcesses = await this.getTopIoProcesses(sessionId);
      console.log('获取到进程IO统计:', {
        sessionId,
        processCount: topProcesses.length,
        timestamp: new Date().toISOString()
      });

      // 获取设备IO统计
      const deviceStats = await this.getDeviceIoStats(sessionId);
      console.log('获取到设备IO统计:', {
        sessionId,
        deviceCount: deviceStats.length,
        timestamp: new Date().toISOString()
      });

      const analysis: IoAnalysis = {
        topProcesses,
        deviceStats,
        timestamp: Date.now()
      };

      console.log('IO分析数据获取完成:', {
        sessionId,
        processCount: analysis.topProcesses.length,
        deviceCount: analysis.deviceStats.length,
        timestamp: new Date(analysis.timestamp).toISOString()
      });

      return analysis;
    } catch (error) {
      console.error('获取IO分析数据失败:', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
      return undefined;
    }
  }

  /**
   * 获取IO占用最高的进程
   */
  private async getTopIoProcesses(sessionId: string): Promise<IoProcessInfo[]> {
    try {
      // 使用pidstat命令获取进程IO信息
      const cmd = 'pidstat -d 1 1 -p ALL';
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      if (!output) return [];

      const now = Date.now();
      const processes = this.parsePidstatOutput(output);
      
      // 计算IO速度
      processes.forEach(process => {
        const lastStats = this.lastProcessStats.get(process.pid);
        if (lastStats) {
          const timeDiff = (now - lastStats.timestamp) / 1000;
          if (timeDiff > 0) {
            process.readSpeed = (process.readBytes - lastStats.readBytes) / timeDiff;
            process.writeSpeed = (process.writeBytes - lastStats.writeBytes) / timeDiff;
          }
        }
        
        this.lastProcessStats.set(process.pid, {
          readBytes: process.readBytes,
          writeBytes: process.writeBytes,
          timestamp: now
        });
      });

      return processes
        .sort((a, b) => (b.readSpeed + b.writeSpeed) - (a.readSpeed + a.writeSpeed))
        .slice(0, 10);
    } catch (error) {
      console.error('获取进程IO信息失败:', error);
      return [];
    }
  }

  /**
   * 获取设备IO统计
   */
  private async getDeviceIoStats(sessionId: string): Promise<IoStats[]> {
    try {
      // 使用iostat命令获取设备IO统计
      const cmd = 'iostat -x 1 1';
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      if (!output) return [];

      return this.parseIostatOutput(output);
    } catch (error) {
      console.error('获取设备IO统计失败:', error);
      return [];
    }
  }

  /**
   * 解析pidstat输出
   */
  private parsePidstatOutput(output: string): IoProcessInfo[] {
    const processes: IoProcessInfo[] = [];
    const lines = output.split('\n');
    let dataStarted = false;

    for (const line of lines) {
      if (line.includes('kB_rd/s')) {
        dataStarted = true;
        continue;
      }

      if (!dataStarted || !line.trim()) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length < 8) continue;

      processes.push({
        pid: parseInt(parts[2]),
        name: parts[8],
        command: parts.slice(8).join(' '),
        readBytes: parseFloat(parts[3]) * 1024,  // 转换为bytes
        writeBytes: parseFloat(parts[4]) * 1024, // 转换为bytes
        readSpeed: 0,  // 将在后续计算
        writeSpeed: 0  // 将在后续计算
      });
    }

    return processes;
  }

  /**
   * 解析iostat输出
   */
  private parseIostatOutput(output: string): IoStats[] {
    const stats: IoStats[] = [];
    const lines = output.split('\n');
    let dataStarted = false;

    for (const line of lines) {
      if (line.includes('Device')) {
        dataStarted = true;
        continue;
      }

      if (!dataStarted || !line.trim()) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length < 14) continue;

      stats.push({
        device: parts[0],
        tps: parseFloat(parts[1]),
        readSpeed: parseFloat(parts[2]) * 1024,  // 转换为bytes/s
        writeSpeed: parseFloat(parts[3]) * 1024, // 转换为bytes/s
        await: parseFloat(parts[9]),    // 平均等待时间(ms)
        svctm: parseFloat(parts[12]),   // 平均服务时间(ms)
        util: parseFloat(parts[13])     // 设备利用率(%)
      });
    }

    return stats;
  }

  destroy(): void {
    DiskIoService.instance = null as any;
  }
} 