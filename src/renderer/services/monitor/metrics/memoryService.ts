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
      const [memInfo, detailInfo, topProcesses] = await Promise.all([
        this.collectBasicMetrics(sessionId),
        this.getDetailBaseInfo(sessionId),
        this.getTopProcesses(sessionId)
      ]);

      // 计算实际使用内存 = 总内存 - 可用内存
      const actualUsed = Math.max(0, memInfo.total - memInfo.free);
      const actualUsagePercent = memInfo.total > 0 ? (actualUsed / memInfo.total) * 100 : 0;

      return {
        ...memInfo,
        ...detailInfo,
        actualUsed,
        actualUsagePercent,
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
        active: 0,
        inactive: 0,
        dirty: 0,
        writeback: 0,
        actualUsed: 0,
        actualUsagePercent: 0,
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
      console.log('free -b 结果:', result);

      // 解析内存信息
      const lines = result.split('\n');
      // 找到包含 'Mem:' 和 'Swap:' 的行
      const memLine = lines.find(line => line.trim().startsWith('Mem:'));
      const swapLine = lines.find(line => line.trim().startsWith('Swap:'));
      
      if (!memLine || !swapLine) {
        throw new Error('无法获取内存信息');
      }

      // 解析内存信息，先去除所有多余空格，然后分割
      const memParts = memLine.trim().split(/\s+/);
      console.log('解析的内存数据:', memParts);

      // Mem: 行应该有7个值：Mem:, total, used, free, shared, buff/cache, available
      if (memParts.length < 7) {
        throw new Error('内存数据格式不正确');
      }

      const total = parseInt(memParts[1]) || 0;      // 总内存
      const used = parseInt(memParts[2]) || 0;       // 已用内存
      const free = parseInt(memParts[3]) || 0;       // 空闲内存
      const shared = parseInt(memParts[4]) || 0;     // 共享内存
      const buffCache = parseInt(memParts[5]) || 0;  // 缓冲/缓存
      const available = parseInt(memParts[6]) || 0;  // 可用内存

      // 解析交换空间信息
      const swapParts = swapLine.trim().split(/\s+/);
      const swapTotal = parseInt(swapParts[1]) || 0;
      const swapUsed = parseInt(swapParts[2]) || 0;
      const swapFree = parseInt(swapParts[3]) || 0;

      // 计算使用率 = (总内存 - 可用内存) / 总内存
      const usagePercent = total > 0 ? ((total - available) / total) * 100 : 0;

      // 由于free命令的buff/cache是合并值，我们假设它们大致相等
      const buffersAndCache = buffCache / 2;

      return {
        total,
        used,
        free: available,  // 使用available作为可用内存
        cached: buffersAndCache,  // 使用buff/cache的一半作为cached
        buffers: buffersAndCache, // 使用buff/cache的一半作为buffers
        usagePercent,
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
      const cmd = "ps -eo pid,comm,pmem,rss --sort=-pmem | head -n 11";
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
    return lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const parts = line.trim().split(/\s+/);
        return {
          pid: parseInt(parts[0]) || 0,
          name: parts[1] || '',
          command: parts[1] || '',
          memoryUsed: parseInt(parts[3]) * 1024,  // RSS值转换为bytes
          memoryPercent: parseFloat(parts[2]) || 0
        };
      })
      .slice(0, 10);
  }

  /**
   * 采集内存详细指标数据
   */
  async collectDetailMetrics(sessionId: string): Promise<MemoryDetailInfo> {
    try {
      const fullMetrics = await this.collectMetrics(sessionId);
      return {
        total: fullMetrics.total,
        used: fullMetrics.used,
        free: fullMetrics.free,
        usagePercent: fullMetrics.usagePercent,
        cached: fullMetrics.cached,
        buffers: fullMetrics.buffers,
        swap: fullMetrics.swap,
        active: fullMetrics.active,
        inactive: fullMetrics.inactive,
        dirty: fullMetrics.dirty,
        writeback: fullMetrics.writeback,
        actualUsed: fullMetrics.actualUsed,
        actualUsagePercent: fullMetrics.actualUsagePercent,
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
        active: 0,
        inactive: 0,
        dirty: 0,
        writeback: 0,
        actualUsed: 0,
        actualUsagePercent: 0,
        topProcesses: []
      };
    }
  }

  /**
   * 获取内存详细基础信息
   */
  private async getDetailBaseInfo(sessionId: string): Promise<{
    active: number;
    inactive: number;
    dirty: number;
    writeback: number;
  }> {
    try {
      const cmd = 'cat /proc/meminfo';
      const result = await this.sshService.executeCommandDirect(sessionId, cmd);
      
      // 解析内存信息
      const lines = result.split('\n');
      const getValue = (key: string): number => {
        const line = lines.find(l => l.startsWith(key));
        if (!line) return 0;
        const value = parseInt(line.split(/\s+/)[1]) || 0;
        return value * 1024; // 转换为bytes（meminfo中的值以KB为单位）
      };

      return {
        active: getValue('Active:'),
        inactive: getValue('Inactive:'),
        dirty: getValue('Dirty:'),
        writeback: getValue('Writeback:')
      };
    } catch (error) {
      console.error('获取内存详细基础信息失败:', error);
      return {
        active: 0,
        inactive: 0,
        dirty: 0,
        writeback: 0
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