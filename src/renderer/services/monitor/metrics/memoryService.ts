import { commandService } from './commandService';
import { MemoryInfo, MemoryStats, VMStats } from './metricsTypes';

/**
 * 内存数据采集服务
 */
export class MemoryService {
  private static instance: MemoryService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): MemoryService {
    if (!MemoryService.instance) {
      MemoryService.instance = new MemoryService();
    }
    return MemoryService.instance;
  }

  /**
   * 获取内存使用情况
   */
  async getMemoryInfo(): Promise<MemoryInfo> {
    try {
      // 使用free命令获取内存使用情况
      const result = await commandService.executeCommand('free -k');
      if (!result.success || !result.data) {
        throw new Error('Failed to get memory info');
      }

      const lines = result.data.split('\n');
      const memLine = lines.find(line => line.startsWith('Mem:'));
      const swapLine = lines.find(line => line.startsWith('Swap:'));

      if (!memLine || !swapLine) {
        throw new Error('Memory data not found');
      }

      // 解析内存数据
      const memParts = memLine.split(/\s+/).filter(Boolean);
      const swapParts = swapLine.split(/\s+/).filter(Boolean);

      // 获取/proc/meminfo中的详细信息
      const meminfoResult = await commandService.executeCommand('cat /proc/meminfo');
      let available = 0;
      let buffers = 0;
      let cached = 0;

      if (meminfoResult.success && meminfoResult.data) {
        const meminfoLines = meminfoResult.data.split('\n');
        for (const line of meminfoLines) {
          if (line.startsWith('MemAvailable:')) {
            available = parseInt(line.split(/\s+/)[1]);
          } else if (line.startsWith('Buffers:')) {
            buffers = parseInt(line.split(/\s+/)[1]);
          } else if (line.startsWith('Cached:')) {
            cached = parseInt(line.split(/\s+/)[1]);
          }
        }
      }

      return {
        total: parseInt(memParts[1]),
        used: parseInt(memParts[2]),
        free: parseInt(memParts[3]),
        shared: parseInt(memParts[4]),
        buffers,
        cached,
        available,
        swapTotal: parseInt(swapParts[1]),
        swapUsed: parseInt(swapParts[2]),
        swapFree: parseInt(swapParts[3])
      };
    } catch (error) {
      console.error('Failed to get memory info:', error);
      return {
        total: 0,
        used: 0,
        free: 0,
        shared: 0,
        buffers: 0,
        cached: 0,
        available: 0,
        swapTotal: 0,
        swapUsed: 0,
        swapFree: 0
      };
    }
  }

  /**
   * 获取内存详细统计
   */
  async getMemoryStats(): Promise<MemoryStats> {
    try {
      // 读取/proc/meminfo获取详细统计信息
      const result = await commandService.executeCommand('cat /proc/meminfo');
      if (!result.success || !result.data) {
        throw new Error('Failed to get memory stats');
      }

      const stats: Partial<MemoryStats> = {
        activeAnon: 0,
        inactiveAnon: 0,
        activeFile: 0,
        inactiveFile: 0,
        unevictable: 0,
        mlocked: 0,
        dirty: 0,
        writeback: 0,
        slab: 0,
        kernelStack: 0,
        pageTables: 0
      };

      const lines = result.data.split('\n');

      // 解析统计数据
      for (const line of lines) {
        const [key, value] = line.split(':').map(s => s.trim());
        const kb = parseInt(value?.split(' ')?.[0] || '0');

        switch (key) {
          case 'Active(anon)':
            stats.activeAnon = kb;
            break;
          case 'Inactive(anon)':
            stats.inactiveAnon = kb;
            break;
          case 'Active(file)':
            stats.activeFile = kb;
            break;
          case 'Inactive(file)':
            stats.inactiveFile = kb;
            break;
          case 'Unevictable':
            stats.unevictable = kb;
            break;
          case 'Mlocked':
            stats.mlocked = kb;
            break;
          case 'Dirty':
            stats.dirty = kb;
            break;
          case 'Writeback':
            stats.writeback = kb;
            break;
          case 'Slab':
            stats.slab = kb;
            break;
          case 'KernelStack':
            stats.kernelStack = kb;
            break;
          case 'PageTables':
            stats.pageTables = kb;
            break;
        }
      }

      return stats as MemoryStats;
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      return {
        activeAnon: 0,
        inactiveAnon: 0,
        activeFile: 0,
        inactiveFile: 0,
        unevictable: 0,
        mlocked: 0,
        dirty: 0,
        writeback: 0,
        slab: 0,
        kernelStack: 0,
        pageTables: 0
      };
    }
  }

  /**
   * 获取虚拟内存统计
   */
  async getVMStats(): Promise<VMStats> {
    try {
      // 使用vmstat命令获取虚拟内存统计
      const result = await commandService.executeCommand('vmstat 1 1');
      if (!result.success || !result.data) {
        throw new Error('Failed to get VM stats');
      }

      const lines = result.data.split('\n');
      // vmstat输出的最后一行包含当前统计数据
      const lastLine = lines[lines.length - 1];
      const parts = lastLine.trim().split(/\s+/);

      // si和so字段分别表示换入和换出
      return {
        reads: parseInt(parts[6] || '0'),    // 换入(KB/s)
        writes: parseInt(parts[7] || '0')    // 换出(KB/s)
      };
    } catch (error) {
      console.error('Failed to get VM stats:', error);
      return {
        reads: 0,
        writes: 0
      };
    }
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    MemoryService.instance = null as any;
  }
}

// 导出单例
export const memoryService = MemoryService.getInstance(); 