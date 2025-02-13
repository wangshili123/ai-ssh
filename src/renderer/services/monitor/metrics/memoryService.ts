import { MemoryInfo } from '../../../types/monitor';
import { SSHService } from '../../../types';

/**
 * 内存数据采集服务
 */
export class MemoryMetricsService {
  private static instance: MemoryMetricsService;
  private sshService: SSHService;

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
  }

  /**
   * 获取单例实例
   */
  static getInstance(sshService: SSHService): MemoryMetricsService {
    if (!MemoryMetricsService.instance) {
      MemoryMetricsService.instance = new MemoryMetricsService(sshService);
    }
    return MemoryMetricsService.instance;
  }

  /**
   * 采集内存所有指标数据
   */
  async collectMetrics(sessionId: string): Promise<MemoryInfo> {
    try {
      const [memInfo, processInfo] = await Promise.all([
        this.getMemoryInfo(sessionId),
        this.getTopProcesses(sessionId)
      ]);

      return {
        ...memInfo,
        topProcesses: processInfo
      };
    } catch (error) {
      console.error('采集内存指标失败:', error);
      throw error;
    }
  }

  /**
   * 获取内存基本信息
   */
  private async getMemoryInfo(sessionId: string): Promise<Omit<MemoryInfo, 'topProcesses'>> {
    try {
      // 使用free命令获取内存使用情况
      const freeCmd = 'free -b';  // 使用bytes为单位
      const freeResult = await this.sshService.executeCommandDirect(sessionId, freeCmd);
      
      // 获取/proc/meminfo中的详细信息
      const meminfoCmd = 'cat /proc/meminfo';
      const meminfoResult = await this.sshService.executeCommandDirect(sessionId, meminfoCmd);

      return this.parseMemoryInfo(freeResult || '', meminfoResult || '');
    } catch (error) {
      console.error('获取内存信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取内存占用TOP进程
   */
  private async getTopProcesses(sessionId: string): Promise<MemoryInfo['topProcesses']> {
    try {
      // 获取内存占用前10的进程，增加 cmd 字段显示完整命令行
      const cmd = "ps -eo pid,comm,%mem,rss,args --sort=-rss | head -n 11";
      const result = await this.sshService.executeCommandDirect(sessionId, cmd);
      
      return this.parseProcessInfo(result || '');
    } catch (error) {
      console.error('获取进程内存使用信息失败:', error);
      return [];
    }
  }

  /**
   * 解析内存信息
   */
  private parseMemoryInfo(freeOutput: string, meminfoOutput: string): Omit<MemoryInfo, 'topProcesses'> {
    const lines = freeOutput.split('\n');
    const memLine = lines[1]?.split(/\s+/);
    const swapLine = lines[2]?.split(/\s+/);

    // 解析/proc/meminfo获取缓存信息
    const meminfoLines = meminfoOutput.split('\n');
    let cached = 0;
    let buffers = 0;

    for (const line of meminfoLines) {
      if (line.startsWith('Cached:')) {
        cached = parseInt(line.split(/\s+/)[1]) * 1024;  // 转换为bytes
      } else if (line.startsWith('Buffers:')) {
        buffers = parseInt(line.split(/\s+/)[1]) * 1024;  // 转换为bytes
      }
    }

    const total = parseInt(memLine?.[1] || '0');
    const used = parseInt(memLine?.[2] || '0');
    const free = parseInt(memLine?.[3] || '0');
    const swapTotal = parseInt(swapLine?.[1] || '0');
    const swapUsed = parseInt(swapLine?.[2] || '0');
    const swapFree = parseInt(swapLine?.[3] || '0');

    return {
      total,
      used,
      free,
      cached,
      buffers,
      usagePercent: (used / total) * 100,
      swap: {
        total: swapTotal,
        used: swapUsed,
        free: swapFree,
        usagePercent: swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0
      }
    };
  }

  /**
   * 解析进程信息
   */
  private parseProcessInfo(output: string): MemoryInfo['topProcesses'] {
    return output
      .split('\n')
      .slice(1)  // 跳过标题行
      .filter(line => line.trim())
      .map(line => {
        // 由于args可能包含空格，需要特殊处理
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[0]);
        const name = parts[1];
        const memPercent = parseFloat(parts[2]);
        const rss = parts[3];  // 保持为字符串
        // 从第5个字段开始到最后都是命令行
        const command = parts.slice(4).join(' ');

        return {
          pid,
          name,
          command,
          memoryUsed: parseInt(rss) * 1024,  // 现在 rss 是字符串，可以正确解析
          memoryPercent: memPercent
        };
      });
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    MemoryMetricsService.instance = null as any;
  }
} 