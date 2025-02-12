import { CpuMetricsService } from './cpuService';
import { SSHService } from '../../../types';
import { CpuInfo, MemoryInfo } from '../../../types/monitor';

export class MetricsManager {
  private static instance: MetricsManager | null = null;
  private cpuMetricsService: CpuMetricsService;
  private sshService: SSHService;

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
    this.cpuMetricsService = CpuMetricsService.getInstance(sshService);
  }

  static getInstance(sshService: SSHService): MetricsManager {
    if (!MetricsManager.instance) {
      MetricsManager.instance = new MetricsManager(sshService);
    }
    return MetricsManager.instance;
  }

  async collectCpuMetrics(sessionId: string): Promise<CpuInfo> {
    return this.cpuMetricsService.collectMetrics(sessionId);
  }

  // TODO: 实现内存指标采集
  async collectMemoryMetrics(sessionId: string): Promise<MemoryInfo> {
    return {
      total: 0,
      used: 0,
      free: 0,
      cached: 0,
      buffers: 0,
      usagePercent: 0
    };
  }

  destroy() {
    this.cpuMetricsService.destroy();
    MetricsManager.instance = null;
  }
} 