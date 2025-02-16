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
  isToolInstalled: boolean;
}

/**
 * 磁盘IO分析服务
 */
export class DiskIoService {
  private static instance: DiskIoService;
  private sshService: SSHService;
  private lastProcessStats: Map<number, { readBytes: number; writeBytes: number; timestamp: number }> = new Map();
  private isToolInstalled: boolean | null = null;

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
   * 检查必要工具是否已安装
   */
  private async checkTools(sessionId: string): Promise<boolean> {
    if (this.isToolInstalled !== null) {
      return this.isToolInstalled;
    }

    try {
      // 检查iotop命令是否可用
      const iotopCheck = await this.sshService.executeCommandDirect(sessionId, 'which iotop >/dev/null 2>&1 && echo "yes" || echo "no"');
      console.log('iotopCheck:', iotopCheck);
      this.isToolInstalled = iotopCheck.trim() === 'yes';
      
      return this.isToolInstalled;
    } catch (error) {
      console.error('检查工具安装状态失败:', error);
      return false;
    }
  }

  /**
   * 获取IO分析数据
   */
  async getIoAnalysis(sessionId: string): Promise<IoAnalysis | undefined> {
    try {
      console.log('获取IO分析数据:', {
        sessionId,
        timestamp: new Date().toISOString()
      });
      console.time('获取IO分析数据');
      const isInstalled = await this.checkTools(sessionId);
      
      if (!isInstalled) {
        return {
          topProcesses: [],
          deviceStats: [],
          timestamp: Date.now(),
          isToolInstalled: false
        };
      }

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
      console.timeEnd('获取IO分析数据');
      return {
        topProcesses,
        deviceStats,
        timestamp: Date.now(),
        isToolInstalled: true
      };
    } catch (error) {
      console.error('获取IO分析数据失败:', error);
      return undefined;
    }
  }

  /**
   * 获取IO占用最高的进程
   */
  private async getTopIoProcesses(sessionId: string): Promise<IoProcessInfo[]> {
    try {
      // 使用iotop获取IO信息，-b批处理模式，-n 1只采样一次，-P显示完整命令
      // -k按IO排序，-o只显示有IO的进程，head -n 11限制输出（包含header）
      const cmd = "iotop -b -n 1 -P -k -o | head -n 11";
      const output = await this.sshService.executeCommandDirect(sessionId, cmd);
      console.log('iotop输出:', output);
      if (!output) return [];

      const now = Date.now();
      const processes = this.parseIotopOutput(output);
      
      // 更新历史数据
      processes.forEach(process => {
        this.lastProcessStats.set(process.pid, {
          readBytes: process.readBytes,
          writeBytes: process.writeBytes,
          timestamp: now
        });
      });

      return processes;
    } catch (error) {
      console.error('获取进程IO信息失败:', error);
      return [];
    }
  }

  /**
   * 解析iotop输出
   */
  private parseIotopOutput(output: string): IoProcessInfo[] {
    const processes: IoProcessInfo[] = [];
    const lines = output.split('\n');

    // 跳过汇总信息行和空行
    for (const line of lines) {
      if (!line.trim() || 
          line.startsWith('Total') || 
          line.startsWith('Actual') || 
          line.includes('TID  PRIO')) {
        continue;
      }

      try {
        // 示例行: "30668 be/4 root        0.00 B/s   11.82 K/s  0.00 %  0.01 % java -server ..."
        const parts = line.trim().split(/\s+/);
        if (parts.length < 8) continue;

        // 解析PID (第1列)
        const pid = parseInt(parts[0]);
        if (isNaN(pid)) continue;

        // 查找读写速度的位置
        let readSpeedIndex = -1;
        let writeSpeedIndex = -1;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          const nextPart = parts[i + 1];
          if (nextPart && nextPart.endsWith('/s')) {
            if (readSpeedIndex === -1) {
              readSpeedIndex = i;
              i++; // 跳过单位
            } else {
              writeSpeedIndex = i;
              i++; // 跳过单位
              break;
            }
          }
        }

        if (readSpeedIndex === -1 || writeSpeedIndex === -1) continue;

        // 解析读写速度
        const readSpeed = this.parseSpeedWithUnit(parts[readSpeedIndex], parts[readSpeedIndex + 1]);
        const writeSpeed = this.parseSpeedWithUnit(parts[writeSpeedIndex], parts[writeSpeedIndex + 1]);

        // 查找命令开始的位置（在最后一个百分比之后）
        let cmdStartIndex = -1;
        for (let i = writeSpeedIndex + 2; i < parts.length; i++) {
          if (parts[i].endsWith('%')) {
            cmdStartIndex = i + 1;
          }
        }

        if (cmdStartIndex === -1 || cmdStartIndex >= parts.length) continue;

        // 获取完整命令
        const command = parts.slice(cmdStartIndex).join(' ');
        
        // 获取进程名
        let name = command;
        if (command.includes('[') && command.includes(']')) {
          // 如果是内核线程，使用方括号内的名称
          const match = command.match(/\[(.*?)\]/);
          if (match) {
            name = match[1];
          }
        } else {
          // 从命令中提取基本名称（去掉路径和参数）
          name = command.split(' ')[0].split('/').pop() || command;
        }

        processes.push({
          pid,
          name,
          command,
          readBytes: readSpeed,
          writeBytes: writeSpeed,
          readSpeed,
          writeSpeed
        });
      } catch (error) {
        console.error('解析行失败:', line, error);
        continue;
      }
    }

    return processes;
  }

  /**
   * 解析带单位的速度值
   */
  private parseSpeedWithUnit(value: string, unit: string): number {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return 0;

    const unitStr = unit.toLowerCase();
    if (!unitStr.endsWith('/s')) return numValue;

    if (unitStr.startsWith('k')) {
      return numValue * 1024;
    } else if (unitStr.startsWith('m')) {
      return numValue * 1024 * 1024;
    } else if (unitStr.startsWith('g')) {
      return numValue * 1024 * 1024 * 1024;
    }
    return numValue;
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