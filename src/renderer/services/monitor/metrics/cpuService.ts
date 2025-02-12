import { commandService } from './commandService';
import { CPUInfo, CPUUsage, CPULoad } from './metricsTypes';

/**
 * CPU数据采集服务
 */
export class CPUService {
  private static instance: CPUService;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): CPUService {
    if (!CPUService.instance) {
      CPUService.instance = new CPUService();
    }
    return CPUService.instance;
  }

  /**
   * 获取CPU基本信息
   */
  async getCPUInfo(): Promise<CPUInfo> {
    // 使用lscpu命令获取CPU信息
    const result = await commandService.executeCommand('lscpu');
    if (!result.success || !result.data) {
      throw new Error('Failed to get CPU info');
    }

    const lines = result.data.split('\n');
    const info: Partial<CPUInfo> = {
      frequency: {
        current: 0,
        min: 0,
        max: 0
      },
      cache: {
        l1d: 0,
        l1i: 0,
        l2: 0,
        l3: 0
      }
    };

    // 解析lscpu输出
    for (const line of lines) {
      const [key, value] = line.split(':').map(s => s.trim());
      switch (key) {
        case 'Model name':
          info.model = value;
          break;
        case 'CPU(s)':
          info.cores = parseInt(value);
          break;
        case 'Thread(s) per core':
          info.threads = parseInt(value) * (info.cores || 1);
          break;
        case 'CPU MHz':
          if (info.frequency) info.frequency.current = parseFloat(value);
          break;
        case 'CPU min MHz':
          if (info.frequency) info.frequency.min = parseFloat(value);
          break;
        case 'CPU max MHz':
          if (info.frequency) info.frequency.max = parseFloat(value);
          break;
        case 'L1d cache':
          if (info.cache) info.cache.l1d = parseInt(value);
          break;
        case 'L1i cache':
          if (info.cache) info.cache.l1i = parseInt(value);
          break;
        case 'L2 cache':
          if (info.cache) info.cache.l2 = parseInt(value);
          break;
        case 'L3 cache':
          if (info.cache) info.cache.l3 = parseInt(value);
          break;
      }
    }

    return info as CPUInfo;
  }

  /**
   * 获取CPU使用率
   */
  async getCPUUsage(): Promise<CPUUsage> {
    // 使用top命令获取CPU使用率
    const result = await commandService.executeCommand('top -bn1');
    if (!result.success || !result.data) {
      throw new Error('Failed to get CPU usage');
    }

    const lines = result.data.split('\n');
    const cpuLine = lines.find(line => line.includes('%Cpu(s)'));
    if (!cpuLine) {
      throw new Error('CPU usage data not found');
    }

    // 解析CPU使用率数据
    const matches = cpuLine.match(/(\d+\.\d+)\s+us,\s+(\d+\.\d+)\s+sy,\s+(\d+\.\d+)\s+ni,\s+(\d+\.\d+)\s+id,\s+(\d+\.\d+)\s+wa/);
    if (!matches) {
      throw new Error('Failed to parse CPU usage data');
    }

    const [, user, system, , idle, iowait] = matches.map(parseFloat);
    const total = 100 - idle;

    // 获取每个核心的使用率
    const mpstatResult = await commandService.executeCommand('mpstat -P ALL 1 1');
    const perCore: number[] = [];
    if (mpstatResult.success && mpstatResult.data) {
      const lines = mpstatResult.data.split('\n');
      for (const line of lines) {
        if (line.startsWith('Average:') && !line.includes('CPU')) {
          const parts = line.trim().split(/\s+/);
          const idle = parseFloat(parts[parts.length - 1]);
          perCore.push(100 - idle);
        }
      }
    }

    return {
      total,
      user,
      system,
      idle,
      iowait,
      perCore
    };
  }

  /**
   * 获取CPU负载
   */
  async getCPULoad(): Promise<CPULoad> {
    // 读取/proc/loadavg获取负载信息
    const result = await commandService.executeCommand('cat /proc/loadavg');
    if (!result.success || !result.data) {
      throw new Error('Failed to get CPU load');
    }

    const [last1min, last5min, last15min] = result.data.split(' ').map(parseFloat);
    return {
      last1min,
      last5min,
      last15min
    };
  }

  /**
   * 销毁实例
   */
  destroy(): void {
    CPUService.instance = null as any;
  }
}

// 导出单例
export const cpuService = CPUService.getInstance(); 