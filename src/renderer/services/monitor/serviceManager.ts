import { SSHService } from '../../types';
import { MonitorManager } from './monitorManager';
import { CpuMetricsService } from './metrics/cpuService';
import { RefreshService } from './metrics/refreshService';

/**
 * 服务管理器
 * 用于统一管理所有服务实例
 */
class ServiceManager {
  private static instance: ServiceManager;
  private sshService: SSHService;
  private monitorManager: MonitorManager;
  private cpuMetricsService: CpuMetricsService;
  private refreshService: RefreshService;

  private constructor(sshService: SSHService) {
    this.sshService = sshService;
    this.refreshService = RefreshService.getInstance();
    this.cpuMetricsService = CpuMetricsService.getInstance(sshService);
    this.monitorManager = MonitorManager.getInstance(sshService);
  }

  static getInstance(sshService: SSHService): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager(sshService);
    }
    return ServiceManager.instance;
  }

  getMonitorManager(): MonitorManager {
    return this.monitorManager;
  }

  getCpuMetricsService(): CpuMetricsService {
    return this.cpuMetricsService;
  }

  getRefreshService(): RefreshService {
    return this.refreshService;
  }

  getSSHService(): SSHService {
    return this.sshService;
  }

  /**
   * 销毁所有服务实例
   */
  destroy(): void {
    this.monitorManager.destroy();
    this.cpuMetricsService.destroy();
    this.refreshService.destroy();
    ServiceManager.instance = null as any;
  }
}

// 导出服务管理器实例
let serviceManager: ServiceManager | null = null;

export function initializeServices(sshService: SSHService): void {
  if (!serviceManager) {
    serviceManager = ServiceManager.getInstance(sshService);
  }
}

export function getServiceManager(): ServiceManager {
  if (!serviceManager) {
    throw new Error('Services not initialized. Call initializeServices first.');
  }
  return serviceManager;
}

export function destroyServices(): void {
  if (serviceManager) {
    serviceManager.destroy();
    serviceManager = null;
  }
} 