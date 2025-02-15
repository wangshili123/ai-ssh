import { EventEmitter } from 'events';
import { MemoryBasicInfo, MemoryDetailInfo } from '../../../types/monitor';
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
  async collectMetrics(sessionId: string): Promise<MemoryDetailInfo> {
    try {
      const [memInfo, topProcesses] = await Promise.all([
        this.collectBasicMetrics(sessionId),
        this.getTopProcesses(sessionId)
      ]);

      return {
        total: memInfo.total,
        used: memInfo.used,
        free: memInfo.free,
        cached: memInfo.cached,
        buffers: memInfo.buffers,
        usagePercent: memInfo.usagePercent,
        swap: memInfo.swap,
        topProcesses
      };
    } catch (error) {
      console.error('采集内存指标失败:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        cached: 0,
        buffers: 0,
        usagePercent: 0,
        swap: {
          total: 0,
          used: 0,
          free: 0,
          usagePercent: 0
        },
        topProcesses: []
      };
    }
  }

  /**
   * 采集内存基础指标数据
   */
  async collectBasicMetrics(sessionId: string): Promise<MemoryBasicInfo> {
    try {
      const cmd = 'free -b';  // 使用字节为单位
      const result = await this.sshService.executeCommandDirect(sessionId, cmd);
      
      // 解析内存信息
      const lines = result.split('\n');
      const memLine = lines.find(line => line.startsWith('Mem:'));
      const swapLine = lines.find(line => line.startsWith('Swap:'));
      
      if (!memLine || !swapLine) {
        return {
          total: 0,
          used: 0,
          free: 0,
          usagePercent: 0,
          cached: 0,
          buffers: 0,
          swap: {
            total: 0,
            used: 0,
            free: 0,
            usagePercent: 0
          }
        };
      }

      // 解析内存信息
      const memParts = memLine.split(/\s+/);
      const total = parseInt(memParts[1]) || 0;
      const used = parseInt(memParts[2]) || 0;
      const free = parseInt(memParts[3]) || 0;
      const buffers = parseInt(memParts[5]) || 0;
      const cached = parseInt(memParts[6]) || 0;

      // 解析交换空间信息
      const swapParts = swapLine.split(/\s+/);
      const swapTotal = parseInt(swapParts[1]) || 0;
      const swapUsed = parseInt(swapParts[2]) || 0;
      const swapFree = parseInt(swapParts[3]) || 0;

      return {
        total,
        used,
        free,
        cached,
        buffers,
        usagePercent: total > 0 ? (used / total) * 100 : 0,
        swap: {
          total: swapTotal,
          used: swapUsed,
          free: swapFree,
          usagePercent: swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0
        }
      };
    } catch (error) {
      console.error('采集内存基础指标失败:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0,
        cached: 0,
        buffers: 0,
        swap: {
          total: 0,
          used: 0,
          free: 0,
          usagePercent: 0
        }
      };
    }
  }

  /**
   * 获取内存占用TOP进程
   */
  private async getTopProcesses(sessionId: string): Promise<Array<{
    pid: number;
    name: string;
    command: string;
    memoryUsed: number;
    memoryPercent: number;
  }>> {
    try {
      // 使用ps命令获取进程内存使用情况，按内存使用率排序
      const cmd = "ps -eo pid,comm,pmem,rss --sort=-pmem | head -n 11";  // 多取一行用于跳过标题行
      const result = await this.sshService.executeCommandDirect(sessionId, cmd);
      return this.parseTopProcesses(result || '');
    } catch (error) {
      console.error('获取内存占用TOP进程失败:', error);
      return [];
    }
  }

  /**
   * 解析内存占用TOP进程
   */
  private parseTopProcesses(output: string): Array<{
    pid: number;
    name: string;
    command: string;
    memoryUsed: number;
    memoryPercent: number;
  }> {
    const lines = output.split('\n');
    // 跳过标题行
    return lines.slice(1)
      .filter(line => line.trim())  // 过滤空行
      .map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[0]) || 0,
          name: parts[1] || '',
          command: parts[1] || '',  // 暂时使用进程名作为命令
          memoryUsed: parseInt(parts[3]) * 1024,  // RSS值转换为bytes
          memoryPercent: parseFloat(parts[2]) || 0
        };
      })
      .slice(0, 10);  // 只取前10个进程
  }

  /**
   * 采集内存详细指标数据
   */
  async collectDetailMetrics(sessionId: string): Promise<MemoryDetailInfo> {
    try {
      // 暂时使用现有方法，后续优化
      const fullMetrics = await this.collectMetrics(sessionId);
      return {
        total: fullMetrics.total,
        used: fullMetrics.used,
        free: fullMetrics.free,
        usagePercent: fullMetrics.usagePercent,
        cached: fullMetrics.cached,
        buffers: fullMetrics.buffers,
        swap: fullMetrics.swap,
        topProcesses: fullMetrics.topProcesses
      };
    } catch (error) {
      console.error('采集内存详细指标失败:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0,
        cached: 0,
        buffers: 0,
        swap: {
          total: 0,
          used: 0,
          free: 0,
          usagePercent: 0
        },
        topProcesses: []
      };
    }
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    MemoryMetricsService.instance = null as any;
  }
} 