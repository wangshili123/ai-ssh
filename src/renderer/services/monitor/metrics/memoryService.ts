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
      const [memInfo, swapInfo, topProcesses] = await Promise.all([
        this.getMemoryInfo(sessionId),
        this.getSwapInfo(sessionId),
        this.getTopProcesses(sessionId)
      ]);

      // 确保所有必需的字段都有值
      return {
        total: memInfo.total || 0,
        used: memInfo.used || 0,
        free: memInfo.free || 0,
        cached: memInfo.cached || 0,
        buffers: memInfo.buffers || 0,
        usagePercent: memInfo.usagePercent || 0,
        swap: swapInfo,
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
   * 获取内存基本信息
   */
  private async getMemoryInfo(sessionId: string): Promise<Partial<MemoryDetailInfo>> {
    try {
      const cmd = 'free -b';  // 使用字节为单位
      const result = await this.sshService.executeCommandDirect(sessionId, cmd);
      return this.parseMemoryInfo(result || '');
    } catch (error) {
      console.error('获取内存信息失败:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        cached: 0,
        buffers: 0,
        usagePercent: 0
      };
    }
  }

  /**
   * 获取交换空间信息
   */
  private async getSwapInfo(sessionId: string): Promise<{
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  }> {
    try {
      const cmd = 'free -b';  // 使用字节为单位
      const result = await this.sshService.executeCommandDirect(sessionId, cmd);
      return this.parseSwapInfo(result || '');
    } catch (error) {
      console.error('获取交换空间信息失败:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0
      };
    }
  }

  /**
   * 解析内存信息
   */
  private parseMemoryInfo(output: string): Partial<MemoryDetailInfo> {
    const lines = output.split('\n');
    const memLine = lines.find(line => line.startsWith('Mem:'));
    
    if (!memLine) {
      return {
        total: 0,
        used: 0,
        free: 0,
        cached: 0,
        buffers: 0,
        usagePercent: 0
      };
    }

    const parts = memLine.split(/\s+/);
    const total = parseInt(parts[1]) || 0;
    const used = parseInt(parts[2]) || 0;
    const free = parseInt(parts[3]) || 0;
    const buffers = parseInt(parts[5]) || 0;
    const cached = parseInt(parts[6]) || 0;

    return {
      total,
      used,
      free,
      cached,
      buffers,
      usagePercent: total > 0 ? (used / total) * 100 : 0
    };
  }

  /**
   * 解析交换空间信息
   */
  private parseSwapInfo(output: string): {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  } {
    const lines = output.split('\n');
    const swapLine = lines.find(line => line.startsWith('Swap:'));
    
    if (!swapLine) {
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0
      };
    }

    const parts = swapLine.split(/\s+/);
    const total = parseInt(parts[1]) || 0;
    const used = parseInt(parts[2]) || 0;
    const free = parseInt(parts[3]) || 0;

    return {
      total,
      used,
      free,
      usagePercent: total > 0 ? (used / total) * 100 : 0
    };
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
   * 采集内存基础指标数据
   */
  async collectBasicMetrics(sessionId: string): Promise<MemoryBasicInfo> {
    try {
      // 暂时使用现有方法，后续优化
      const fullMetrics = await this.collectMetrics(sessionId);
      return {
        total: fullMetrics.total,
        used: fullMetrics.used,
        free: fullMetrics.free,
        usagePercent: fullMetrics.usagePercent
      };
    } catch (error) {
      console.error('采集内存基础指标失败:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        usagePercent: 0
      };
    }
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