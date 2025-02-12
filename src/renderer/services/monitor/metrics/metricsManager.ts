import { cpuService } from './cpuService';
import { memoryService } from './memoryService';
import type { CpuInfo } from './cpuService';
import type { MemoryInfo as RealTimeMemoryInfo } from './memoryService';
import EventEmitter from 'events';

export class MetricsManager extends EventEmitter {
  private static instance: MetricsManager | null = null;
  private cpuSubscribers = new Map<string, (info: CpuInfo) => void>();
  private memorySubscribers = new Map<string, (info: RealTimeMemoryInfo) => void>();

  constructor() {
    super();

    // 监听 CPU 数据更新
    cpuService.on('update', (info: CpuInfo) => {
      this.cpuSubscribers.forEach(callback => callback(info));
    });

    // 监听内存数据更新
    memoryService.on('update', (info: RealTimeMemoryInfo) => {
      this.memorySubscribers.forEach(callback => callback(info));
    });
  }

  static getInstance(): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager();
    }
    return MetricsManager.instance;
  }

  subscribeCpuInfo(sessionId: string, callback: (info: CpuInfo) => void) {
    this.cpuSubscribers.set(sessionId, callback);
    return () => {
      this.cpuSubscribers.delete(sessionId);
    };
  }

  subscribeMemoryInfo(sessionId: string, callback: (info: RealTimeMemoryInfo) => void) {
    this.memorySubscribers.set(sessionId, callback);
    return () => {
      this.memorySubscribers.delete(sessionId);
    };
  }

  destroy() {
    this.cpuSubscribers.clear();
    this.memorySubscribers.clear();
    MetricsManager.instance = null;
  }
}

export const metricsManager = MetricsManager.getInstance(); 